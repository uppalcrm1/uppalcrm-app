-- Debug Source Field Configuration Issue
-- Run this in your staging database to diagnose the problem

-- 1. Check if source field definitions exist for all entity types
SELECT
  o.name as organization,
  cfd.entity_type,
  cfd.field_name,
  cfd.field_label,
  jsonb_array_length(cfd.field_options) as option_count,
  cfd.is_active,
  cfd.is_enabled,
  cfd.created_at
FROM custom_field_definitions cfd
JOIN organizations o ON o.id = cfd.organization_id
WHERE cfd.field_name = 'source'
ORDER BY o.name, cfd.entity_type;

-- Expected: Should see 4 rows per organization (leads, contacts, transactions, accounts)
-- If you see 0 rows or missing 'leads', the migration didn't run properly

-- 2. Show the actual source field options for each entity type
SELECT
  entity_type,
  field_name,
  field_options
FROM custom_field_definitions
WHERE field_name = 'source'
  AND organization_id = (SELECT id FROM organizations LIMIT 1)
ORDER BY entity_type;

-- 3. Check if default_field_configurations table has conflicting data
SELECT
  field_name,
  field_options,
  is_enabled
FROM default_field_configurations
WHERE field_name = 'source'
LIMIT 5;

-- 4. Count total source field definitions
SELECT
  entity_type,
  COUNT(*) as count
FROM custom_field_definitions
WHERE field_name = 'source'
GROUP BY entity_type;
