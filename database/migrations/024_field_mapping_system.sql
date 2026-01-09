-- Migration: 024_field_mapping_system.sql
-- Description: Create field mapping system for customizable lead conversion
-- Author: Development Team
-- Date: 2026-01-08
-- Dependencies: Organizations, Users, Leads, Contacts, Accounts, Transactions tables must exist

-- ============================================================================
-- MIGRATION START
-- ============================================================================

BEGIN;

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Table: field_transformation_rules
-- Purpose: Store custom JavaScript transformation functions
CREATE TABLE IF NOT EXISTS field_transformation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_name VARCHAR(100) NOT NULL,
  description TEXT,
  transformation_code TEXT NOT NULL,
  is_validated BOOLEAN DEFAULT false,
  validation_error TEXT,
  input_type VARCHAR(50) CHECK (input_type IN ('text', 'number', 'date', 'boolean', 'object', 'array', 'any')),
  output_type VARCHAR(50) CHECK (output_type IN ('text', 'number', 'date', 'boolean', 'object', 'array')),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,
  is_sandboxed BOOLEAN DEFAULT true,
  max_execution_time_ms INTEGER DEFAULT 1000 CHECK (max_execution_time_ms BETWEEN 100 AND 5000),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_rule_name_per_org UNIQUE(organization_id, rule_name),
  CONSTRAINT check_transformation_code_not_empty CHECK (length(trim(transformation_code)) > 0)
);

COMMENT ON TABLE field_transformation_rules IS 'Custom JavaScript transformation functions for field mapping';
COMMENT ON COLUMN field_transformation_rules.transformation_code IS 'JavaScript function: function transform(value, leadData) { return newValue; }';
COMMENT ON COLUMN field_transformation_rules.is_sandboxed IS 'Execute in secure sandbox to prevent malicious code';

-- Table: field_mapping_configurations
-- Purpose: Store organization-specific field mapping rules
CREATE TABLE IF NOT EXISTS field_mapping_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Source configuration
  source_entity VARCHAR(50) NOT NULL DEFAULT 'leads' CHECK (source_entity IN ('leads', 'contacts', 'accounts')),
  source_field VARCHAR(100) NOT NULL,
  source_field_type VARCHAR(50),
  source_field_path VARCHAR(255),

  -- Target configuration
  target_entity VARCHAR(50) NOT NULL CHECK (target_entity IN ('contacts', 'accounts', 'transactions')),
  target_field VARCHAR(100) NOT NULL,
  target_field_type VARCHAR(50),
  target_field_path VARCHAR(255),

  -- Mapping behavior
  is_active BOOLEAN DEFAULT true,
  is_system_mapping BOOLEAN DEFAULT false,
  is_editable_on_convert BOOLEAN DEFAULT true,
  is_required_on_convert BOOLEAN DEFAULT false,
  is_visible_on_convert BOOLEAN DEFAULT true,

  -- Transformation
  transformation_type VARCHAR(50) DEFAULT 'none' CHECK (
    transformation_type IN ('none', 'lowercase', 'uppercase', 'titlecase', 'sentencecase',
                           'trim', 'remove_special_chars', 'replace', 'concatenate', 'custom')
  ),
  transformation_rule_id UUID REFERENCES field_transformation_rules(id) ON DELETE SET NULL,

  -- Default values
  default_value TEXT,
  default_value_type VARCHAR(20) DEFAULT 'static' CHECK (default_value_type IN ('static', 'dynamic', 'formula')),

  -- Display configuration
  display_order INTEGER DEFAULT 0 CHECK (display_order >= 0),
  display_label VARCHAR(255),
  help_text TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_mapping_per_org UNIQUE(organization_id, source_entity, target_entity, source_field, target_field),
  CONSTRAINT check_custom_transformation CHECK (
    (transformation_type = 'custom' AND transformation_rule_id IS NOT NULL) OR
    (transformation_type != 'custom' AND transformation_rule_id IS NULL)
  ),
  CONSTRAINT check_required_must_be_visible CHECK (
    (is_required_on_convert = true AND is_visible_on_convert = true) OR
    (is_required_on_convert = false)
  )
);

