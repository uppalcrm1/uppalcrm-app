-- Migration: Fix email unique constraint for PRODUCTION
-- Run this via Render PostgreSQL Dashboard or psql
-- Date: 2026-01-03
-- Description: Replace unique constraint with partial unique index to allow multiple NULL/empty emails

\echo 'Starting migration: Fix email unique constraint'

BEGIN;

-- Step 1: Check current constraint
\echo 'Step 1: Checking current constraints...'
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
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

-- Step 2: Drop existing constraint
\echo 'Step 2: Dropping existing unique constraint...'
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

-- Step 3: Create partial unique index
\echo 'Step 3: Creating partial unique index...'
CREATE UNIQUE INDEX IF NOT EXISTS contacts_organization_email_unique_idx
ON contacts (organization_id, email)
WHERE email IS NOT NULL AND email != '';

-- Step 4: Add comment
\echo 'Step 4: Adding documentation...'
COMMENT ON INDEX contacts_organization_email_unique_idx IS
'Unique constraint on email per organization - only applies to non-empty emails to allow multiple contacts without email addresses';

-- Step 5: Verify
\echo 'Step 5: Verifying new index...'
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'contacts'
AND indexname = 'contacts_organization_email_unique_idx';

COMMIT;

\echo 'Migration completed successfully!'
\echo 'You can now create multiple contacts without email addresses.'
