-- Migration: Make user_id nullable for inbound interactions
-- Purpose: Allow inbound SMS/WhatsApp interactions without an associated user
-- Date: 2026-03-04
--
-- Changes:
-- 1. Remove NOT NULL constraint from user_id column in lead_interactions
-- 2. This allows inbound messages (no agent involved) to be recorded as interactions

DO $$
BEGIN
  -- Check if user_id has a NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'user_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Drop the NOT NULL constraint by altering the column
    ALTER TABLE lead_interactions
    ALTER COLUMN user_id DROP NOT NULL;

    RAISE NOTICE '✅ Removed NOT NULL constraint from user_id column in lead_interactions';
  ELSE
    RAISE NOTICE 'ℹ️  user_id column already nullable';
  END IF;
END $$;

-- Add column comment
COMMENT ON COLUMN lead_interactions.user_id IS 'User who created this interaction (NULL for auto-generated inbound interactions like incoming SMS/WhatsApp)';
