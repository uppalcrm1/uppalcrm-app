-- Migration: Make email field optional in contacts table
-- Date: 2025-12-14
-- Description: Remove NOT NULL constraint from email column to allow contacts without email

-- Make email column nullable
ALTER TABLE contacts
ALTER COLUMN email DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN contacts.email IS 'Contact email address (optional)';

-- Verification query (run this to verify the change)
-- SELECT column_name, is_nullable, data_type
-- FROM information_schema.columns
-- WHERE table_name = 'contacts' AND column_name = 'email';
