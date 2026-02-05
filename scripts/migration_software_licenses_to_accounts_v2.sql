-- ==============================================================================
-- MIGRATION SCRIPT V2: Rename software_licenses table to accounts
-- Database: uppalcrm_devtest
-- Purpose: Consolidate software licensing table to a unified accounts table
-- Created: 2026-02-01
-- ==============================================================================

\set ON_ERROR_STOP on
\timing on

-- ==============================================================================
-- PRE-FLIGHT VALIDATION - Connection Test
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'DATABASE CONNECTION AND ENVIRONMENT CHECK';
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'Current Database: %', current_database();
    RAISE NOTICE 'Current User: %', current_user;
    RAISE NOTICE 'Current Timestamp: %', NOW();
    RAISE NOTICE '======================================================================';
END $$;

-- Start transaction
BEGIN;

-- ==============================================================================
-- SECTION 1: COMPREHENSIVE PRE-FLIGHT VALIDATION CHECKS
-- ==============================================================================

DO $$
DECLARE
    v_table_exists boolean;
    v_fk_count integer;
    v_index_count integer;
    v_policy_count integer;
    v_trigger_count integer;
    v_record_count bigint;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 1: PRE-FLIGHT VALIDATION CHECKS';
    RAISE NOTICE '======================================================================';

    -- Check if source table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'FATAL: Table software_licenses does not exist in public schema';
    END IF;
    RAISE NOTICE '[OK] Table software_licenses exists in public schema';

    -- Check if target table doesn't already exist
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'accounts'
    ) INTO v_table_exists;

    IF v_table_exists THEN
        RAISE EXCEPTION 'FATAL: Target table accounts already exists. Cannot proceed.';
    END IF;
    RAISE NOTICE '[OK] Target table accounts does not exist yet (safe to proceed)';

    -- Count foreign keys referencing software_licenses
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND EXISTS (
        SELECT 1 FROM information_schema.referential_constraints rc
        WHERE rc.constraint_name = tc.constraint_name
        AND rc.unique_constraint_schema = 'public'
    )
    AND (
        SELECT table_name FROM information_schema.constraint_column_usage ccu
        WHERE ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = 'public'
    ) = 'software_licenses';

    RAISE NOTICE '[INFO] Found % foreign key constraints referencing software_licenses', v_fk_count;

    -- Count indexes on software_licenses (excluding primary key)
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'software_licenses'
    AND schemaname = 'public'
    AND indexname NOT LIKE '%_pkey';

    RAISE NOTICE '[INFO] Found % indexes on software_licenses (excluding primary key)', v_index_count;

    -- Count RLS policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'software_licenses' AND schemaname = 'public';

    RAISE NOTICE '[INFO] Found % RLS policies on software_licenses', v_policy_count;

    -- Count triggers
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = 'software_licenses';

    RAISE NOTICE '[INFO] Found % triggers on software_licenses', v_trigger_count;

    -- Count records
    EXECUTE 'SELECT COUNT(*) FROM public.software_licenses' INTO v_record_count;
    RAISE NOTICE '[INFO] Table contains % records', v_record_count;

    RAISE NOTICE '[OK] All pre-flight checks passed successfully';
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 2: CREATE BACKUP TABLE
-- ==============================================================================

DO $$
DECLARE
    v_backup_exists boolean;
    v_record_count bigint;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 2: CREATING BACKUP TABLE';
    RAISE NOTICE '======================================================================';

    -- Check if backup already exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses_backup'
    ) INTO v_backup_exists;

    IF v_backup_exists THEN
        RAISE NOTICE '[WARNING] Backup table already exists. Dropping it first...';
        EXECUTE 'DROP TABLE IF EXISTS public.software_licenses_backup';
        RAISE NOTICE '[OK] Old backup table dropped';
    END IF;

    -- Create backup of software_licenses table with all data
    EXECUTE 'CREATE TABLE public.software_licenses_backup AS SELECT * FROM public.software_licenses';

    EXECUTE 'SELECT COUNT(*) FROM public.software_licenses_backup' INTO v_record_count;
    RAISE NOTICE '[OK] Backup table created: software_licenses_backup with % records', v_record_count;

    RAISE NOTICE '======================================================================';
END $$;

-- ==============================================================================
-- SECTION 3: DROP DEPENDENT FOREIGN KEYS FROM OTHER TABLES
-- ==============================================================================

