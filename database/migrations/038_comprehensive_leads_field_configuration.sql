-- Migration 038: Comprehensive Leads Field Configuration
-- Purpose: Populate default_field_configurations with all lead system fields
-- This ensures all lead fields have proper visibility and configuration rules
-- Executes for all existing organizations (multi-tenant compatible)

BEGIN;

-- Insert or update leads field visibility configurations
-- Using only columns that definitely exist in the table
INSERT INTO default_field_configurations (
  organization_id,
  entity_type,
  field_name,
  is_enabled,
  is_required,
  show_in_list_view,
  show_in_detail_view,
  show_in_create_form,
  show_in_edit_form
)
SELECT
  org.id,
  'leads' AS entity_type,
  field_config.field_name,
  field_config.is_enabled,
  field_config.is_required,
  field_config.show_in_list_view,
  field_config.show_in_detail_view,
  field_config.show_in_create_form,
  field_config.show_in_edit_form
FROM organizations org
CROSS JOIN (
  VALUES
    -- Contact Information (primary)
    ('first_name', true, false, true, true, true, true),
    ('last_name', true, false, true, true, true, true),
    ('email', true, false, true, true, true, true),
    ('phone', true, false, true, true, true, true),
    ('company', true, false, true, true, true, true),

    -- Lead Status & Management
    ('status', true, false, false, true, true, true),
    ('source', true, false, false, true, true, true),
    ('priority', true, false, false, true, true, true),
    ('assigned_to', true, false, false, true, true, true),
    ('next_follow_up', false, false, false, true, true, true),

    -- Valuation
    ('potential_value', false, false, false, true, true, true),

    -- Timeline & History
    ('last_contact_date', false, false, false, false, false, false),
    ('created_at', false, false, false, false, false, false),
    ('converted_date', false, false, false, false, false, false),

    -- Notes & Comments
    ('notes', false, false, false, true, true, true)
) AS field_config(
  field_name, is_enabled, is_required,
  show_in_list_view, show_in_detail_view, show_in_create_form, show_in_edit_form
)
WHERE NOT EXISTS (
  SELECT 1 FROM default_field_configurations dfc
  WHERE dfc.organization_id = org.id
  AND dfc.entity_type = 'leads'
  AND dfc.field_name = field_config.field_name
);

COMMIT;

-- Verification: Count total leads fields configured
-- SELECT COUNT(*) as total_fields FROM default_field_configurations WHERE entity_type = 'leads' LIMIT 1;
-- Expected: 15 fields per organization
