-- ============================================================================
-- MIGRATION: Add 'product' as a valid entity_type
-- ============================================================================
-- This migration adds 'product' to the entity_type CHECK constraint
-- in both custom_field_definitions and custom_field_values tables.
--
-- This allows the Product Field Customization feature to store custom fields
-- for products using the same infrastructure as leads, contacts, accounts,
-- and transactions.
-- ============================================================================

-- Drop the existing CHECK constraints
ALTER TABLE custom_field_definitions
  DROP CONSTRAINT IF EXISTS custom_field_definitions_entity_type_check;

ALTER TABLE custom_field_values
  DROP CONSTRAINT IF EXISTS custom_field_values_entity_type_check;

-- Add new CHECK constraints that include 'product'
ALTER TABLE custom_field_definitions
  ADD CONSTRAINT custom_field_definitions_entity_type_check
  CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions', 'product'));

ALTER TABLE custom_field_values
  ADD CONSTRAINT custom_field_values_entity_type_check
  CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions', 'product'));

-- Add comment explaining the change
COMMENT ON CONSTRAINT custom_field_definitions_entity_type_check
  ON custom_field_definitions IS 'Ensures entity_type is one of: leads, contacts, accounts, transactions, or product';

COMMENT ON CONSTRAINT custom_field_values_entity_type_check
  ON custom_field_values IS 'Ensures entity_type is one of: leads, contacts, accounts, transactions, or product';

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed: Added "product" as valid entity_type';
  RAISE NOTICE '   Tables updated: custom_field_definitions, custom_field_values';
END $$;
