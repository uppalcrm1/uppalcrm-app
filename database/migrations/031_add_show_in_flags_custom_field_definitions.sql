-- Add per-form visibility flags to custom_field_definitions
-- Add columns (idempotent) with defaults

ALTER TABLE custom_field_definitions
  ADD COLUMN IF NOT EXISTS show_in_create_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_edit_form BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_detail_view BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_in_list_view BOOLEAN DEFAULT false;

-- Backfill any existing NULL values
UPDATE custom_field_definitions
SET
  show_in_create_form = COALESCE(show_in_create_form, true),
  show_in_edit_form = COALESCE(show_in_edit_form, true),
  show_in_detail_view = COALESCE(show_in_detail_view, true),
  show_in_list_view = COALESCE(show_in_list_view, false)
WHERE show_in_create_form IS NULL
   OR show_in_edit_form IS NULL
   OR show_in_detail_view IS NULL
   OR show_in_list_view IS NULL;
