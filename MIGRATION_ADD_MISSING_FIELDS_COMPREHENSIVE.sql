-- ============================================================================
-- COMPREHENSIVE MIGRATION SCRIPT - Add Missing Custom Field Definitions
-- Database: uppalcrm_devtest (and later staging, prod)
-- Purpose: Add 10 missing custom field definitions for leads entity
-- Date: 2026-01-24
-- ============================================================================
--
-- This script adds field definitions for database columns that exist in the
-- leads table but are not yet exposed in the custom_field_definitions table.
-- These fields currently cause "Field not found in configuration" console warnings.
--
-- Missing Fields Being Added:
--   Address Info (5): address, city, state, postal_code, country
--   Relationships (4): created_by, linked_contact_id, relationship_type, interest_type
--   Timeline (1): converted_date
--
-- ============================================================================

BEGIN TRANSACTION;

-- ============================================================================
-- 1. ADDRESS INFORMATION FIELDS (5 fields)
-- ============================================================================

-- Address field - street address
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('address', 'text', 'Address', 'leads', false,
   'visible', 'master_override', true, true, true, true, '{"placeholder":"Street address"}');

-- City field
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('city', 'text', 'City', 'leads', false,
   'visible', 'master_override', false, true, true, true, '{"placeholder":"City"}');

-- State/Province field
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('state', 'text', 'State/Province', 'leads', false,
   'visible', 'master_override', false, true, true, true, '{"placeholder":"State or Province"}');

-- Postal Code field
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('postal_code', 'text', 'Postal Code', 'leads', false,
   'visible', 'master_override', false, true, true, true, '{"placeholder":"ZIP or Postal Code"}');

-- Country field
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('country', 'text', 'Country', 'leads', false,
   'visible', 'master_override', false, true, true, true, '{"placeholder":"Country"}');

-- ============================================================================
-- 2. RELATIONSHIP & REFERENCE FIELDS (4 fields)
-- ============================================================================

-- Created By field (read-only reference to user who created the lead)
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('created_by', 'text', 'Created By', 'leads', false,
   'visible', 'master_override', false, true, false, false, '{"readonly":true}');

-- Linked Contact ID (reference to related contact)
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('linked_contact_id', 'text', 'Linked Contact', 'leads', false,
   'visible', 'master_override', false, true, true, true, '{"help_text":"Link this lead to an existing contact"}');

-- Relationship Type (describes how lead relates to contact)
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('relationship_type', 'text', 'Relationship Type', 'leads', false,
   'visible', 'master_override', false, true, true, true, '{"placeholder":"e.g. Referral, Existing Contact, etc"}');

-- Interest Type (describes lead interest category)
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('interest_type', 'text', 'Interest Type', 'leads', false,
   'visible', 'master_override', false, true, true, true, '{"placeholder":"Type of interest or inquiry"}');

-- ============================================================================
-- 3. TIMELINE FIELDS (1 field)
-- ============================================================================

-- Converted Date (timestamp when lead was converted to contact/account)
INSERT INTO custom_field_definitions
  (field_name, field_type, field_label, entity_type, is_required,
   overall_visibility, visibility_logic, show_in_list_view, show_in_detail_view,
   show_in_create_form, show_in_edit_form, field_options)
VALUES
  ('converted_date', 'date', 'Converted Date', 'leads', false,
   'visible', 'master_override', false, true, false, false, '{"readonly":true,"help_text":"Date when this lead was converted"}');

-- ============================================================================
-- COMMIT TRANSACTION
-- ============================================================================
COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these after applying migration)
-- ============================================================================
--
-- Verify all 10 new fields were added:
-- SELECT field_name, field_type, field_label, overall_visibility, entity_type
-- FROM custom_field_definitions
-- WHERE entity_type = 'leads'
-- ORDER BY field_name;
--
-- Expected Result: 13 rows
--   - 3 existing test fields (prefer_method, test_field_123, test_website_url)
--   - 10 new fields (address, city, state, postal_code, country, created_by,
--                    linked_contact_id, relationship_type, interest_type, converted_date)
--
-- Count total fields for leads:
-- SELECT COUNT(*) as total_fields FROM custom_field_definitions WHERE entity_type = 'leads';
-- Expected: 13
--
-- Check visibility settings:
-- SELECT field_name, overall_visibility, show_in_detail_view, show_in_create_form
-- FROM custom_field_definitions
-- WHERE entity_type = 'leads' AND field_name IN
--   ('address', 'city', 'state', 'postal_code', 'country', 'created_by',
--    'linked_contact_id', 'relationship_type', 'interest_type', 'converted_date');
--
-- ============================================================================
