-- ========================================
-- FIX CUSTOM FIELDS SCHEMA
-- ========================================
-- Update existing custom fields tables to match the CustomField model expectations

-- ========================================
-- UPDATE custom_field_definitions
-- ========================================

-- Add missing columns to custom_field_definitions
ALTER TABLE custom_field_definitions
  ADD COLUMN IF NOT EXISTS field_description TEXT,
  ADD COLUMN IF NOT EXISTS is_filterable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_list_view BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_in_detail_view BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_create_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_edit_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS validation_rules JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS placeholder TEXT,
  ADD COLUMN IF NOT EXISTS field_group VARCHAR(100),
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Copy placeholder_text to placeholder if it exists
UPDATE custom_field_definitions
SET placeholder = placeholder_text
WHERE placeholder IS NULL AND placeholder_text IS NOT NULL;

-- Copy help_text to field_description if it exists
UPDATE custom_field_definitions
SET field_description = help_text
WHERE field_description IS NULL AND help_text IS NOT NULL;

-- Ensure display_order has default value
ALTER TABLE custom_field_definitions
  ALTER COLUMN display_order SET DEFAULT 0;

UPDATE custom_field_definitions
SET display_order = COALESCE(display_order, sort_order, 0)
WHERE display_order IS NULL;

-- ========================================
-- UPDATE custom_field_values
-- ========================================

-- Add the field_value JSONB column
ALTER TABLE custom_field_values
  ADD COLUMN IF NOT EXISTS field_value JSONB,
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id);

-- Migrate existing data to field_value column
-- This combines all the separate value columns into a single JSONB column
UPDATE custom_field_values
SET field_value = CASE
  WHEN value_text IS NOT NULL THEN jsonb_build_object('value', value_text)
  WHEN value_number IS NOT NULL THEN jsonb_build_object('value', value_number)
  WHEN value_date IS NOT NULL THEN jsonb_build_object('value', value_date::text)
  WHEN value_boolean IS NOT NULL THEN jsonb_build_object('value', value_boolean)
  WHEN value_json IS NOT NULL THEN value_json
  ELSE '{}'::jsonb
END
WHERE field_value IS NULL;

-- ========================================
-- ADD CONSTRAINTS
-- ========================================

-- Add check constraint for entity_type on custom_field_definitions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_field_definitions_entity_type_check'
  ) THEN
    ALTER TABLE custom_field_definitions
      ADD CONSTRAINT custom_field_definitions_entity_type_check
      CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions'));
  END IF;
END $$;

-- Add check constraint for field_type if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_field_definitions_field_type_check'
  ) THEN
    ALTER TABLE custom_field_definitions
      ADD CONSTRAINT custom_field_definitions_field_type_check
      CHECK (field_type IN (
        'text', 'number', 'email', 'phone', 'url', 'date', 'datetime',
        'textarea', 'select', 'multiselect', 'checkbox', 'radio'
      ));
  END IF;
END $$;

-- Add check constraint for entity_type on custom_field_values if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_field_values_entity_type_check'
  ) THEN
    ALTER TABLE custom_field_values
      ADD CONSTRAINT custom_field_values_entity_type_check
      CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions'));
  END IF;
END $$;

-- ========================================
-- CREATE/UPDATE INDEXES
-- ========================================

-- Custom field definitions indexes
CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_org_entity
  ON custom_field_definitions(organization_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_active
  ON custom_field_definitions(organization_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_display_order
  ON custom_field_definitions(organization_id, entity_type, display_order);

CREATE INDEX IF NOT EXISTS idx_custom_field_definitions_searchable
  ON custom_field_definitions(organization_id, entity_type, is_searchable)
  WHERE is_searchable = true;

-- Custom field values indexes
CREATE INDEX IF NOT EXISTS idx_custom_field_values_org
  ON custom_field_values(organization_id);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity
  ON custom_field_values(organization_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_field_def
  ON custom_field_values(field_definition_id);

-- GIN index for JSONB field_value to enable efficient querying
CREATE INDEX IF NOT EXISTS idx_custom_field_values_jsonb
  ON custom_field_values USING GIN (field_value);

-- ========================================
-- CREATE/UPDATE TRIGGERS
-- ========================================

-- Trigger to update updated_at timestamp on custom_field_definitions
CREATE OR REPLACE FUNCTION update_custom_field_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custom_field_definitions_updated_at ON custom_field_definitions;
CREATE TRIGGER trigger_custom_field_definitions_updated_at
  BEFORE UPDATE ON custom_field_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_field_definitions_updated_at();

-- Trigger to update updated_at timestamp on custom_field_values
CREATE OR REPLACE FUNCTION update_custom_field_values_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_custom_field_values_updated_at ON custom_field_values;
CREATE TRIGGER trigger_custom_field_values_updated_at
  BEFORE UPDATE ON custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_field_values_updated_at();

-- ========================================
-- CREATE VIEW
-- ========================================

-- Drop existing view if exists
DROP VIEW IF EXISTS custom_fields_with_values;

-- View to join custom field definitions with their values
CREATE OR REPLACE VIEW custom_fields_with_values AS
SELECT
  cfd.id as field_id,
  cfd.organization_id,
  cfd.field_name,
  cfd.field_label,
  cfd.field_description,
  cfd.entity_type,
  cfd.field_type,
  cfd.is_required,
  cfd.field_options,
  cfd.default_value,
  cfd.placeholder,
  cfd.field_group,
  cfd.display_order,
  cfd.show_in_list_view,
  cfd.show_in_detail_view,
  cfv.id as value_id,
  cfv.entity_id,
  cfv.field_value,
  cfv.created_at as value_created_at,
  cfv.updated_at as value_updated_at
FROM custom_field_definitions cfd
LEFT JOIN custom_field_values cfv ON cfd.id = cfv.field_definition_id
WHERE cfd.is_active = true
ORDER BY cfd.display_order;
