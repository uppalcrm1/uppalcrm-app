-- PostgreSQL Queries for custom_field_definitions Analysis
-- Database: uppalcrm_devtest
-- Generated: 2026-01-24

-- ============================================================================
-- QUERY 1: Table Schema - Show all columns with data types and nullability
-- ============================================================================
SELECT 
  ordinal_position,
  column_name, 
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'custom_field_definitions' 
ORDER BY ordinal_position;

-- Result: 19 columns with UUIDs, text fields, booleans, JSON, and timestamps

-- ============================================================================
-- QUERY 2: Sample Data for entity_type = 'leads'
-- ============================================================================
SELECT * 
FROM custom_field_definitions 
WHERE entity_type = 'leads' 
LIMIT 10;

-- Result: 3 rows
-- Fields: test_website_url, test_field_123, prefer_method

-- ============================================================================
-- QUERY 3: Count Field Definitions per Organization
-- ============================================================================
SELECT 
  organization_id, 
  COUNT(*) as field_count 
FROM custom_field_definitions 
GROUP BY organization_id 
ORDER BY field_count DESC;

-- Result: 1 organization (4af68759-65cf-4b38-8fd5-e6f41d7a726f) with 5 fields

-- ============================================================================
-- QUERY 4: Unique Field Names for entity_type = 'leads'
-- ============================================================================
SELECT DISTINCT field_name 
FROM custom_field_definitions 
WHERE entity_type = 'leads' 
ORDER BY field_name;

-- Result:
-- - prefer_method
-- - test_field_123
-- - test_website_url

-- ============================================================================
-- QUERY 5: Search for Visibility-Related Tables
-- ============================================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name ILIKE '%visibility%';

-- Result: No dedicated visibility tables found

-- ============================================================================
-- QUERY 6: Find Visibility-Related Columns Across Database
-- ============================================================================
SELECT 
  table_name, 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE column_name ILIKE '%visibility%' 
OR column_name ILIKE '%visible%'
ORDER BY table_name, column_name;

-- Result: Found in custom_field_definitions, default_field_configurations, 
-- field_mapping_configurations, and pg_class

-- ============================================================================
-- QUERY 7: All Entity Types in Table
-- ============================================================================
SELECT 
  DISTINCT entity_type, 
  COUNT(*) as count
FROM custom_field_definitions 
GROUP BY entity_type
ORDER BY entity_type;

-- Result:
-- - leads: 3
-- - accounts: 1
-- - contacts: 1

-- ============================================================================
-- QUERY 8: Overall Visibility Values Distribution
-- ============================================================================
SELECT 
  DISTINCT overall_visibility, 
  COUNT(*) as count
FROM custom_field_definitions 
GROUP BY overall_visibility
ORDER BY overall_visibility;

-- Result:
-- - hidden: 2
-- - visible: 3

-- ============================================================================
-- QUERY 9: Visibility Logic Values Distribution
-- ============================================================================
SELECT 
  DISTINCT visibility_logic, 
  COUNT(*) as count
FROM custom_field_definitions 
GROUP BY visibility_logic
ORDER BY visibility_logic;

-- Result:
-- - master_override: 5 (all records)

-- ============================================================================
-- QUERY 10: Field Types in Use
-- ============================================================================
SELECT 
  DISTINCT field_type, 
  COUNT(*) as count
FROM custom_field_definitions 
GROUP BY field_type
ORDER BY field_type;

-- Result:
-- - text: 5

-- ============================================================================
-- QUERY 11: Form & View Visibility Breakdown for Leads
-- ============================================================================
SELECT 
  field_name,
  show_in_create_form,
  show_in_edit_form,
  show_in_detail_view,
  show_in_list_view,
  overall_visibility
FROM custom_field_definitions 
WHERE entity_type = 'leads'
ORDER BY field_name;

-- Result:
-- Field visibility flags are all false despite some being marked 'visible'
-- Suggests conditional visibility logic

-- ============================================================================
-- QUERY 12: Full Record Example with All Fields
-- ============================================================================
SELECT * 
FROM custom_field_definitions 
LIMIT 1;

-- ============================================================================
-- QUERY 13: Field Options Content (JSONB Analysis)
-- ============================================================================
SELECT 
  field_name,
  field_options,
  jsonb_typeof(field_options) as options_type,
  jsonb_array_length(field_options) as options_count
FROM custom_field_definitions 
WHERE field_options IS NOT NULL;

-- Result: Currently all empty JSON arrays []

-- ============================================================================
-- QUERY 14: Audit Trail - Fields by Creation Date
-- ============================================================================
SELECT 
  field_name,
  field_label,
  entity_type,
  created_at,
  updated_at,
  created_by
FROM custom_field_definitions 
ORDER BY created_at DESC;

-- ============================================================================
-- QUERY 15: Leads Field Details with All Visibility Flags
-- ============================================================================
SELECT 
  id,
  field_name,
  field_label,
  field_type,
  is_required,
  is_enabled,
  sort_order,
  show_in_create_form,
  show_in_edit_form,
  show_in_detail_view,
  show_in_list_view,
  overall_visibility,
  visibility_logic
FROM custom_field_definitions 
WHERE entity_type = 'leads'
ORDER BY sort_order, field_name;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================
-- 1. All queries use PostgreSQL 13+ syntax
-- 2. ILIKE is case-insensitive LIKE (PostgreSQL specific)
-- 3. JSONB functions require PostgreSQL 9.4+
-- 4. UUID type is native PostgreSQL
-- 5. Always include SSL for Render-hosted databases
-- ============================================================================
