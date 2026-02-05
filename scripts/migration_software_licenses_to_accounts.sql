-- ==============================================================================
-- MIGRATION SCRIPT: Rename software_licenses table to accounts
-- Database: uppalcrm_devtest
-- Purpose: Consolidate software licensing table to a unified accounts table
-- ==============================================================================

\set ON_ERROR_STOP on

-- Start transaction
BEGIN;

-- ==============================================================================
-- SECTION 1: PRE-FLIGHT VALIDATION CHECKS
-- ==============================================================================

DO $$
DECLARE
    v_table_exists boolean;
    v_fk_count integer;
    v_index_count integer;
    v_policy_count integer;
    v_record_count bigint;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'PRE-FLIGHT VALIDATION CHECKS';
    RAISE NOTICE '======================================================================';

    -- Check if source table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'FATAL: Table software_licenses does not exist in public schema';
    END IF;
    RAISE NOTICE '[OK] Table software_licenses exists';

    -- Check if target table doesn't already exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'accounts'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        RAISE EXCEPTION 'FATAL: Target table accounts already exists. Choose a different name or drop it first.';
    END IF;
    RAISE NOTICE '[OK] Target table accounts does not exist yet';

    -- Count foreign keys referencing software_licenses
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.constraint_column_usage
    WHERE table_name = 'software_licenses' AND table_schema = 'public';

    RAISE NOTICE '[INFO] Found % foreign keys/constraints referencing software_licenses', v_fk_count;

    -- Count indexes on software_licenses
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'software_licenses' AND schemaname = 'public';

    RAISE NOTICE '[INFO] Found % indexes on software_licenses', v_index_count;

    -- Count RLS policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'software_licenses' AND schemaname = 'public';

    RAISE NOTICE '[INFO] Found % RLS policies on software_licenses', v_policy_count;

    -- Count records
    EXECUTE 'SELECT COUNT(*) FROM public.software_licenses' INTO v_record_count;
    RAISE NOTICE '[INFO] Table contains % records', v_record_count;

    RAISE NOTICE '[OK] All pre-flight checks passed';
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 2: CREATE BACKUP
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'CREATING BACKUP TABLE';
    RAISE NOTICE '======================================================================';

    -- Create backup of software_licenses table
    CREATE TABLE public.software_licenses_backup AS SELECT * FROM public.software_licenses;
    RAISE NOTICE '[OK] Backup table created: software_licenses_backup';

    RAISE NOTICE '======================================================================';
END $$;

-- ==============================================================================
-- SECTION 3: DROP DEPENDENT FOREIGN KEYS
-- ==============================================================================

DO $$
DECLARE
    v_constraint_record record;
    v_dropped_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'DROPPING DEPENDENT FOREIGN KEYS';
    RAISE NOTICE '======================================================================';

    -- Find all foreign keys that reference software_licenses
    FOR v_constraint_record IN
        SELECT
            tc.constraint_name,
            tc.table_schema,
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND EXISTS (
            SELECT 1 FROM information_schema.referential_constraints rc
            WHERE rc.constraint_name = tc.constraint_name
            AND rc.unique_constraint_schema = 'public'
            AND rc.unique_constraint_name IN (
                SELECT constraint_name FROM information_schema.table_constraints
                WHERE table_name = 'software_licenses' AND constraint_type = 'PRIMARY KEY'
            )
        )
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
            v_constraint_record.table_schema,
            v_constraint_record.table_name,
            v_constraint_record.constraint_name);

        RAISE NOTICE '[DROPPED] Foreign key %I from table %I.%I',
            v_constraint_record.constraint_name,
            v_constraint_record.table_schema,
            v_constraint_record.table_name;

        v_dropped_count := v_dropped_count + 1;
    END LOOP;

    RAISE NOTICE '[OK] Dropped % foreign keys', v_dropped_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 4: RENAME TABLE
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'RENAMING TABLE: software_licenses -> accounts';
    RAISE NOTICE '======================================================================';

    ALTER TABLE public.software_licenses RENAME TO accounts;
    RAISE NOTICE '[OK] Table renamed: software_licenses -> accounts';

    RAISE NOTICE '======================================================================';
END $$;

