-- Fix accounts foreign key to point to contacts table instead of contacts_broken_backup

BEGIN;

-- Drop the incorrect foreign key constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_contact_id_fkey;

-- Add the correct foreign key constraint pointing to contacts table
ALTER TABLE accounts
ADD CONSTRAINT accounts_contact_id_fkey
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

COMMIT;

-- Verify the fix
COMMENT ON CONSTRAINT accounts_contact_id_fkey ON accounts IS 'Fixed: Points to contacts table instead of contacts_broken_backup';
