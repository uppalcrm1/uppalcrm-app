-- Migration 034: Seed Contact Field Visibility Configuration
-- Purpose: Populate default_field_configurations with contact field visibility settings
-- This ensures all contact fields have proper visibility rules configured

BEGIN;

-- Insert or update contact field visibility configurations for all organizations
INSERT INTO default_field_configurations (
  organization_id,
  entity_type,
  field_name,
  field_label,
  field_type,
  is_enabled,
  is_required,
  is_system_field,
  show_in_list_view,
  show_in_detail_view,
  show_in_create_form,
  show_in_edit_form,
  sort_order,
  overall_visibility,
  visibility_logic
)
SELECT
  org.id,
  'contacts' AS entity_type,
  field_config.field_name,
  field_config.field_label,
  field_config.field_type,
  field_config.is_enabled,
  field_config.is_required,
  true AS is_system_field,
  field_config.show_in_list_view,
  field_config.show_in_detail_view,
  field_config.show_in_create_form,
  field_config.show_in_edit_form,
  field_config.sort_order,
  'visible' AS overall_visibility,
  'master_override' AS visibility_logic
FROM organizations org
CROSS JOIN (
  VALUES
    ('first_name', 'First Name', 'text', true, false, true, true, true, true, 1),
    ('last_name', 'Last Name', 'text', true, false, true, true, true, true, 2),
    ('email', 'Email', 'email', true, false, true, true, true, true, 3),
    ('phone', 'Phone', 'tel', true, false, true, true, true, true, 4),
    ('company', 'Company', 'text', true, false, true, true, true, true, 5),
    ('title', 'Job Title', 'text', false, false, false, true, true, true, 6),
    ('department', 'Department', 'text', false, false, false, true, true, true, 7),
    ('linkedin', 'LinkedIn Profile', 'url', false, false, false, true, true, true, 8),
    ('type', 'Type', 'select', false, false, false, true, true, true, 9),
    ('source', 'Source', 'select', false, false, false, true, true, true, 10),
    ('status', 'Status', 'select', false, false, false, true, true, true, 11),
    ('priority', 'Priority', 'select', false, false, false, true, true, true, 12),
    ('value', 'Customer Value ($)', 'number', false, false, false, true, true, true, 13),
    ('assigned_to', 'Assigned To', 'user_select', false, false, false, true, true, true, 14),
    ('next_follow_up', 'Next Follow Up', 'datetime', false, false, false, true, true, true, 15),
    ('last_contact_date', 'Last Contact Date', 'date', false, false, false, false, false, false, 16),
    ('notes', 'Notes', 'textarea', false, false, false, true, true, true, 17)
) AS field_config(
  field_name, field_label, field_type, is_enabled, is_required,
  show_in_list_view, show_in_detail_view, show_in_create_form, show_in_edit_form, sort_order
)
WHERE NOT EXISTS (
  SELECT 1 FROM default_field_configurations dfc
  WHERE dfc.organization_id = org.id
  AND dfc.entity_type = 'contacts'
  AND dfc.field_name = field_config.field_name
);

COMMIT;