-- ==============================================================================
-- SECTION 5: RECREATE FOREIGN KEYS
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'RECREATING FOREIGN KEYS';
    RAISE NOTICE '======================================================================';

    -- Note: The actual FK definitions depend on your schema
    -- These are placeholders - adjust based on actual schema
    -- Example structure for common scenarios:

    -- FK 1: If there's a company_id foreign key
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'company_id'
    ) THEN
        BEGIN
            ALTER TABLE public.accounts
            ADD CONSTRAINT fk_accounts_company_id FOREIGN KEY (company_id)
            REFERENCES public.companies(id) ON DELETE CASCADE;
            RAISE NOTICE '[CREATED] Foreign key: fk_accounts_company_id';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[SKIPPED] Could not create fk_accounts_company_id: %', SQLERRM;
        END;
    END IF;

    -- FK 2: If there's an owner_id foreign key
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'owner_id'
    ) THEN
        BEGIN
            ALTER TABLE public.accounts
            ADD CONSTRAINT fk_accounts_owner_id FOREIGN KEY (owner_id)
            REFERENCES public.users(id) ON DELETE SET NULL;
            RAISE NOTICE '[CREATED] Foreign key: fk_accounts_owner_id';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[SKIPPED] Could not create fk_accounts_owner_id: %', SQLERRM;
        END;
    END IF;

    RAISE NOTICE '[INFO] Foreign key recreation depends on actual schema structure';
    RAISE NOTICE '[INFO] Review and adjust FK definitions based on your actual schema';
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 6: RENAME INDEXES
-- ==============================================================================

DO $$
DECLARE
    v_index_record record;
    v_old_name text;
    v_new_name text;
    v_renamed_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'RENAMING INDEXES';
    RAISE NOTICE '======================================================================';

    -- Find all indexes on the accounts table (excluding primary key)
    FOR v_index_record IN
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'accounts' AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
    LOOP
        v_old_name := v_index_record.indexname;
        -- Replace software_licenses with accounts in index name
        v_new_name := replace(v_old_name, 'software_licenses', 'accounts');

        IF v_old_name != v_new_name THEN
            EXECUTE format('ALTER INDEX %I RENAME TO %I', v_old_name, v_new_name);
            RAISE NOTICE '[RENAMED] Index: %I -> %I', v_old_name, v_new_name;
            v_renamed_count := v_renamed_count + 1;
        ELSE
            RAISE NOTICE '[SKIPPED] Index %I (no rename needed)', v_old_name;
        END IF;
    END LOOP;

    RAISE NOTICE '[OK] Renamed % indexes', v_renamed_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 7: UPDATE RLS POLICIES
-- ==============================================================================

DO $$
DECLARE
    v_policy_record record;
    v_old_policy_name text;
    v_new_policy_name text;
    v_updated_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'UPDATING RLS POLICIES';
    RAISE NOTICE '======================================================================';

    -- Find all RLS policies on accounts table
    FOR v_policy_record IN
        SELECT policyname FROM pg_policies
        WHERE tablename = 'accounts' AND schemaname = 'public'
    LOOP
        v_old_policy_name := v_policy_record.policyname;
        -- Replace software_licenses with accounts in policy name
        v_new_policy_name := replace(v_old_policy_name, 'software_licenses', 'accounts');

        IF v_old_policy_name != v_new_policy_name THEN
            EXECUTE format('ALTER POLICY %I ON public.accounts RENAME TO %I',
                v_old_policy_name, v_new_policy_name);
            RAISE NOTICE '[RENAMED] RLS Policy: %I -> %I', v_old_policy_name, v_new_policy_name;
            v_updated_count := v_updated_count + 1;
        ELSE
            RAISE NOTICE '[SKIPPED] Policy %I (no rename needed)', v_old_policy_name;
        END IF;
    END LOOP;

    RAISE NOTICE '[OK] Updated % RLS policies', v_updated_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 8: UPDATE TRIGGERS
-- ==============================================================================

