-- Migration: Fix email unique constraint to allow multiple NULL/empty emails
-- Date: 2026-01-03
-- Description: Replace the unique constraint with a partial unique index that only
--              applies when email is NOT NULL and not an empty string.
--              This allows multiple contacts without emails while still preventing
--              duplicate emails within an organization.

BEGIN;

-- Step 1: Drop the existing unique constraint
-- First, find the constraint name (it may vary)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    -- Get the constraint name
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'contacts'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2
    AND EXISTS (
        SELECT 1
        FROM unnest(conkey) AS col_num
        JOIN pg_attribute ON attnum = col_num AND attrelid = 'contacts'::regclass
        WHERE attname IN ('organization_id', 'email')
    );

    -- Drop the constraint if it exists
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped constraint: %', constraint_name;
    ELSE
        RAISE NOTICE 'No matching unique constraint found on (organization_id, email)';
    END IF;
END $$;

-- Step 2: Create a partial unique index that only applies to non-empty emails
-- This allows multiple NULL or empty string emails while preventing duplicate non-empty emails
CREATE UNIQUE INDEX IF NOT EXISTS contacts_organization_email_unique_idx
ON contacts (organization_id, email)
WHERE email IS NOT NULL AND email != '';

-- Step 3: Add comment to document the change
COMMENT ON INDEX contacts_organization_email_unique_idx IS
'Unique constraint on email per organization - only applies to non-empty emails to allow multiple contacts without email addresses';

COMMIT;

-- Verification queries (run these to verify the change)
-- SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'contacts' AND indexname LIKE '%email%';
-- INSERT INTO contacts (organization_id, first_name, last_name, email) VALUES (current_setting('app.current_organization_id')::uuid, 'Test1', 'User1', '');
-- INSERT INTO contacts (organization_id, first_name, last_name, email) VALUES (current_setting('app.current_organization_id')::uuid, 'Test2', 'User2', '');
