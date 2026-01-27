-- ============================================================================
-- DevTest Database Migration Script
-- Database: uppalcrm_devtest
-- Purpose: Add missing custom field definitions for leads entity
-- Generated: 2026-01-24
-- ============================================================================

-- Add 10 missing custom field definitions for the leads entity
-- These fields exist in the leads table but are not exposed in custom_field_definitions

BEGIN TRANSACTION;

-- Address Information Fields
INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('address', 'text', 'Address', 'leads', false);

INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('city', 'text', 'City', 'leads', false);

INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('state', 'text', 'State/Province', 'leads', false);

INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('postal_code', 'text', 'Postal Code', 'leads', false);

INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('country', 'text', 'Country', 'leads', false);

-- Relationship and Reference Fields
INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('created_by', 'text', 'Created By', 'leads', false);

INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('linked_contact_id', 'text', 'Linked Contact ID', 'leads', false);

INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('relationship_type', 'text', 'Relationship Type', 'leads', false);

INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('interest_type', 'text', 'Interest Type', 'leads', false);

-- Timeline Fields
INSERT INTO custom_field_definitions (field_name, field_type, field_label, entity_type, is_required)
VALUES ('converted_date', 'date', 'Converted Date', 'leads', false);

COMMIT;

-- ============================================================================
-- Verification Query (run after migration)
-- ============================================================================
-- SELECT field_name, field_type, field_label, entity_type, is_required
-- FROM custom_field_definitions
-- WHERE entity_type = 'leads'
-- ORDER BY field_name;
--
-- Expected result: 13 rows (3 existing test fields + 10 new fields)
-- ============================================================================
