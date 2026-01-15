-- Add per-form visibility flags to default_field_configurations
-- Add columns (idempotent) and backfill existing NULLs to TRUE

ALTER TABLE default_field_configurations
  ADD COLUMN IF NOT EXISTS show_in_create_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_edit_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_detail_view BOOLEAN DEFAULT true;

-- Backfill any existing NULL values
UPDATE default_field_configurations
SET show_in_create_form = true, show_in_edit_form = true, show_in_detail_view = true
WHERE show_in_create_form IS NULL OR show_in_edit_form IS NULL OR show_in_detail_view IS NULL;
