-- Migration 038: Comprehensive Leads Field Configuration
-- Purpose: Populate default_field_configurations with all lead system fields
-- This ensures all lead fields have proper visibility and configuration rules
-- Executes for all existing organizations (multi-tenant compatible)

BEGIN;

-- Insert or update leads field visibility configurations
-- These seed the default field visibility for all organizations
INSERT INTO default_field_configurations (
  organization_id,
  entity_type,
  field_name,
  field_label,
  field_type,
  is_enabled,
  is_required,
  show_in_list_view,
  show_in_detail_view,
  show_in_create_form,
  show_in_edit_form,
  display_order
)
SELECT
  org.id,
  'leads' AS entity_type,
  field_config.field_name,
  field_config.field_label,
  field_config.field_type,
  field_config.is_enabled,
  field_config.is_required,
  field_config.show_in_list_view,
  field_config.show_in_detail_view,
  field_config.show_in_create_form,
  field_config.show_in_edit_form,
  field_config.display_order
FROM organizations org
CROSS JOIN (
  VALUES
    -- Contact Information (1-5)
    ('first_name', 'First Name', 'text', true, false, true, true, true, true, 1),
    ('last_name', 'Last Name', 'text', true, false, true, true, true, true, 2),
    ('email', 'Email', 'email', true, false, true, true, true, true, 3),
    ('phone', 'Phone', 'tel', true, false, true, true, true, true, 4),
    ('company', 'Company', 'text', true, false, true, true, true, true, 5),

    -- Lead Status & Management (6-10)
    ('status', 'Status', 'select', true, false, false, true, true, true, 6),
    ('source', 'Source', 'select', true, false, false, true, true, true, 7),
    ('priority', 'Priority', 'select', true, false, false, true, true, true, 8),
    ('assigned_to', 'Assigned To', 'user_select', true, false, false, true, true, true, 9),
    ('next_follow_up', 'Next Follow Up', 'datetime', false, false, false, true, true, true, 10),

    -- Valuation (11)
    ('potential_value', 'Potential Value ($)', 'number', false, false, false, true, true, true, 11),

    -- Timeline & History (12-14)
    ('last_contact_date', 'Last Contact Date', 'date', false, false, false, false, false, false, 12),
    ('created_at', 'Created At', 'date', false, false, false, false, false, false, 13),
    ('converted_date', 'Converted Date', 'date', false, false, false, false, false, false, 14),

    -- Notes & Comments (15)
    ('notes', 'Notes', 'textarea', false, false, false, true, true, true, 15)
) AS field_config(
  field_name, field_label, field_type, is_enabled, is_required,
  show_in_list_view, show_in_detail_view, show_in_create_form, show_in_edit_form, display_order
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
