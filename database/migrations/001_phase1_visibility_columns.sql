-- Migration: Phase 1 - Add visibility columns
-- Version: 001
-- Description: Adds overall_visibility and visibility_logic columns for field visibility control

BEGIN;

-- Add to custom_field_definitions
ALTER TABLE custom_field_definitions
ADD COLUMN IF NOT EXISTS overall_visibility VARCHAR(20) DEFAULT 'visible'
    CHECK (overall_visibility IN ('visible', 'hidden')),
ADD COLUMN IF NOT EXISTS visibility_logic VARCHAR(50) DEFAULT 'master_override'
    CHECK (visibility_logic IN ('master_override', 'context_based')),
ADD COLUMN IF NOT EXISTS show_in_create_form BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_edit_form BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_detail_view BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_list_view BOOLEAN DEFAULT false;

-- Add to default_field_configurations
ALTER TABLE default_field_configurations
ADD COLUMN IF NOT EXISTS overall_visibility VARCHAR(20) DEFAULT 'visible'
    CHECK (overall_visibility IN ('visible', 'hidden')),
ADD COLUMN IF NOT EXISTS visibility_logic VARCHAR(50) DEFAULT 'master_override'
    CHECK (visibility_logic IN ('master_override', 'context_based')),
ADD COLUMN IF NOT EXISTS show_in_create_form BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_edit_form BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_detail_view BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_in_list_view BOOLEAN DEFAULT false;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_custom_fields_overall_visibility
    ON custom_field_definitions(organization_id, entity_type, overall_visibility);

CREATE INDEX IF NOT EXISTS idx_default_fields_overall_visibility
    ON default_field_configurations(organization_id, entity_type, overall_visibility);

-- Add comments
COMMENT ON COLUMN custom_field_definitions.overall_visibility IS
    'Phase 1: Master visibility switch. When hidden, field is invisible everywhere';
COMMENT ON COLUMN custom_field_definitions.visibility_logic IS
    'Phase 1: Visibility behavior - master_override or context_based';
COMMENT ON COLUMN custom_field_definitions.show_in_create_form IS
    'Phase 1: Show field in create forms';
COMMENT ON COLUMN custom_field_definitions.show_in_edit_form IS
    'Phase 1: Show field in edit forms';
COMMENT ON COLUMN custom_field_definitions.show_in_detail_view IS
    'Phase 1: Show field in detail view';
COMMENT ON COLUMN custom_field_definitions.show_in_list_view IS
    'Phase 1: Show field in list view';

COMMIT;