COMMENT ON TABLE field_mapping_configurations IS 'Organization-specific field mapping rules for lead conversion';
COMMENT ON COLUMN field_mapping_configurations.source_field_path IS 'JSON path for nested fields, e.g., custom_fields.app';
COMMENT ON COLUMN field_mapping_configurations.is_system_mapping IS 'System mappings (like first_name → first_name) cannot be deleted';

-- Table: field_mapping_templates
-- Purpose: Pre-configured mapping templates
CREATE TABLE IF NOT EXISTS field_mapping_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL UNIQUE,
  template_slug VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  template_type VARCHAR(50) NOT NULL DEFAULT 'custom' CHECK (template_type IN ('system', 'industry', 'custom')),
  is_system_template BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  applies_to_entities TEXT[] DEFAULT ARRAY['contacts', 'accounts', 'transactions'],
  icon VARCHAR(50),
  color VARCHAR(20),
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT org_required_for_custom CHECK (
    (is_system_template = true AND organization_id IS NULL) OR
    (is_system_template = false AND organization_id IS NOT NULL)
  )
);

COMMENT ON TABLE field_mapping_templates IS 'Pre-configured field mapping templates for common conversion scenarios';

-- Table: field_mapping_template_items
-- Purpose: Individual field mappings within a template
CREATE TABLE IF NOT EXISTS field_mapping_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES field_mapping_templates(id) ON DELETE CASCADE,
  source_entity VARCHAR(50) NOT NULL DEFAULT 'leads' CHECK (source_entity IN ('leads', 'contacts', 'accounts')),
  source_field VARCHAR(100) NOT NULL,
  source_field_type VARCHAR(50),
  target_entity VARCHAR(50) NOT NULL CHECK (target_entity IN ('contacts', 'accounts', 'transactions')),
  target_field VARCHAR(100) NOT NULL,
  target_field_type VARCHAR(50),
  is_editable BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  is_visible BOOLEAN DEFAULT true,
  transformation_type VARCHAR(50) DEFAULT 'none',
  transformation_config JSONB,
  default_value TEXT,
  display_order INTEGER DEFAULT 0,
  display_label VARCHAR(255),
  help_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE field_mapping_template_items IS 'Individual field mappings that make up a template';

-- Table: conversion_field_history
-- Purpose: Audit trail of field changes during conversion
CREATE TABLE IF NOT EXISTS conversion_field_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  conversion_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  converted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  field_mapping_id UUID REFERENCES field_mapping_configurations(id) ON DELETE SET NULL,
  template_id UUID REFERENCES field_mapping_templates(id) ON DELETE SET NULL,
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('contacts', 'accounts', 'transactions')),
  field_name VARCHAR(100) NOT NULL,
  source_value TEXT,
  mapped_value TEXT,
  final_value TEXT,
  was_edited BOOLEAN DEFAULT false,
  transformation_applied VARCHAR(50),
  transformation_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE conversion_field_history IS 'Audit trail of field mappings applied during lead conversions';
COMMENT ON COLUMN conversion_field_history.was_edited IS 'Track if user modified the auto-populated value during conversion';

-- Table: field_mapping_statistics
-- Purpose: Track mapping usage and effectiveness
CREATE TABLE IF NOT EXISTS field_mapping_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  field_mapping_id UUID REFERENCES field_mapping_configurations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  times_used INTEGER DEFAULT 0,
  times_edited INTEGER DEFAULT 0,
  times_skipped INTEGER DEFAULT 0,
  edit_rate DECIMAL(5,2),
  success_rate DECIMAL(5,2),
  most_common_value TEXT,
  value_variance INTEGER,
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_stats_period UNIQUE(organization_id, field_mapping_id, period_start)
);

COMMENT ON TABLE field_mapping_statistics IS 'Aggregated statistics about field mapping usage and effectiveness';

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================

