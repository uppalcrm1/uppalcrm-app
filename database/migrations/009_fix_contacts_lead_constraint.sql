-- =====================================================
-- FIX: Allow lead deletion when referenced by contacts
-- =====================================================
--
-- Problem: Cannot delete leads that are referenced by contacts table
-- Error: "Key (id)=(...) is still referenced from table contacts"
--
-- Solution: Find and update the constraint to SET NULL on delete
-- =====================================================

DO $$
DECLARE
    constraint_name TEXT;
    column_name TEXT;
BEGIN
    RAISE NOTICE '🔍 Searching for foreign key constraint from contacts to leads...';

    -- Find any constraint from contacts table that references leads
    SELECT con.conname, att.attname INTO constraint_name, column_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    INNER JOIN pg_class ref ON ref.oid = con.confrelid
    INNER JOIN pg_attribute att ON att.attrelid = con.conrelid
        AND att.attnum = ANY(con.conkey)
    WHERE rel.relname = 'contacts'
      AND ref.relname = 'leads'
      AND con.contype = 'f'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        RAISE NOTICE '✓ Found constraint: % on column: %', constraint_name, column_name;

        -- Drop the existing constraint
        EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE '✓ Dropped constraint: %', constraint_name;

        -- Add new constraint with ON DELETE SET NULL
        EXECUTE format(
            'ALTER TABLE contacts ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES leads(id) ON DELETE SET NULL',
            constraint_name,
            column_name
        );
        RAISE NOTICE '✓ Added new constraint with ON DELETE SET NULL';

    ELSE
        RAISE NOTICE '⚠ No foreign key constraint found from contacts to leads';
    END IF;

    RAISE NOTICE '✅ Migration complete!';

END $$;
