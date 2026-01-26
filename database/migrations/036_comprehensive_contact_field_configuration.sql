-- Migration 036: Comprehensive Contact Field Configuration
-- Purpose: Apply the definitive, complete contact field configuration to all organizations
-- This ensures all organizations have consistent field visibility and settings

BEGIN;

-- Delete any existing contact field configurations to ensure clean slate
DELETE FROM default_field_configurations
WHERE entity_type = 'contacts';

-- Insert comprehensive contact field configuration for all organizations
INSERT INTO default_field_configurations (
  organization_id,
  entity_type,
  field_name,
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
    -- Primary Contact Information (1-5) - Always visible
    ('first_name', 'text', true, false, true, true, true, true, 1),
    ('last_name', 'text', true, false, true, true, true, true, 2),
    ('email', 'email', true, false, true, true, true, true, 3),
    ('phone', 'tel', true, false, true, true, true, true, 4),
    ('company', 'text', true, false, true, true, true, true, 5),

    -- Professional Information (6-8)
    ('title', 'text', true, false, false, true, true, true, 6),
    ('department', 'text', true, false, false, true, true, true, 7),
    ('linkedin', 'url', true, false, false, true, true, true, 8),

    -- Contact Categorization (9-13)
    ('type', 'select', true, false, false, true, true, true, 9),
    ('source', 'select', true, false, false, true, true, true, 10),
    ('status', 'select', true, false, false, true, true, true, 11),
    ('priority', 'select', true, false, false, true, true, true, 12),
    ('value', 'number', true, false, false, true, true, true, 13),

    -- Management Information (14-17)
    ('assigned_to', 'user_select', true, false, false, true, true, true, 14),
    ('next_follow_up', 'datetime', true, false, false, true, true, true, 15),
    ('last_contact_date', 'date', true, false, false, false, false, false, 16),
    ('notes', 'textarea', true, false, false, true, true, true, 17),

    -- Address Information (18-22)
    ('address', 'text', true, false, false, true, true, true, 18),
    ('city', 'text', true, false, false, true, true, true, 19),
    ('state', 'text', true, false, false, true, true, true, 20),
    ('country', 'text', true, false, false, true, true, true, 21),
    ('postal_code', 'text', true, false, false, true, true, true, 22),

    -- Additional Fields (23)
    ('customer_value', 'number', true, false, false, true, true, true, 23)
) AS field_config(
  field_name, field_type, is_enabled, is_required,
  show_in_list_view, show_in_detail_view, show_in_create_form, show_in_edit_form, display_order
);

COMMIT;
