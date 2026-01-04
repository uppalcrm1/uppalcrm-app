-- Migration: Add custom_fields column to contacts table
-- Date: 2026-01-04
-- Purpose: Enable custom fields support for contacts to allow data transfer during lead conversion
--
-- This migration adds the custom_fields JSONB column to the contacts table
-- so that custom field values (like 'App') can be copied from leads to contacts
-- during the lead conversion process.
--
-- Multi-tenant Safe: Custom fields are organization-scoped by design.

BEGIN;

-- Add custom_fields column to contacts table if it doesn't exist
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb;

-- Create GIN index on custom_fields for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields
ON contacts USING gin(custom_fields);

-- Add comment to document the column
COMMENT ON COLUMN contacts.custom_fields IS 'Organization-specific custom field data stored as JSONB. Each organization can define their own custom fields without affecting others.';

COMMIT;

-- Verify the change
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        AND column_name = 'custom_fields'
    ) THEN
        RAISE NOTICE '✅ Migration successful: custom_fields column added to contacts table';
    ELSE
        RAISE EXCEPTION '❌ Migration failed: custom_fields column not found in contacts table';
    END IF;
END $$;
