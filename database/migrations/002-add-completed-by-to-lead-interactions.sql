-- Migration: Add completed_by column to lead_interactions
-- Purpose: Track which user completed a task/interaction, removing dependency on session variables
-- Date: 2025-01-XX

-- Add completed_by column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'completed_by'
  ) THEN
    ALTER TABLE lead_interactions
    ADD COLUMN completed_by UUID REFERENCES users(id) ON DELETE SET NULL;

    RAISE NOTICE 'Added completed_by column to lead_interactions table';
  ELSE
    RAISE NOTICE 'completed_by column already exists in lead_interactions table';
  END IF;
END $$;

-- Create index for performance (only if it doesn't exist)
CREATE INDEX IF NOT EXISTS idx_lead_interactions_completed_by
ON lead_interactions(completed_by);

-- Add helpful comment
COMMENT ON COLUMN lead_interactions.completed_by IS 'User who marked this interaction as completed';

-- Verify the migration
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_index_exists BOOLEAN;
BEGIN
  -- Check if column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'completed_by'
  ) INTO v_column_exists;

  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lead_interactions'
    AND indexname = 'idx_lead_interactions_completed_by'
  ) INTO v_index_exists;

  -- Report results
  IF v_column_exists AND v_index_exists THEN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '   - completed_by column: EXISTS';
    RAISE NOTICE '   - Index on completed_by: EXISTS';
  ELSE
    RAISE WARNING '⚠️ Migration incomplete:';
    IF NOT v_column_exists THEN
      RAISE WARNING '   - completed_by column: MISSING';
    END IF;
    IF NOT v_index_exists THEN
      RAISE WARNING '   - Index on completed_by: MISSING';
    END IF;
  END IF;
END $$;
