-- Migration: Add is_first_login and failed_login_attempts columns to users table
-- Purpose: Track first-time login requirement and failed login attempts for security

BEGIN;

-- Add is_first_login column (tracks if user must change password on first login)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT false;

-- Add failed_login_attempts column (tracks consecutive failed login attempts)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

-- Add index for is_first_login queries
CREATE INDEX IF NOT EXISTS idx_users_is_first_login ON users(is_first_login)
WHERE is_first_login = true;

-- Verify schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('is_first_login', 'failed_login_attempts')
ORDER BY ordinal_position;

COMMIT;