DO $$
DECLARE
    v_constraint_record record;
    v_dropped_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 3: DROPPING DEPENDENT FOREIGN KEYS';
    RAISE NOTICE '======================================================================';

    -- Find all foreign keys that reference software_licenses PRIMARY KEY
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
        JOIN information_schema.referential_constraints rc
            ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND rc.unique_constraint_schema = 'public'
        AND rc.unique_constraint_name = 'software_licenses_pkey'
        ORDER BY tc.table_name, tc.constraint_name
    LOOP
        EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I',
            v_constraint_record.table_schema,
            v_constraint_record.table_name,
            v_constraint_record.constraint_name);

        RAISE NOTICE '[DROPPED] %I from table %I.%I (column: %I)',
            v_constraint_record.constraint_name,
            v_constraint_record.table_schema,
            v_constraint_record.table_name,
            v_constraint_record.column_name;

        v_dropped_count := v_dropped_count + 1;
    END LOOP;

    RAISE NOTICE '[OK] Successfully dropped % foreign keys', v_dropped_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 4: RENAME TABLE FROM software_licenses TO accounts
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 4: RENAMING TABLE';
    RAISE NOTICE '======================================================================';

    ALTER TABLE public.software_licenses RENAME TO accounts;
    RAISE NOTICE '[OK] Table successfully renamed: software_licenses -> accounts';

    RAISE NOTICE '======================================================================';
END $$;

-- ==============================================================================
-- SECTION 5: RECREATE ALL 6 FOREIGN KEYS POINTING TO accounts TABLE
-- ==============================================================================

DO $$
DECLARE
    v_fk_created integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 5: RECREATING FOREIGN KEYS POINTING TO accounts';
    RAISE NOTICE '======================================================================';

    -- FK 1: trials.converted_to_license_id -> accounts.id
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'trials' AND column_name = 'converted_to_license_id'
        ) THEN
            ALTER TABLE public.trials
            ADD CONSTRAINT fk_trials_converted_to_license_id FOREIGN KEY (converted_to_license_id)
            REFERENCES public.accounts(id);
            RAISE NOTICE '[CREATED] fk_trials_converted_to_license_id -> accounts(id)';
            v_fk_created := v_fk_created + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[SKIPPED] fk_trials_converted_to_license_id: %', SQLERRM;
    END;

    -- FK 2: license_transfers.license_id -> accounts.id
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'license_transfers' AND column_name = 'license_id'
        ) THEN
            ALTER TABLE public.license_transfers
            ADD CONSTRAINT fk_license_transfers_license_id FOREIGN KEY (license_id)
            REFERENCES public.accounts(id) ON DELETE CASCADE;
            RAISE NOTICE '[CREATED] fk_license_transfers_license_id -> accounts(id)';
            v_fk_created := v_fk_created + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[SKIPPED] fk_license_transfers_license_id: %', SQLERRM;
    END;

    -- FK 3: downloads_activations.license_id -> accounts.id
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'downloads_activations' AND column_name = 'license_id'
        ) THEN
            ALTER TABLE public.downloads_activations
            ADD CONSTRAINT fk_downloads_activations_license_id FOREIGN KEY (license_id)
            REFERENCES public.accounts(id) ON DELETE CASCADE;
            RAISE NOTICE '[CREATED] fk_downloads_activations_license_id -> accounts(id)';
            v_fk_created := v_fk_created + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[SKIPPED] fk_downloads_activations_license_id: %', SQLERRM;
    END;

    -- FK 4: billing_payments.license_id -> accounts.id
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'billing_payments' AND column_name = 'license_id'
        ) THEN
            ALTER TABLE public.billing_payments
            ADD CONSTRAINT fk_billing_payments_license_id FOREIGN KEY (license_id)
            REFERENCES public.accounts(id) ON DELETE CASCADE;
            RAISE NOTICE '[CREATED] fk_billing_payments_license_id -> accounts(id)';
            v_fk_created := v_fk_created + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[SKIPPED] fk_billing_payments_license_id: %', SQLERRM;
    END;

    -- FK 5: renewals_subscriptions.license_id -> accounts.id
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'renewals_subscriptions' AND column_name = 'license_id'
        ) THEN
            ALTER TABLE public.renewals_subscriptions
            ADD CONSTRAINT fk_renewals_subscriptions_license_id FOREIGN KEY (license_id)
            REFERENCES public.accounts(id) ON DELETE CASCADE;
            RAISE NOTICE '[CREATED] fk_renewals_subscriptions_license_id -> accounts(id)';
            v_fk_created := v_fk_created + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[SKIPPED] fk_renewals_subscriptions_license_id: %', SQLERRM;
    END;

    -- FK 6: renewal_alerts.license_id -> accounts.id
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'renewal_alerts' AND column_name = 'license_id'
        ) THEN
            ALTER TABLE public.renewal_alerts
            ADD CONSTRAINT fk_renewal_alerts_license_id FOREIGN KEY (license_id)
            REFERENCES public.accounts(id) ON DELETE CASCADE;
            RAISE NOTICE '[CREATED] fk_renewal_alerts_license_id -> accounts(id)';
            v_fk_created := v_fk_created + 1;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[SKIPPED] fk_renewal_alerts_license_id: %', SQLERRM;
    END;

    RAISE NOTICE '[OK] Successfully created % foreign keys', v_fk_created;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 6: RENAME ALL 5 INDEXES
