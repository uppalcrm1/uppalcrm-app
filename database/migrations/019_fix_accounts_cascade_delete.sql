-- Fix accounts foreign key constraint to use CASCADE instead of SET NULL
-- This resolves the constraint violation when deleting contacts with accounts
--
-- Issue: Migration 018 set ON DELETE SET NULL, but contact_id is NOT NULL
-- This causes errors when trying to delete contacts that have accounts
--
-- Solution: Change to ON DELETE CASCADE so accounts are deleted with their contact

BEGIN;

-- Drop the incorrect SET NULL constraint
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_contact_id_fkey;

-- Add the correct CASCADE constraint
-- When a contact is deleted, automatically delete all associated accounts
ALTER TABLE accounts
ADD CONSTRAINT accounts_contact_id_fkey
FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;

COMMIT;

-- Verify the fix
COMMENT ON CONSTRAINT accounts_contact_id_fkey ON accounts IS 'Cascades deletes: When contact deleted, accounts are also deleted';

-- Test query (run this to verify):
-- SELECT
--   tc.constraint_name,
--   tc.table_name,
--   kcu.column_name,
--   rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.referential_constraints rc
--   ON tc.constraint_name = rc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY'
--   AND tc.table_name = 'accounts'
--   AND kcu.column_name = 'contact_id';
--
-- Expected delete_rule: 'CASCADE'
