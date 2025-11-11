-- Migration: Add custom_fields column to leads table
-- This allows storing custom field values as JSONB

-- Add custom_fields column to leads table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads'
    AND column_name = 'custom_fields'
  ) THEN
    ALTER TABLE leads ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;

    -- Add index for better query performance on custom fields
    CREATE INDEX IF NOT EXISTS idx_leads_custom_fields ON leads USING gin(custom_fields);

    RAISE NOTICE 'Added custom_fields column to leads table';
  ELSE
    RAISE NOTICE 'custom_fields column already exists in leads table';
  END IF;
END $$;