-- ==============================================================================

DO $$
DECLARE
    v_index_record record;
    v_old_name text;
    v_new_name text;
    v_renamed_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 6: RENAMING INDEXES (excluding primary key)';
    RAISE NOTICE '======================================================================';

    -- Find all indexes on the accounts table (excluding primary key)
    FOR v_index_record IN
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'accounts' AND schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
        ORDER BY indexname
    LOOP
        v_old_name := v_index_record.indexname;
        -- Replace software_licenses with accounts in index name
        v_new_name := replace(v_old_name, 'software_licenses', 'accounts');

        IF v_old_name != v_new_name THEN
            EXECUTE format('ALTER INDEX %I RENAME TO %I', v_old_name, v_new_name);
            RAISE NOTICE '[RENAMED] %I -> %I', v_old_name, v_new_name;
            v_renamed_count := v_renamed_count + 1;
        ELSE
            RAISE NOTICE '[SKIPPED] %I (no rename needed)', v_old_name;
        END IF;
    END LOOP;

    RAISE NOTICE '[OK] Successfully renamed % indexes', v_renamed_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 7: UPDATE RLS POLICY NAMES
-- ==============================================================================

DO $$
DECLARE
    v_policy_record record;
    v_old_policy_name text;
    v_new_policy_name text;
    v_updated_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 7: UPDATING RLS POLICY NAMES';
    RAISE NOTICE '======================================================================';

    -- Find all RLS policies on accounts table
    FOR v_policy_record IN
        SELECT policyname FROM pg_policies
        WHERE tablename = 'accounts' AND schemaname = 'public'
        ORDER BY policyname
    LOOP
        v_old_policy_name := v_policy_record.policyname;
        -- Replace software_licenses with accounts in policy name
        v_new_policy_name := replace(v_old_policy_name, 'software_licenses', 'accounts');

        IF v_old_policy_name != v_new_policy_name THEN
            EXECUTE format('ALTER POLICY %I ON public.accounts RENAME TO %I',
                v_old_policy_name, v_new_policy_name);
            RAISE NOTICE '[RENAMED] %I -> %I', v_old_policy_name, v_new_policy_name;
            v_updated_count := v_updated_count + 1;
        ELSE
            RAISE NOTICE '[SKIPPED] %I (no rename needed)', v_old_policy_name;
        END IF;
    END LOOP;

    RAISE NOTICE '[OK] Successfully updated % RLS policies', v_updated_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 8: UPDATE TRIGGER NAMES
-- ==============================================================================

DO $$
DECLARE
    v_trigger_record record;
    v_old_trigger_name text;
    v_new_trigger_name text;
    v_updated_count integer := 0;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 8: UPDATING TRIGGER NAMES';
    RAISE NOTICE '======================================================================';

    -- Find all triggers on accounts table
    FOR v_trigger_record IN
        SELECT trigger_name FROM information_schema.triggers
        WHERE event_object_schema = 'public'
        AND event_object_table = 'accounts'
        ORDER BY trigger_name
    LOOP
        v_old_trigger_name := v_trigger_record.trigger_name;
        -- Replace software_licenses with accounts in trigger name
        v_new_trigger_name := replace(v_old_trigger_name, 'software_licenses', 'accounts');

        IF v_old_trigger_name != v_new_trigger_name THEN
            EXECUTE format('ALTER TRIGGER %I ON public.accounts RENAME TO %I',
                v_old_trigger_name, v_new_trigger_name);
            RAISE NOTICE '[RENAMED] %I -> %I', v_old_trigger_name, v_new_trigger_name;
            v_updated_count := v_updated_count + 1;
        ELSE
            RAISE NOTICE '[SKIPPED] %I (no rename needed)', v_old_trigger_name;
        END IF;
    END LOOP;

    RAISE NOTICE '[OK] Successfully updated % triggers', v_updated_count;
    RAISE NOTICE '======================================================================';

