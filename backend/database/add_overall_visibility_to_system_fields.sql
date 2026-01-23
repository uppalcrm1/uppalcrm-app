-- Migration: Add overall_visibility column to default_field_configurations
-- Purpose: Support master visibility toggle for system fields (Phase 1c fix)

-- Add column if it doesn't exist
ALTER TABLE IF EXISTS default_field_configurations
ADD COLUMN IF NOT EXISTS overall_visibility VARCHAR(20) DEFAULT 'visible' CHECK (overall_visibility IN ('visible', 'hidden'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_default_field_configs_visibility
ON default_field_configurations(organization_id, overall_visibility);

-- Log the migration
SELECT now() AS migration_timestamp, 'add_overall_visibility_to_system_fields' AS migration_name;
