-- Migration: Extend lead_interactions to support contact and account linking
-- Purpose: Allow tasks to link to contacts and accounts, not just leads
-- Date: 2026-02-11
--
-- Changes:
-- 1. Add contact_id and account_id columns to lead_interactions
-- 2. Make lead_id nullable (for tasks without a lead)
-- 3. Create indexes for performance
-- 4. Validate schema integrity

-- ============================================================================
-- STEP 1: Remove NOT NULL constraint from lead_id (if it exists)
-- ============================================================================
DO $$
BEGIN
  -- Check if lead_id has a NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'lead_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Drop the constraint by recreating without NOT NULL
    ALTER TABLE lead_interactions
    ALTER COLUMN lead_id DROP NOT NULL;

    RAISE NOTICE '✅ Removed NOT NULL constraint from lead_id column';
  ELSE
    RAISE NOTICE 'ℹ️  lead_id column already nullable or constraint already removed';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Add contact_id column
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE lead_interactions
    ADD COLUMN contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

    RAISE NOTICE '✅ Added contact_id column to lead_interactions table';
  ELSE
    RAISE NOTICE 'ℹ️  contact_id column already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Add account_id column
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'account_id'
  ) THEN
    ALTER TABLE lead_interactions
    ADD COLUMN account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

    RAISE NOTICE '✅ Added account_id column to lead_interactions table';
  ELSE
    RAISE NOTICE 'ℹ️  account_id column already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Create index on contact_id for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lead_interactions_contact_id
ON lead_interactions(contact_id);

-- ============================================================================
-- STEP 5: Create index on account_id for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lead_interactions_account_id
ON lead_interactions(account_id);

-- ============================================================================
-- STEP 6: Create composite indexes for common queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lead_interactions_by_type_and_entities
ON lead_interactions(interaction_type, lead_id, contact_id, account_id);

-- ============================================================================
-- STEP 7: Add column comments for documentation
-- ============================================================================
COMMENT ON COLUMN lead_interactions.contact_id IS 'Contact this interaction is linked to (optional - for contact-specific tasks/interactions)';
COMMENT ON COLUMN lead_interactions.account_id IS 'Account this interaction is linked to (optional - for account-specific tasks/interactions)';

-- ============================================================================
-- STEP 8: Validation and reporting
-- ============================================================================
DO $$
DECLARE
  v_lead_id_nullable BOOLEAN;
  v_contact_id_exists BOOLEAN;
  v_account_id_exists BOOLEAN;
  v_contact_id_indexed BOOLEAN;
  v_account_id_indexed BOOLEAN;
BEGIN
  -- Check if lead_id is nullable
  SELECT is_nullable = 'YES' INTO v_lead_id_nullable
  FROM information_schema.columns
  WHERE table_name = 'lead_interactions' AND column_name = 'lead_id';

  -- Check if contact_id exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions' AND column_name = 'contact_id'
  ) INTO v_contact_id_exists;

  -- Check if account_id exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions' AND column_name = 'account_id'
  ) INTO v_account_id_exists;

  -- Check if contact_id is indexed
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lead_interactions' AND indexname = 'idx_lead_interactions_contact_id'
  ) INTO v_contact_id_indexed;

  -- Check if account_id is indexed
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lead_interactions' AND indexname = 'idx_lead_interactions_account_id'
  ) INTO v_account_id_indexed;

  -- Report results
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║         MIGRATION VALIDATION REPORT                            ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';

  IF v_lead_id_nullable THEN
    RAISE NOTICE '✅ lead_id column: NULLABLE (allows tasks without leads)';
  ELSE
    RAISE WARNING '❌ lead_id column: STILL NOT NULL (migration incomplete)';
  END IF;

  IF v_contact_id_exists THEN
    RAISE NOTICE '✅ contact_id column: CREATED';
  ELSE
    RAISE WARNING '❌ contact_id column: MISSING (migration failed)';
  END IF;

  IF v_account_id_exists THEN
    RAISE NOTICE '✅ account_id column: CREATED';
  ELSE
    RAISE WARNING '❌ account_id column: MISSING (migration failed)';
  END IF;

  IF v_contact_id_indexed THEN
    RAISE NOTICE '✅ contact_id index: CREATED';
  ELSE
    RAISE WARNING '❌ contact_id index: MISSING (performance issue)';
  END IF;

  IF v_account_id_indexed THEN
    RAISE NOTICE '✅ account_id index: CREATED';
  ELSE
    RAISE WARNING '❌ account_id index: MISSING (performance issue)';
  END IF;

  RAISE NOTICE '';
  IF v_lead_id_nullable AND v_contact_id_exists AND v_account_id_exists
     AND v_contact_id_indexed AND v_account_id_indexed THEN
    RAISE NOTICE '🎉 MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tasks can now link to:';
    RAISE NOTICE '  • Lead (lead_id) - for lead-specific tasks';
    RAISE NOTICE '  • Contact (contact_id) - for contact-specific tasks';
    RAISE NOTICE '  • Account (account_id) - for account-specific tasks';
    RAISE NOTICE '  • Any combination of the above';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '⚠️  MIGRATION INCOMPLETE - some components missing';
  END IF;
END $$;
