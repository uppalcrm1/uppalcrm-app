-- Migration: 027_remove_field_mapping_templates.sql
-- Description: Remove template-based field mapping system, keep simple field mappings
-- Author: Development Team
-- Date: 2026-01-14

BEGIN;

-- ============================================================================
-- DROP TEMPLATE-RELATED TABLES
-- ============================================================================

-- Drop template items first (has foreign key to templates)
DROP TABLE IF EXISTS field_mapping_template_items CASCADE;

-- Drop templates table
DROP TABLE IF EXISTS field_mapping_templates CASCADE;

-- Drop transformation rules (was used with templates)
DROP TABLE IF EXISTS field_transformation_rules CASCADE;

-- Drop conversion history (template-related tracking)
DROP TABLE IF EXISTS conversion_field_history CASCADE;

-- Drop mapping statistics
DROP TABLE IF EXISTS field_mapping_statistics CASCADE;

-- ============================================================================
-- KEEP field_mapping_configurations table but simplify it
-- This table stores the actual field mappings admins configure
-- ============================================================================

-- The field_mapping_configurations table remains for simple field mappings

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run after migration:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'field_%';
-- Should only show: field_mapping_configurations

COMMIT;