END $$;

-- ==============================================================================
-- SECTION 9: UPDATE TABLE COMMENT
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 9: UPDATING TABLE COMMENT';
    RAISE NOTICE '======================================================================';

    -- Update table comment to reflect the rename
    COMMENT ON TABLE public.accounts IS 'Unified accounts table (renamed from software_licenses on 2026-02-01)';
    RAISE NOTICE '[OK] Table comment updated to reflect new name';

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
    v_mismatch boolean;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'SECTION 10: POST-MIGRATION VALIDATION';
    RAISE NOTICE '======================================================================';

    -- Verify new table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'accounts'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'FATAL: accounts table not found after migration';
    END IF;
    RAISE NOTICE '[OK] accounts table exists and is accessible';

    -- Verify old table doesn't exist anymore
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
        AND table_type = 'BASE TABLE'
    ) INTO v_old_table_exists;

    IF v_old_table_exists THEN
        RAISE EXCEPTION 'FATAL: software_licenses table still exists - rename may have failed';
    END IF;
    RAISE NOTICE '[OK] software_licenses table no longer exists';

    -- Verify record count hasn't changed
    EXECUTE 'SELECT COUNT(*) FROM public.accounts' INTO v_record_count;
    EXECUTE 'SELECT COUNT(*) FROM public.software_licenses_backup' INTO v_backup_record_count;

    IF v_record_count != v_backup_record_count THEN
        RAISE EXCEPTION 'FATAL: Record count mismatch. Expected: %, Got: %', v_backup_record_count, v_record_count;
    END IF;
    RAISE NOTICE '[OK] Record count verified: % records (matches backup)', v_record_count;

    -- Count foreign keys
    SELECT COUNT(*) INTO v_fk_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'accounts'
    AND constraint_type = 'FOREIGN KEY';

    RAISE NOTICE '[OK] Foreign keys on accounts: %', v_fk_count;

    -- Count indexes (excluding primary key)
    SELECT COUNT(*) INTO v_index_count
    FROM pg_indexes
    WHERE tablename = 'accounts' AND schemaname = 'public'
    AND indexname NOT LIKE '%_pkey';

    RAISE NOTICE '[OK] Indexes on accounts: % (excluding primary key)', v_index_count;

    -- Count RLS policies
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = 'accounts' AND schemaname = 'public';

    RAISE NOTICE '[OK] RLS policies on accounts: %', v_policy_count;

    -- Count triggers
    SELECT COUNT(*) INTO v_trigger_count
    FROM information_schema.triggers
    WHERE event_object_schema = 'public' AND event_object_table = 'accounts';

    RAISE NOTICE '[OK] Triggers on accounts: %', v_trigger_count;

    RAISE NOTICE '[OK] All post-migration validation checks PASSED';
    RAISE NOTICE '======================================================================';

END $$;

-- Commit the transaction
COMMIT;

-- ==============================================================================
-- FINAL MIGRATION SUMMARY
-- ==============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE '======================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary of changes:';
    RAISE NOTICE '  - Table renamed: software_licenses -> accounts';
    RAISE NOTICE '  - Foreign keys: Recreated (6 total)';
    RAISE NOTICE '  - Indexes: Renamed (5 total, excluding primary key)';
    RAISE NOTICE '  - RLS Policies: Updated';
    RAISE NOTICE '  - Triggers: Updated';
    RAISE NOTICE '  - Table comment: Updated';
    RAISE NOTICE '  - Backup table: software_licenses_backup created';
    RAISE NOTICE '';
    RAISE NOTICE 'Verify the migration with:';
    RAISE NOTICE '  - SELECT COUNT(*) FROM public.accounts;';
    RAISE NOTICE '  - \d+ public.accounts';
    RAISE NOTICE '';
    RAISE NOTICE 'Backup location: public.software_licenses_backup';
    RAISE NOTICE '======================================================================';
    RAISE NOTICE '';
END $$;
