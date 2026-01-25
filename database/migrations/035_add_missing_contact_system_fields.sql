-- Migration 035: Add Missing Contact System Fields
-- Purpose: Adds 6 missing contact system fields to default_field_configurations
-- These fields are core to the contact module but were not yet configured

BEGIN;

-- Insert missing contact system fields for all organizations
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
  'contacts' AS entity_type,
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
    ('address', 'Address', 'text', true, false, false, true, true, true, 18),
    ('city', 'City', 'text', true, false, false, true, true, true, 19),
    ('state', 'State/Province', 'text', true, false, false, true, true, true, 20),
    ('country', 'Country', 'text', true, false, false, true, true, true, 21),
    ('postal_code', 'Postal Code', 'text', true, false, false, true, true, true, 22),
    ('customer_value', 'Customer Value', 'number', false, false, false, true, true, true, 23)
) AS field_config(
  field_name, field_label, field_type, is_enabled, is_required,
  show_in_list_view, show_in_detail_view, show_in_create_form, show_in_edit_form, display_order
)
WHERE NOT EXISTS (
  SELECT 1 FROM default_field_configurations dfc
  WHERE dfc.organization_id = org.id
  AND dfc.entity_type = 'contacts'
  AND dfc.field_name = field_config.field_name
);

COMMIT;
