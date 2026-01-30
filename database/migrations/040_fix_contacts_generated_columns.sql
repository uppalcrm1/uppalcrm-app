-- Migration 040: Fix Contact Status/Source Generated Columns
-- Purpose: Drop read-only generated columns and rename actual columns
-- Issue: PRODUCTION has status/source as generated (read-only) columns
--        DEVTEST/STAGING have status/source as real columns
-- Solution: Make PRODUCTION match DEVTEST/STAGING schema
-- 
-- Current (PRODUCTION):
--   contact_status (real) | contact_source (real)
--   status (generated from contact_status, read-only)
--   source (generated from contact_source, read-only)
-- 
-- After (matching DEVTEST/STAGING):
--   status (real) | source (real)
--   contact_status removed | contact_source removed

BEGIN;

-- Step 1: Drop the read-only generated columns
-- These prevent updates and are causing the bug
ALTER TABLE contacts DROP COLUMN IF EXISTS status CASCADE;
ALTER TABLE contacts DROP COLUMN IF EXISTS source CASCADE;

-- Step 2: Rename the actual columns to match DEVTEST/STAGING schema
ALTER TABLE contacts RENAME COLUMN contact_status TO status;
ALTER TABLE contacts RENAME COLUMN contact_source TO source;

-- Step 3: Update indexes (if any reference the old names)
-- The old indexes should be automatically updated by PostgreSQL

-- Step 4: Verify the changes
-- Run this query to verify:
-- SELECT column_name, is_generated FROM information_schema.columns 
-- WHERE table_name = 'contacts' AND column_name IN ('status', 'source')
-- Expected result: both should show is_generated = NEVER

COMMIT;
