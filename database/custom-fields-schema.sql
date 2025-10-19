-- ========================================
-- CUSTOM FIELDS SCHEMA
-- ========================================
-- This schema enables dynamic custom field definitions and values
-- for leads, contacts, accounts, and transactions
--
-- Tables:
-- 1. custom_field_definitions: Stores field metadata and configuration
-- 2. custom_field_values: Stores actual field data for each entity instance

-- ========================================
-- CUSTOM FIELD DEFINITIONS TABLE
-- ========================================
-- Stores metadata about custom fields (field names, types, validation, etc.)

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Field identification
  field_name VARCHAR(255) NOT NULL, -- Internal name (e.g., "custom_industry")
  field_label VARCHAR(255) NOT NULL, -- Display label (e.g., "Industry")
  field_description TEXT, -- Help text for users

  -- Field type and entity association
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions')),
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN (
    'text', 'number', 'email', 'phone', 'url', 'date', 'datetime',
    'textarea', 'select', 'multiselect', 'checkbox', 'radio'
  )),

  -- Field configuration
  is_required BOOLEAN DEFAULT false,
  is_searchable BOOLEAN DEFAULT true,
  is_filterable BOOLEAN DEFAULT true,

  -- Display settings
  display_order INTEGER DEFAULT 0,
  show_in_list_view BOOLEAN DEFAULT false,
  show_in_detail_view BOOLEAN DEFAULT true,
  show_in_create_form BOOLEAN DEFAULT true,
  show_in_edit_form BOOLEAN DEFAULT true,

  -- Validation rules (stored as JSONB for flexibility)
  validation_rules JSONB DEFAULT '{}'::jsonb,
  -- Example: {"min": 0, "max": 100, "pattern": "^[A-Z]{3}$"}

  -- Options for select/multiselect/radio fields
  field_options JSONB DEFAULT '[]'::jsonb,
  -- Example: [{"value": "option1", "label": "Option 1"}, {"value": "option2", "label": "Option 2"}]

  -- Default value
  default_value TEXT,

  -- Placeholder text for input fields
  placeholder TEXT,

  -- Field grouping (for organizing fields in sections)
  field_group VARCHAR(100),

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(organization_id, entity_type, field_name)
);

-- ========================================
-- CUSTOM FIELD VALUES TABLE
-- ========================================
-- Stores actual values for custom fields for each entity instance

CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Link to field definition
  field_definition_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,

  -- Entity reference (polymorphic)
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions')),
  entity_id UUID NOT NULL, -- References the specific lead/contact/account/transaction

  -- Field value (stored as JSONB for flexibility)
  field_value JSONB,
  -- Examples:
  -- Text/number/date: {"value": "some text"}
  -- Checkbox: {"value": true}
  -- Select: {"value": "option1"}
  -- Multiselect: {"value": ["option1", "option2"]}

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),

  -- Constraints
  UNIQUE(field_definition_id, entity_id)
);

-- ========================================
-- INDEXES
-- ========================================

-- Custom field definitions indexes
CREATE INDEX idx_custom_field_definitions_org_entity
  ON custom_field_definitions(organization_id, entity_type);

CREATE INDEX idx_custom_field_definitions_active
  ON custom_field_definitions(organization_id, is_active)
  WHERE is_active = true;

CREATE INDEX idx_custom_field_definitions_display_order
  ON custom_field_definitions(organization_id, entity_type, display_order);

CREATE INDEX idx_custom_field_definitions_searchable
  ON custom_field_definitions(organization_id, entity_type, is_searchable)
  WHERE is_searchable = true;

-- Custom field values indexes
CREATE INDEX idx_custom_field_values_org
  ON custom_field_values(organization_id);

CREATE INDEX idx_custom_field_values_entity
  ON custom_field_values(organization_id, entity_type, entity_id);

CREATE INDEX idx_custom_field_values_field_def
  ON custom_field_values(field_definition_id);

-- GIN index for JSONB field_value to enable efficient querying
CREATE INDEX idx_custom_field_values_jsonb
  ON custom_field_values USING GIN (field_value);

-- ========================================
-- TRIGGERS
-- ========================================

-- Trigger to update updated_at timestamp on custom_field_definitions
CREATE OR REPLACE FUNCTION update_custom_field_definitions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

CREATE TRIGGER trigger_custom_field_values_updated_at
  BEFORE UPDATE ON custom_field_values
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_field_values_updated_at();

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

-- Enable RLS on custom_field_definitions
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view custom field definitions for their organization
CREATE POLICY custom_field_definitions_select_policy ON custom_field_definitions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert custom field definitions for their organization
CREATE POLICY custom_field_definitions_insert_policy ON custom_field_definitions
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update custom field definitions for their organization
CREATE POLICY custom_field_definitions_update_policy ON custom_field_definitions
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete custom field definitions for their organization
CREATE POLICY custom_field_definitions_delete_policy ON custom_field_definitions
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Enable RLS on custom_field_values
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view custom field values for their organization
CREATE POLICY custom_field_values_select_policy ON custom_field_values
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can insert custom field values for their organization
CREATE POLICY custom_field_values_insert_policy ON custom_field_values
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can update custom field values for their organization
CREATE POLICY custom_field_values_update_policy ON custom_field_values
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- Policy: Users can delete custom field values for their organization
CREATE POLICY custom_field_values_delete_policy ON custom_field_values
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
    )
  );

-- ========================================
-- HELPER VIEWS
-- ========================================

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

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON TABLE custom_field_definitions IS 'Stores metadata and configuration for custom fields across different entity types';
COMMENT ON TABLE custom_field_values IS 'Stores actual values for custom fields for each entity instance';

COMMENT ON COLUMN custom_field_definitions.field_name IS 'Internal field identifier (snake_case, unique per entity type)';
COMMENT ON COLUMN custom_field_definitions.field_label IS 'User-facing display label';
COMMENT ON COLUMN custom_field_definitions.entity_type IS 'The entity this field belongs to: leads, contacts, accounts, or transactions';
COMMENT ON COLUMN custom_field_definitions.field_type IS 'Type of field: text, number, email, phone, url, date, datetime, textarea, select, multiselect, checkbox, radio';
COMMENT ON COLUMN custom_field_definitions.validation_rules IS 'JSONB object containing validation rules (min, max, pattern, etc.)';
COMMENT ON COLUMN custom_field_definitions.field_options IS 'JSONB array of options for select/multiselect/radio fields';

COMMENT ON COLUMN custom_field_values.field_value IS 'JSONB object containing the actual field value. Structure varies by field type.';
COMMENT ON COLUMN custom_field_values.entity_id IS 'UUID reference to the specific lead, contact, account, or transaction';
