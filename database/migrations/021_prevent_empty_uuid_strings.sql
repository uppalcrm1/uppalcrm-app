-- Migration 021: Prevent Empty String UUIDs
-- Purpose: Add database-level protection against empty string UUID values
-- Date: 2026-01-01
-- Issue: Lead conversion failures due to empty strings in UUID columns

-- =====================================================
-- PROBLEM:
-- PostgreSQL UUID columns can store empty strings '',
-- but operations that expect UUIDs fail with:
-- "invalid input syntax for type uuid: \"\""
--
-- This migration prevents empty strings from being
-- stored in UUID columns across the entire database.
-- =====================================================

BEGIN;

-- =====================================================
-- 1. CREATE TRIGGER FUNCTION TO SANITIZE UUID FIELDS
-- =====================================================

CREATE OR REPLACE FUNCTION sanitize_uuid_fields()
RETURNS TRIGGER AS $$
DECLARE
  col_name text;
  col_type text;
  sql_cmd text;
BEGIN
  -- Loop through all columns in the table
  FOR col_name, col_type IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = TG_TABLE_NAME
      AND table_schema = 'public'
      AND data_type = 'uuid'
  LOOP
    -- Build dynamic SQL to convert empty strings to NULL
    sql_cmd := format('
      IF NEW.%I IS NOT NULL AND NEW.%I::text = '''' THEN
        NEW.%I := NULL;
      END IF;
    ', col_name, col_name, col_name);

    -- Execute the dynamic SQL
    EXECUTE sql_cmd;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 2. ADD TRIGGERS TO ALL TABLES WITH UUID COLUMNS
-- =====================================================

-- Lead Interactions Table
DROP TRIGGER IF EXISTS sanitize_uuid_lead_interactions ON lead_interactions;
CREATE TRIGGER sanitize_uuid_lead_interactions
  BEFORE INSERT OR UPDATE ON lead_interactions
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_uuid_fields();

-- Contact Interactions Table
DROP TRIGGER IF EXISTS sanitize_uuid_contact_interactions ON contact_interactions;
CREATE TRIGGER sanitize_uuid_contact_interactions
  BEFORE INSERT OR UPDATE ON contact_interactions
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_uuid_fields();

-- Leads Table
DROP TRIGGER IF EXISTS sanitize_uuid_leads ON leads;
CREATE TRIGGER sanitize_uuid_leads
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_uuid_fields();

-- Contacts Table
DROP TRIGGER IF EXISTS sanitize_uuid_contacts ON contacts;
CREATE TRIGGER sanitize_uuid_contacts
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_uuid_fields();

-- Accounts Table
DROP TRIGGER IF EXISTS sanitize_uuid_accounts ON accounts;
CREATE TRIGGER sanitize_uuid_accounts
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_uuid_fields();

-- Transactions Table
DROP TRIGGER IF EXISTS sanitize_uuid_transactions ON transactions;
CREATE TRIGGER sanitize_uuid_transactions
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_uuid_fields();

-- Custom Field Values Table
DROP TRIGGER IF EXISTS sanitize_uuid_custom_field_values ON custom_field_values;
CREATE TRIGGER sanitize_uuid_custom_field_values
  BEFORE INSERT OR UPDATE ON custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION sanitize_uuid_fields();

-- =====================================================
-- 3. CLEAN UP EXISTING EMPTY STRING UUIDS
-- =====================================================

-- Fix lead_interactions table
UPDATE lead_interactions
SET user_id = NULL
WHERE user_id IS NOT NULL AND user_id::text = '';

UPDATE lead_interactions
SET lead_id = NULL
WHERE lead_id IS NOT NULL AND lead_id::text = '';

-- Fix contact_interactions table
UPDATE contact_interactions
SET user_id = NULL
WHERE user_id IS NOT NULL AND user_id::text = '';

UPDATE contact_interactions
SET contact_id = NULL
WHERE contact_id IS NOT NULL AND contact_id::text = '';

UPDATE contact_interactions
SET created_by = NULL
WHERE created_by IS NOT NULL AND created_by::text = '';

-- Fix leads table
UPDATE leads
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL AND assigned_to::text = '';

UPDATE leads
SET created_by = NULL
WHERE created_by IS NOT NULL AND created_by::text = '';

-- Fix contacts table
UPDATE contacts
SET assigned_to = NULL
WHERE assigned_to IS NOT NULL AND assigned_to::text = '';

UPDATE contacts
SET created_by = NULL
WHERE created_by IS NOT NULL AND created_by::text = '';

-- Fix custom_field_values table
UPDATE custom_field_values
SET created_by = NULL
WHERE created_by IS NOT NULL AND created_by::text = '';

UPDATE custom_field_values
SET updated_by = NULL
WHERE updated_by IS NOT NULL AND updated_by::text = '';

-- =====================================================
-- 4. ADD COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION sanitize_uuid_fields() IS
  'Automatically converts empty string UUID values to NULL before INSERT/UPDATE.
   Prevents "invalid input syntax for type uuid" errors.';

-- =====================================================
-- 5. VERIFY MIGRATION
-- =====================================================

-- Check that triggers were created
DO $$
DECLARE
  trigger_count integer;
BEGIN
  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_name LIKE 'sanitize_uuid_%';

  IF trigger_count < 7 THEN
    RAISE EXCEPTION 'Migration incomplete: Expected at least 7 triggers, found %', trigger_count;
  END IF;

  RAISE NOTICE 'Migration successful: % UUID sanitization triggers created', trigger_count;
END $$;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================

-- To rollback this migration, run:
/*
BEGIN;

DROP TRIGGER IF EXISTS sanitize_uuid_lead_interactions ON lead_interactions;
DROP TRIGGER IF EXISTS sanitize_uuid_contact_interactions ON contact_interactions;
DROP TRIGGER IF EXISTS sanitize_uuid_leads ON leads;
DROP TRIGGER IF EXISTS sanitize_uuid_contacts ON contacts;
DROP TRIGGER IF EXISTS sanitize_uuid_accounts ON accounts;
DROP TRIGGER IF EXISTS sanitize_uuid_transactions ON transactions;
DROP TRIGGER IF EXISTS sanitize_uuid_custom_field_values ON custom_field_values;

DROP FUNCTION IF EXISTS sanitize_uuid_fields();

COMMIT;
*/

-- =====================================================
-- TESTING
-- =====================================================

-- Test that empty strings are now converted to NULL:
/*
-- This should insert NULL, not empty string:
INSERT INTO lead_interactions (
  organization_id, lead_id, user_id, interaction_type, description
) VALUES (
  'some-valid-uuid', 'some-valid-uuid', '', 'note', 'Test'
);

-- Verify user_id is NULL:
SELECT user_id, user_id IS NULL as is_null
FROM lead_interactions
WHERE description = 'Test';
*/
