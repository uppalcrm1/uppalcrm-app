-- Fix leads.linked_contact_id foreign key constraint to use SET NULL
-- This allows contacts to be deleted while preserving the linked leads
--
-- Issue: Current constraint has NO ACTION which prevents contact deletion
-- when leads reference them via linked_contact_id
--
-- Solution: Change to ON DELETE SET NULL so leads remain but are unlinked
-- when their contact is deleted

BEGIN;

-- Drop the existing constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_linked_contact_id_fkey;

-- Add the correct constraint with ON DELETE SET NULL
-- When a contact is deleted, unlink any leads that reference it
ALTER TABLE leads
ADD CONSTRAINT leads_linked_contact_id_fkey
FOREIGN KEY (linked_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;

COMMIT;

-- Verify the fix
COMMENT ON CONSTRAINT leads_linked_contact_id_fkey ON leads IS 'Sets NULL on delete: When contact deleted, leads are unlinked but preserved';

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
--   AND tc.table_name = 'leads'
--   AND kcu.column_name = 'linked_contact_id';
--
-- Expected delete_rule: 'SET NULL'
