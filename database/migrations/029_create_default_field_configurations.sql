-- Migration: 029_create_default_field_configurations.sql
-- Description: Create the default_field_configurations table for system field settings
-- This table was referenced but never created, causing field visibility settings to not persist

CREATE TABLE IF NOT EXISTS default_field_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Field identification
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(255),
  field_type VARCHAR(50),
  field_options JSONB,

  -- Entity type (leads, contacts, accounts, etc.)
  entity_type VARCHAR(50) DEFAULT 'leads',

  -- Field behavior
  is_enabled BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,

  -- Visibility flags (will be added by migration 030)
  -- show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view

  -- Display configuration
  display_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_field_per_org_entity UNIQUE(organization_id, entity_type, field_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_default_field_configs_org ON default_field_configurations(organization_id);
CREATE INDEX IF NOT EXISTS idx_default_field_configs_entity ON default_field_configurations(organization_id, entity_type);

-- Comments
COMMENT ON TABLE default_field_configurations IS 'Stores per-organization configuration for system/default fields';
COMMENT ON COLUMN default_field_configurations.field_name IS 'Name of the system field (e.g., company, priority, status)';
COMMENT ON COLUMN default_field_configurations.is_enabled IS 'Whether the field is enabled at all for this organization';
COMMENT ON COLUMN default_field_configurations.entity_type IS 'Which entity type this configuration applies to (leads, contacts, accounts)';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_default_field_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trigger_default_field_config_updated_at'
  ) THEN
    CREATE TRIGGER trigger_default_field_config_updated_at
      BEFORE UPDATE ON default_field_configurations
      FOR EACH ROW
      EXECUTE FUNCTION update_default_field_config_updated_at();
  END IF;
END $$;
