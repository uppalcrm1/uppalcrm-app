-- Migration: Rename completed_by to last_modified_by
-- Purpose: Make column name more semantic - tracks ANY modification, not just completion
-- Date: 2025-01-XX

-- Rename the column
DO $$
BEGIN
  -- Check if completed_by exists and last_modified_by doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'completed_by'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'last_modified_by'
  ) THEN
    -- Rename the column
    ALTER TABLE lead_interactions
    RENAME COLUMN completed_by TO last_modified_by;

    RAISE NOTICE 'Renamed completed_by to last_modified_by';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'last_modified_by'
  ) THEN
    RAISE NOTICE 'Column last_modified_by already exists, skipping rename';
  ELSE
    RAISE WARNING 'Column completed_by not found, cannot rename';
  END IF;
END $$;

-- Rename the index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lead_interactions'
    AND indexname = 'idx_lead_interactions_completed_by'
  ) THEN
    ALTER INDEX idx_lead_interactions_completed_by
    RENAME TO idx_lead_interactions_last_modified_by;

    RAISE NOTICE 'Renamed index to idx_lead_interactions_last_modified_by';
  ELSIF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lead_interactions'
    AND indexname = 'idx_lead_interactions_last_modified_by'
  ) THEN
    RAISE NOTICE 'Index idx_lead_interactions_last_modified_by already exists, skipping';
  END IF;
END $$;

-- Update the column comment
COMMENT ON COLUMN lead_interactions.last_modified_by IS 'User who last modified this interaction (including completion, updates, reassignment, etc.)';

-- Verification
DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_old_column_exists BOOLEAN;
  v_index_exists BOOLEAN;
BEGIN
  -- Check if new column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'last_modified_by'
  ) INTO v_column_exists;

  -- Check if old column still exists (should not)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lead_interactions'
    AND column_name = 'completed_by'
  ) INTO v_old_column_exists;

  -- Check if index exists
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'lead_interactions'
    AND indexname = 'idx_lead_interactions_last_modified_by'
  ) INTO v_index_exists;

  -- Report results
  IF v_column_exists AND NOT v_old_column_exists AND v_index_exists THEN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '   - last_modified_by column: EXISTS';
    RAISE NOTICE '   - completed_by column: REMOVED';
    RAISE NOTICE '   - Index idx_lead_interactions_last_modified_by: EXISTS';
  ELSE
    RAISE WARNING '⚠️ Migration verification:';
    IF v_column_exists THEN
      RAISE NOTICE '   - last_modified_by column: EXISTS';
    ELSE
      RAISE WARNING '   - last_modified_by column: MISSING';
    END IF;
    IF v_old_column_exists THEN
      RAISE WARNING '   - completed_by column: STILL EXISTS (should be renamed)';
    END IF;
    IF v_index_exists THEN
      RAISE NOTICE '   - Index: EXISTS';
    ELSE
      RAISE WARNING '   - Index: MISSING';
    END IF;
  END IF;
END $$;
