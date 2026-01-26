-- Migration 037: Cleanup Duplicate LinkedIn Field
-- Purpose: Remove any duplicate linkedin field entries from default_field_configurations
-- Ensures only one definitive linkedin field configuration per organization

BEGIN;

-- Delete duplicate linkedin field entries, keeping only the first (lowest ID) per organization
DELETE FROM default_field_configurations
WHERE entity_type = 'contacts'
AND field_name = 'linkedin'
AND id NOT IN (
  SELECT MIN(id)
  FROM default_field_configurations
  WHERE entity_type = 'contacts'
  AND field_name = 'linkedin'
  GROUP BY organization_id
);

-- Ensure all linkedin fields have consistent configuration
UPDATE default_field_configurations
SET
  field_label = 'LinkedIn Profile',
  field_type = 'url',
  is_enabled = true,
  is_required = false,
  is_system_field = true,
  show_in_list_view = false,
  show_in_detail_view = true,
  show_in_create_form = true,
  show_in_edit_form = true,
  sort_order = 8,
  overall_visibility = 'visible',
  visibility_logic = 'master_override'
WHERE entity_type = 'contacts'
AND field_name = 'linkedin';

COMMIT;