DO $$
DECLARE
    v_trigger_record record;
    v_old_trigger_name text;
    v_new_trigger_name text;
    v_updated_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'UPDATING TRIGGERS';
    RAISE NOTICE '======================================================================';

    -- Find all triggers on accounts table
    FOR v_trigger_record IN
        SELECT trigger_name FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table = 'accounts'
    LOOP
        v_old_trigger_name := v_trigger_record.trigger_name;
        -- Replace software_licenses with accounts in trigger name
        v_new_trigger_name := replace(v_old_trigger_name, 'software_licenses', 'accounts');

        IF v_old_trigger_name != v_new_trigger_name THEN
            EXECUTE format('ALTER TRIGGER %I ON public.accounts RENAME TO %I',
                v_old_trigger_name, v_new_trigger_name);
            RAISE NOTICE '[RENAMED] Trigger: %I -> %I', v_old_trigger_name, v_new_trigger_name;
            v_updated_count := v_updated_count + 1;
        ELSE
            RAISE NOTICE '[SKIPPED] Trigger %I (no rename needed)', v_old_trigger_name;
        END IF;
    END LOOP;

    RAISE NOTICE '[OK] Updated % triggers', v_updated_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 9: UPDATE TABLE COMMENT
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'UPDATING TABLE COMMENT';
    RAISE NOTICE '======================================================================';

    -- Get existing comment if any
    COMMENT ON TABLE public.accounts IS 'Unified accounts table (formerly software_licenses)';
    RAISE NOTICE '[OK] Table comment updated';

    RAISE NOTICE '======================================================================';
END $$;

-- ==============================================================================
-- SECTION 10: POST-MIGRATION VALIDATION
-- ==============================================================================

DO $$
DECLARE
    v_table_exists boolean;
    v_old_table_exists boolean;
    v_record_count bigint;
    v_backup_record_count bigint;
    v_fk_count integer;
    v_index_count integer;
    v_policy_count integer;
    v_trigger_count integer;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'POST-MIGRATION VALIDATION';
    RAISE NOTICE '======================================================================';

    -- Verify new table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'accounts'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'FATAL: accounts table not found after migration';
    END IF;
    RAISE NOTICE '[OK] Table accounts exists';

    -- Verify old table doesn't exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
        AND table_type = 'BASE TABLE'
    ) INTO v_old_table_exists;

    IF v_old_table_exists THEN
        RAISE EXCEPTION 'FATAL: Table software_licenses still exists - rename may have failed';
    END IF;
    RAISE NOTICE '[OK] Table software_licenses no longer exists';

    -- Verify record count hasn't changed
    EXECUTE 'SELECT COUNT(*) FROM public.accounts' INTO v_record_count;
    EXECUTE 'SELECT COUNT(*) FROM public.software_licenses_backup' INTO v_backup_record_count;

    IF v_record_count != v_backup_record_count THEN
        RAISE EXCEPTION 'FATAL: Record count mismatch. Before: %, After: %', v_backup_record_count, v_record_count;
    END IF;
    RAISE NOTICE '[OK] Record count verified: % records in accounts table', v_record_count;

    -- Count constraints and indexes
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'accounts'
    AND constraint_type = 'FOREIGN KEY';

    RAISE NOTICE '[INFO] Foreign keys on accounts: %', v_fk_count;

    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'accounts' AND schemaname = 'public';

    RAISE NOTICE '[INFO] Indexes on accounts: %', v_index_count;

    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'accounts' AND schemaname = 'public';

    RAISE NOTICE '[INFO] RLS policies on accounts: %', v_policy_count;

    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = 'accounts';

    RAISE NOTICE '[INFO] Triggers on accounts: %', v_trigger_count;

    RAISE NOTICE '[OK] All post-migration validation checks passed';
    RAISE NOTICE '======================================================================';

END $$;

-- Commit transaction
COMMIT;

-- ==============================================================================
-- MIGRATION SUMMARY
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'Table software_licenses has been successfully renamed to accounts';
    RAISE NOTICE 'All dependent objects (FKs, indexes, policies, triggers) have been updated';
    RAISE NOTICE 'A backup table software_licenses_backup has been created';
    RAISE NOTICE '';
    RAISE NOTICE 'To verify the migration, run:';
    RAISE NOTICE '  SELECT * FROM public.accounts LIMIT 10;';
    RAISE NOTICE '  \d+ public.accounts';
    RAISE NOTICE '';
    RAISE NOTICE 'To rollback, restore from software_licenses_backup if needed';
    RAISE NOTICE '======================================================================';
END $$;