-- field_mapping_configurations indexes
CREATE INDEX IF NOT EXISTS idx_field_mappings_org_active
  ON field_mapping_configurations(organization_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_field_mappings_target_entity
  ON field_mapping_configurations(organization_id, target_entity, is_active);

CREATE INDEX IF NOT EXISTS idx_field_mappings_conversion
  ON field_mapping_configurations(organization_id, target_entity, is_active, display_order)
  INCLUDE (source_field, target_field, transformation_type, is_required_on_convert, is_editable_on_convert)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_field_mappings_search
  ON field_mapping_configurations
  USING GIN(to_tsvector('english', source_field || ' ' || target_field || ' ' || COALESCE(display_label, '')));

-- field_transformation_rules indexes
CREATE INDEX IF NOT EXISTS idx_transformation_rules_org
  ON field_transformation_rules(organization_id, is_validated)
  WHERE is_validated = true;

-- field_mapping_templates indexes
CREATE INDEX IF NOT EXISTS idx_templates_active_system
  ON field_mapping_templates(is_system_template, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_templates_org
  ON field_mapping_templates(organization_id)
  WHERE is_system_template = false;

CREATE INDEX IF NOT EXISTS idx_templates_search
  ON field_mapping_templates
  USING GIN(to_tsvector('english', template_name || ' ' || description));

-- field_mapping_template_items indexes
CREATE INDEX IF NOT EXISTS idx_template_items_template_id
  ON field_mapping_template_items(template_id);

-- conversion_field_history indexes
CREATE INDEX IF NOT EXISTS idx_conversion_history_lead
  ON conversion_field_history(lead_id, conversion_timestamp);

CREATE INDEX IF NOT EXISTS idx_conversion_history_org_date
  ON conversion_field_history(organization_id, conversion_timestamp DESC)
  INCLUDE (field_name, was_edited);

CREATE INDEX IF NOT EXISTS idx_conversion_history_mapping
  ON conversion_field_history(field_mapping_id, conversion_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_conversion_history_transformation_details
  ON conversion_field_history USING GIN (transformation_details);

-- field_mapping_statistics indexes
CREATE INDEX IF NOT EXISTS idx_mapping_stats_org_period
  ON field_mapping_statistics(organization_id, period_start DESC);

-- ============================================================================
-- 3. CREATE TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_field_mappings_updated_at ON field_mapping_configurations;
CREATE TRIGGER update_field_mappings_updated_at
  BEFORE UPDATE ON field_mapping_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transformation_rules_updated_at ON field_transformation_rules;
CREATE TRIGGER update_transformation_rules_updated_at
  BEFORE UPDATE ON field_transformation_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON field_mapping_templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON field_mapping_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Increment usage count when template is used
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE field_mapping_templates
  SET usage_count = usage_count + 1
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_template_usage ON conversion_field_history;
CREATE TRIGGER track_template_usage
  AFTER INSERT ON conversion_field_history
  FOR EACH ROW
  WHEN (NEW.template_id IS NOT NULL)
  EXECUTE FUNCTION increment_template_usage();

-- ============================================================================
-- 4. ENABLE ROW-LEVEL SECURITY
-- ============================================================================

ALTER TABLE field_mapping_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_transformation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_mapping_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_mapping_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_field_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_mapping_statistics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for field_mapping_configurations
DROP POLICY IF EXISTS field_mappings_org_isolation ON field_mapping_configurations;
CREATE POLICY field_mappings_org_isolation
  ON field_mapping_configurations
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- RLS Policies for field_transformation_rules
DROP POLICY IF EXISTS transformation_rules_org_isolation ON field_transformation_rules;
CREATE POLICY transformation_rules_org_isolation
  ON field_transformation_rules
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- RLS Policies for field_mapping_templates (system + org templates)
DROP POLICY IF EXISTS templates_visibility ON field_mapping_templates;
CREATE POLICY templates_visibility
  ON field_mapping_templates
  FOR SELECT
  USING (
    is_system_template = true OR
    organization_id = current_setting('app.current_organization_id', true)::UUID
  );

DROP POLICY IF EXISTS templates_org_modify ON field_mapping_templates;
CREATE POLICY templates_org_modify
  ON field_mapping_templates
  FOR INSERT
  USING (
    is_system_template = false AND
    organization_id = current_setting('app.current_organization_id', true)::UUID
  );

DROP POLICY IF EXISTS templates_org_update ON field_mapping_templates;
CREATE POLICY templates_org_update
  ON field_mapping_templates
  FOR UPDATE
  USING (
    is_system_template = false AND
    organization_id = current_setting('app.current_organization_id', true)::UUID
  );

DROP POLICY IF EXISTS templates_org_delete ON field_mapping_templates;
CREATE POLICY templates_org_delete
  ON field_mapping_templates
  FOR DELETE
  USING (
    is_system_template = false AND
    organization_id = current_setting('app.current_organization_id', true)::UUID
  );

-- RLS Policies for conversion_field_history
DROP POLICY IF EXISTS conversion_history_org_isolation ON conversion_field_history;
CREATE POLICY conversion_history_org_isolation
  ON conversion_field_history
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- RLS Policies for field_mapping_statistics
DROP POLICY IF EXISTS mapping_stats_org_isolation ON field_mapping_statistics;
CREATE POLICY mapping_stats_org_isolation
  ON field_mapping_statistics
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- ============================================================================
-- 5. INSERT DEFAULT SYSTEM TEMPLATES
-- ============================================================================

INSERT INTO field_mapping_templates (template_name, template_slug, description, is_system_template, template_type, icon, color, is_active)
VALUES
  ('Full Conversion', 'full-conversion', 'Create contact, account, and initial transaction with all standard fields mapped', true, 'system', 'users-check', '#3B82F6', true),
  ('Contact Only', 'contact-only', 'Convert lead to contact without creating account or transaction', true, 'system', 'user-plus', '#10B981', true),
  ('Add Device', 'add-device', 'Add new subscription account to existing contact', true, 'system', 'device-tablet', '#8B5CF6', true),
  ('Trial Conversion', 'trial-conversion', 'Convert free trial lead to paid customer with transaction', true, 'system', 'star', '#F59E0B', true),
  ('Upgrade Conversion', 'upgrade-conversion', 'Upgrade existing customer to higher tier', true, 'system', 'trending-up', '#EF4444', true)
ON CONFLICT (template_name) DO NOTHING;

-- ============================================================================
-- 6. CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to create default field mappings for a new organization
CREATE OR REPLACE FUNCTION create_default_field_mappings(org_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Contact Field Mappings (Standard)
  INSERT INTO field_mapping_configurations (
    organization_id, source_entity, source_field, source_field_type,
    target_entity, target_field, target_field_type,
    is_system_mapping, is_editable_on_convert, is_required_on_convert,
    is_visible_on_convert, display_order, display_label
  ) VALUES
    (org_id, 'leads', 'first_name', 'text', 'contacts', 'first_name', 'text', true, true, true, true, 1, 'First Name'),
    (org_id, 'leads', 'last_name', 'text', 'contacts', 'last_name', 'text', true, true, true, true, 2, 'Last Name'),
    (org_id, 'leads', 'email', 'email', 'contacts', 'email', 'email', true, true, false, true, 3, 'Email'),
    (org_id, 'leads', 'phone', 'phone', 'contacts', 'phone', 'phone', true, true, false, true, 4, 'Phone')
  ON CONFLICT (organization_id, source_entity, target_entity, source_field, target_field) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_default_field_mappings IS 'Creates default field mappings for a new organization';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMIT;

-- Verification queries (run after migration)
-- SELECT COUNT(*) FROM field_mapping_configurations;
-- SELECT COUNT(*) FROM field_mapping_templates WHERE is_system_template = true;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'field_%';
