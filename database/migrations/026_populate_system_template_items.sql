-- Migration: 026_populate_system_template_items.sql
-- Description: Populate field mapping template items for system templates
-- Author: Development Team
-- Date: 2026-01-13
-- Dependencies: 024_field_mapping_system.sql must have run first

BEGIN;

-- ============================================================================
-- Clear any existing system template items to avoid duplicates
-- ============================================================================
DELETE FROM field_mapping_template_items
WHERE template_id IN (
  SELECT id FROM field_mapping_templates WHERE is_system_template = true
);

-- ============================================================================
-- 1. FULL CONVERSION TEMPLATE
-- Creates contact, account, and transaction with all standard fields
-- ============================================================================
INSERT INTO field_mapping_template_items (
  template_id, source_entity, source_field, source_field_type,
  target_entity, target_field, target_field_type,
  is_editable, is_required, is_visible, transformation_type,
  display_order, display_label
)
SELECT
  t.id, v.source_entity, v.source_field, v.source_field_type,
  v.target_entity, v.target_field, v.target_field_type,
  v.is_editable, v.is_required, v.is_visible, v.transformation_type,
  v.display_order, v.display_label
FROM field_mapping_templates t
CROSS JOIN (VALUES
  -- Contact field mappings
  ('leads', 'first_name', 'text', 'contacts', 'first_name', 'text', true, true, true, 'none', 1, 'First Name'),
  ('leads', 'last_name', 'text', 'contacts', 'last_name', 'text', true, true, true, 'none', 2, 'Last Name'),
  ('leads', 'email', 'text', 'contacts', 'email', 'text', true, false, true, 'none', 3, 'Email'),
  ('leads', 'phone', 'text', 'contacts', 'phone', 'text', true, false, true, 'none', 4, 'Phone'),
  ('leads', 'title', 'text', 'contacts', 'title', 'text', true, false, true, 'none', 5, 'Title'),
  -- Account field mappings
  ('leads', 'company', 'text', 'accounts', 'account_name', 'text', true, true, true, 'none', 10, 'Account Name'),
  ('leads', 'email', 'text', 'accounts', 'email', 'text', true, false, true, 'none', 11, 'Account Email'),
  ('leads', 'phone', 'text', 'accounts', 'phone', 'text', true, false, true, 'none', 12, 'Account Phone'),
  -- Transaction field mappings
  ('leads', 'company', 'text', 'transactions', 'description', 'text', true, false, true, 'none', 20, 'Transaction Description')
) AS v(source_entity, source_field, source_field_type, target_entity, target_field, target_field_type, is_editable, is_required, is_visible, transformation_type, display_order, display_label)
WHERE t.template_slug = 'full-conversion';

-- ============================================================================
-- 2. CONTACT ONLY TEMPLATE
-- Convert lead to contact without creating account or transaction
-- ============================================================================
INSERT INTO field_mapping_template_items (
  template_id, source_entity, source_field, source_field_type,
  target_entity, target_field, target_field_type,
  is_editable, is_required, is_visible, transformation_type,
  display_order, display_label
)
SELECT
  t.id, v.source_entity, v.source_field, v.source_field_type,
  v.target_entity, v.target_field, v.target_field_type,
  v.is_editable, v.is_required, v.is_visible, v.transformation_type,
  v.display_order, v.display_label
FROM field_mapping_templates t
CROSS JOIN (VALUES
  -- Contact field mappings only
  ('leads', 'first_name', 'text', 'contacts', 'first_name', 'text', true, true, true, 'none', 1, 'First Name'),
  ('leads', 'last_name', 'text', 'contacts', 'last_name', 'text', true, true, true, 'none', 2, 'Last Name'),
  ('leads', 'email', 'text', 'contacts', 'email', 'text', true, false, true, 'none', 3, 'Email'),
  ('leads', 'phone', 'text', 'contacts', 'phone', 'text', true, false, true, 'none', 4, 'Phone'),
  ('leads', 'title', 'text', 'contacts', 'title', 'text', true, false, true, 'none', 5, 'Title'),
  ('leads', 'company', 'text', 'contacts', 'company', 'text', true, false, true, 'none', 6, 'Company'),
  ('leads', 'notes', 'text', 'contacts', 'notes', 'text', true, false, true, 'none', 7, 'Notes')
) AS v(source_entity, source_field, source_field_type, target_entity, target_field, target_field_type, is_editable, is_required, is_visible, transformation_type, display_order, display_label)
WHERE t.template_slug = 'contact-only';

-- ============================================================================
-- 3. ADD DEVICE TEMPLATE
-- Add new subscription account to existing contact
-- ============================================================================
INSERT INTO field_mapping_template_items (
  template_id, source_entity, source_field, source_field_type,
  target_entity, target_field, target_field_type,
  is_editable, is_required, is_visible, transformation_type,
  display_order, display_label
)
SELECT
  t.id, v.source_entity, v.source_field, v.source_field_type,
  v.target_entity, v.target_field, v.target_field_type,
  v.is_editable, v.is_required, v.is_visible, v.transformation_type,
  v.display_order, v.display_label
FROM field_mapping_templates t
CROSS JOIN (VALUES
  -- Account/Device field mappings
  ('leads', 'company', 'text', 'accounts', 'account_name', 'text', true, true, true, 'none', 1, 'Device/Account Name'),
  ('leads', 'email', 'text', 'accounts', 'email', 'text', true, false, true, 'none', 2, 'Account Email'),
  ('leads', 'phone', 'text', 'accounts', 'phone', 'text', true, false, true, 'none', 3, 'Account Phone'),
  ('leads', 'notes', 'text', 'accounts', 'notes', 'text', true, false, true, 'none', 4, 'Notes')
) AS v(source_entity, source_field, source_field_type, target_entity, target_field, target_field_type, is_editable, is_required, is_visible, transformation_type, display_order, display_label)
WHERE t.template_slug = 'add-device';

