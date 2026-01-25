-- Migration 039: Standardize Field Naming to snake_case
-- Purpose: Ensure all field configurations use consistent snake_case naming
-- This is a data integrity migration - no schema changes

BEGIN;

-- Update any camelCase field names in default_field_configurations to snake_case for leads
UPDATE default_field_configurations
SET field_name = 'first_name'
WHERE field_name IN ('firstName', 'FirstName')
  AND entity_type = 'leads';

UPDATE default_field_configurations
SET field_name = 'last_name'
WHERE field_name IN ('lastName', 'LastName')
  AND entity_type = 'leads';

UPDATE default_field_configurations
SET field_name = 'assigned_to'
WHERE field_name IN ('assignedTo', 'AssignedTo')
  AND entity_type = 'leads';

UPDATE default_field_configurations
SET field_name = 'potential_value'
WHERE field_name IN ('potentialValue', 'PotentialValue')
  AND entity_type = 'leads';

UPDATE default_field_configurations
SET field_name = 'next_follow_up'
WHERE field_name IN ('nextFollowUp', 'NextFollowUp')
  AND entity_type = 'leads';

-- Verification query (optional - can be removed in production)
-- SELECT entity_type, field_name, COUNT(*) as count
-- FROM default_field_configurations
-- WHERE entity_type = 'leads'
--   AND field_name IN ('first_name', 'last_name', 'assigned_to', 'potential_value', 'next_follow_up')
-- GROUP BY entity_type, field_name
-- ORDER BY field_name;

COMMIT;
