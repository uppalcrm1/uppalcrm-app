-- Migration: Make emails globally unique
-- This migration changes the users table constraint from UNIQUE(organization_id, email) to UNIQUE(email)
-- and handles duplicate emails by appending organization suffix

-- Start transaction
BEGIN;

-- Step 1: Handle duplicate emails by updating them to be unique
-- Add organization suffix to duplicate emails
WITH duplicate_emails AS (
    SELECT 
        email,
        COUNT(*) as email_count
    FROM users
    GROUP BY email
    HAVING COUNT(*) > 1
),
numbered_users AS (
    SELECT 
        u.id,
        u.email,
        u.organization_id,
        o.slug as org_slug,
        ROW_NUMBER() OVER (PARTITION BY u.email ORDER BY u.created_at) as rn
    FROM users u
    JOIN organizations o ON u.organization_id = o.id
    WHERE u.email IN (SELECT email FROM duplicate_emails)
)
UPDATE users
SET email = CASE 
    WHEN nu.rn = 1 THEN nu.email  -- Keep first occurrence unchanged
    ELSE nu.email || '+org-' || nu.org_slug  -- Add organization suffix to duplicates
END
FROM numbered_users nu
WHERE users.id = nu.id;

-- Step 2: Drop the existing composite unique constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_organization_id_email_key;
ALTER TABLE users DROP CONSTRAINT IF EXISTS unique_email_per_org;

-- Step 3: Create new global unique constraint on email
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Step 4: Update the index to reflect the change
DROP INDEX IF EXISTS idx_users_organization_email;
CREATE INDEX IF NOT EXISTS idx_users_email_lookup ON users(email) WHERE is_active = true;

-- Step 5: Create a function to validate email uniqueness (optional safety check)
CREATE OR REPLACE FUNCTION validate_unique_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Check for existing email (case-insensitive)
    IF EXISTS (
        SELECT 1 FROM users 
        WHERE LOWER(email) = LOWER(NEW.email) 
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Email address already exists: %', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger for email validation
DROP TRIGGER IF EXISTS validate_email_uniqueness ON users;
CREATE TRIGGER validate_email_uniqueness
    BEFORE INSERT OR UPDATE OF email ON users
    FOR EACH ROW
    EXECUTE FUNCTION validate_unique_email();

-- Commit the transaction
COMMIT;

-- Verification queries (run these after migration to verify success)
-- SELECT email, COUNT(*) FROM users GROUP BY email HAVING COUNT(*) > 1; -- Should return no rows
-- SELECT COUNT(DISTINCT email) as unique_emails, COUNT(*) as total_users FROM users WHERE is_active = true;