-- ============================================================================
-- 4. TRIAL CONVERSION TEMPLATE
-- Convert free trial lead to paid customer with transaction
-- ============================================================================
INSERT INTO field_mapping_template_items (
  template_id, source_entity, source_field, source_field_type,
  target_entity, target_field, target_field_type,
  is_editable, is_required, is_visible, transformation_type,
  display_order, display_label
)
SELECT
  t.id, v.source_entity, v.source_field, v.source_field_type,
  v.target_entity, v.target_field, v.target_field_type,
  v.is_editable, v.is_required, v.is_visible, v.transformation_type,
  v.display_order, v.display_label
FROM field_mapping_templates t
CROSS JOIN (VALUES
  -- Contact field mappings
  ('leads', 'first_name', 'text', 'contacts', 'first_name', 'text', true, true, true, 'none', 1, 'First Name'),
  ('leads', 'last_name', 'text', 'contacts', 'last_name', 'text', true, true, true, 'none', 2, 'Last Name'),
  ('leads', 'email', 'text', 'contacts', 'email', 'text', true, true, true, 'none', 3, 'Email'),
  ('leads', 'phone', 'text', 'contacts', 'phone', 'text', true, false, true, 'none', 4, 'Phone'),
  -- Account field mappings
  ('leads', 'company', 'text', 'accounts', 'account_name', 'text', true, true, true, 'none', 10, 'Account Name'),
  ('leads', 'email', 'text', 'accounts', 'email', 'text', true, false, true, 'none', 11, 'Account Email'),
  -- Transaction field mappings for trial conversion
  ('leads', 'company', 'text', 'transactions', 'description', 'text', true, false, true, 'none', 20, 'Subscription Description')
) AS v(source_entity, source_field, source_field_type, target_entity, target_field, target_field_type, is_editable, is_required, is_visible, transformation_type, display_order, display_label)
WHERE t.template_slug = 'trial-conversion';

-- ============================================================================
-- 5. UPGRADE CONVERSION TEMPLATE
-- Upgrade existing customer to higher tier
-- ============================================================================
INSERT INTO field_mapping_template_items (
  template_id, source_entity, source_field, source_field_type,
  target_entity, target_field, target_field_type,
  is_editable, is_required, is_visible, transformation_type,
  display_order, display_label
)
SELECT
  t.id, v.source_entity, v.source_field, v.source_field_type,
  v.target_entity, v.target_field, v.target_field_type,
  v.is_editable, v.is_required, v.is_visible, v.transformation_type,
  v.display_order, v.display_label
FROM field_mapping_templates t
CROSS JOIN (VALUES
  -- Transaction field mappings for upgrade
  ('leads', 'company', 'text', 'transactions', 'description', 'text', true, false, true, 'none', 1, 'Upgrade Description'),
  ('leads', 'notes', 'text', 'transactions', 'notes', 'text', true, false, true, 'none', 2, 'Upgrade Notes')
) AS v(source_entity, source_field, source_field_type, target_entity, target_field, target_field_type, is_editable, is_required, is_visible, transformation_type, display_order, display_label)
WHERE t.template_slug = 'upgrade-conversion';

-- ============================================================================
-- 6. FULL LEAD CONVERSION TEMPLATE (if exists)
-- Complete field mapping for lead to contact/account conversion
-- ============================================================================
INSERT INTO field_mapping_template_items (
  template_id, source_entity, source_field, source_field_type,
  target_entity, target_field, target_field_type,
  is_editable, is_required, is_visible, transformation_type,
  display_order, display_label
)
SELECT
  t.id, v.source_entity, v.source_field, v.source_field_type,
  v.target_entity, v.target_field, v.target_field_type,
  v.is_editable, v.is_required, v.is_visible, v.transformation_type,
  v.display_order, v.display_label
FROM field_mapping_templates t
CROSS JOIN (VALUES
  -- Contact field mappings
  ('leads', 'first_name', 'text', 'contacts', 'first_name', 'text', true, true, true, 'none', 1, 'First Name'),
  ('leads', 'last_name', 'text', 'contacts', 'last_name', 'text', true, true, true, 'none', 2, 'Last Name'),
  ('leads', 'email', 'text', 'contacts', 'email', 'text', true, false, true, 'none', 3, 'Email'),
  ('leads', 'phone', 'text', 'contacts', 'phone', 'text', true, false, true, 'none', 4, 'Phone'),
  ('leads', 'title', 'text', 'contacts', 'title', 'text', true, false, true, 'none', 5, 'Title'),
  -- Account field mappings
  ('leads', 'company', 'text', 'accounts', 'account_name', 'text', true, true, true, 'none', 10, 'Account Name'),
  ('leads', 'email', 'text', 'accounts', 'email', 'text', true, false, true, 'none', 11, 'Account Email'),
  ('leads', 'phone', 'text', 'accounts', 'phone', 'text', true, false, true, 'none', 12, 'Account Phone')
) AS v(source_entity, source_field, source_field_type, target_entity, target_field, target_field_type, is_editable, is_required, is_visible, transformation_type, display_order, display_label)
WHERE t.template_slug = 'full-lead-conversion';

-- ============================================================================
-- Verification
-- ============================================================================
-- Run after migration to verify:
-- SELECT t.template_name, COUNT(i.id) as item_count
-- FROM field_mapping_templates t
-- LEFT JOIN field_mapping_template_items i ON t.id = i.template_id
-- WHERE t.is_system_template = true
-- GROUP BY t.template_name;

COMMIT;
