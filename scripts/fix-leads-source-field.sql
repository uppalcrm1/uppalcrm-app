-- Manual Fix: Add source field definition for LEADS entity type
-- Run this if the diagnostic shows no source field for leads

-- First, delete any existing source field for leads (in case it's corrupted)
DELETE FROM custom_field_definitions
WHERE field_name = 'source' AND entity_type = 'leads';

-- Then, insert the correct source field definition for all organizations
INSERT INTO custom_field_definitions (
    organization_id,
    field_name,
    field_label,
    field_description,
    entity_type,
    field_type,
    is_required,
    is_searchable,
    is_filterable,
    display_order,
    show_in_list_view,
    show_in_detail_view,
    show_in_create_form,
    show_in_edit_form,
    field_options,
    default_value,
    placeholder,
    field_group,
    is_active,
    is_enabled,
    created_at,
    updated_at
)
SELECT
    id as organization_id,
    'source',
    'Source',
    'How this lead was acquired',
    'leads',
    'select',
    false,  -- Not required
    true,   -- Searchable
    true,   -- Filterable
    10,     -- Display order
    true,   -- Show in list view
    true,   -- Show in detail view
    true,   -- Show in create form
    true,   -- Show in edit form
    '[
        {"value": "website", "label": "Website"},
        {"value": "referral", "label": "Referral"},
        {"value": "social-media", "label": "Social Media"},
        {"value": "cold-call", "label": "Cold Call"},
        {"value": "email", "label": "Email"},
        {"value": "advertisement", "label": "Advertisement"},
        {"value": "trade-show", "label": "Trade Show"},
        {"value": "other", "label": "Other"}
    ]'::jsonb,
    'website',  -- Default value
    'Select source',
    'Lead Information',
    true,   -- Active
    true,   -- Enabled
    NOW(),
    NOW()
FROM organizations;

-- Verify the fix
SELECT
    o.name as organization,
    cfd.entity_type,
    cfd.field_name,
    jsonb_array_length(cfd.field_options) as option_count,
    cfd.is_enabled
FROM custom_field_definitions cfd
JOIN organizations o ON o.id = cfd.organization_id
WHERE cfd.field_name = 'source' AND cfd.entity_type = 'leads';
