-- ============================================================================
-- STEP 1: DROP FOREIGN KEY CONSTRAINTS
-- ============================================================================
-- These foreign keys prevent us from dropping the software_licenses table.
-- They must be dropped first. All dependent tables are empty, so this is safe.

BEGIN;

-- Drop foreign key from downloads_activations
ALTER TABLE IF EXISTS downloads_activations
DROP CONSTRAINT IF EXISTS fk_downloads_activations_software_licenses CASCADE;

-- Drop foreign key from license_transfers
ALTER TABLE IF EXISTS license_transfers
DROP CONSTRAINT IF EXISTS fk_license_transfers_software_licenses CASCADE;

-- Drop foreign key from trials
ALTER TABLE IF EXISTS trials
DROP CONSTRAINT IF EXISTS fk_trials_converted_license CASCADE;

-- Alternative names that might be used:
ALTER TABLE IF EXISTS downloads_activations
DROP CONSTRAINT IF EXISTS downloads_activations_software_license_id_fkey CASCADE;

ALTER TABLE IF EXISTS license_transfers
DROP CONSTRAINT IF EXISTS license_transfers_software_license_id_fkey CASCADE;

ALTER TABLE IF EXISTS trials
DROP CONSTRAINT IF EXISTS trials_converted_license_id_fkey CASCADE;

COMMIT;

-- Verify foreign keys are dropped
SELECT
  tc.table_name,
  constraint_name,
  'DROPPED' as status
FROM information_schema.table_constraints tc
WHERE tc.constraint_type = 'FOREIGN KEY'
AND (
  tc.table_name IN ('downloads_activations', 'license_transfers', 'trials')
)
AND (
  constraint_name ILIKE '%software_license%'
  OR constraint_name ILIKE '%converted_license%'
);
