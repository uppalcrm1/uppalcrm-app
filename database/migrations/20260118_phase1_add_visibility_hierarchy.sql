-- Phase 1: Add master override visibility control
-- This adds an overall visibility flag that acts as a master switch

-- Add to custom_field_definitions
ALTER TABLE custom_field_definitions
ADD COLUMN IF NOT EXISTS overall_visibility VARCHAR(20) DEFAULT 'visible' CHECK (overall_visibility IN ('visible', 'hidden')),
ADD COLUMN IF NOT EXISTS visibility_logic VARCHAR(50) DEFAULT 'master_override' CHECK (visibility_logic IN ('master_override', 'context_based'));

-- Add to default_field_configurations
ALTER TABLE default_field_configurations
ADD COLUMN IF NOT EXISTS overall_visibility VARCHAR(20) DEFAULT 'visible' CHECK (overall_visibility IN ('visible', 'hidden')),
ADD COLUMN IF NOT EXISTS visibility_logic VARCHAR(50) DEFAULT 'master_override' CHECK (visibility_logic IN ('master_override', 'context_based'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_custom_fields_visibility
ON custom_field_definitions(organization_id, entity_type, overall_visibility);

CREATE INDEX IF NOT EXISTS idx_default_fields_visibility
ON default_field_configurations(organization_id, entity_type, overall_visibility);

-- Add comments for documentation
COMMENT ON COLUMN custom_field_definitions.overall_visibility IS
'Phase 1: Master visibility switch. When hidden, field is invisible everywhere regardless of context flags';

COMMENT ON COLUMN custom_field_definitions.visibility_logic IS
'Phase 1: Determines visibility behavior. master_override = overall_visibility controls all, context_based = individual flags control (future Phase 3)';

COMMENT ON COLUMN default_field_configurations.overall_visibility IS
'Phase 1: Master visibility switch. When hidden, field is invisible everywhere regardless of context flags';

COMMENT ON COLUMN default_field_configurations.visibility_logic IS
'Phase 1: Determines visibility behavior. master_override = overall_visibility controls all, context_based = individual flags control (future Phase 3)';

-- Migration note: All existing fields default to 'visible' with 'master_override' logic
-- This maintains current behavior while adding the new hierarchy
