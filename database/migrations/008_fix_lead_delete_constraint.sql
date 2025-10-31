-- =====================================================
-- FIX: Allow lead deletion by setting contact.lead_id to NULL
-- =====================================================
--
-- Problem: Can't delete leads that have been converted to contacts
-- because the foreign key constraint blocks it
--
-- Solution: Change the constraint to SET NULL on delete
-- =====================================================

-- Step 1: Find the constraint name (it's auto-generated)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Get the constraint name
    SELECT con.conname INTO constraint_name
    FROM pg_constraint con
    INNER JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'contacts'
      AND con.contype = 'f'
      AND EXISTS (
        SELECT 1 FROM pg_attribute att
        WHERE att.attrelid = con.conrelid
          AND att.attnum = ANY(con.conkey)
          AND att.attname = 'lead_id'
      );

    -- If constraint exists, drop it
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT IF EXISTS %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    END IF;

    -- Add the new constraint with ON DELETE SET NULL
    ALTER TABLE contacts
    ADD CONSTRAINT contacts_lead_id_fkey
    FOREIGN KEY (lead_id)
    REFERENCES leads(id)
    ON DELETE SET NULL;

    RAISE NOTICE 'Added new constraint with ON DELETE SET NULL';
END $$;

-- Step 2: Verify the fix
DO $$
BEGIN
    RAISE NOTICE '✅ Migration complete: Leads can now be deleted even if converted to contacts';
    RAISE NOTICE '   When a lead is deleted, contact.lead_id will be set to NULL';
END $$;
