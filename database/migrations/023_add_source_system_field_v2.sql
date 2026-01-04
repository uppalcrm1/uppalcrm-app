-- Migration: Add source system field to custom_field_definitions (Version 2 - Fixed)
-- This version uses a more compatible loop syntax

DO $$
DECLARE
    org RECORD;
    entity_types TEXT[] := ARRAY['leads', 'contacts', 'transactions', 'accounts'];
    entity TEXT;
BEGIN
    -- Loop through all organizations
    FOR org IN SELECT id FROM organizations LOOP
        -- Loop through entity types using FOREACH
        FOREACH entity IN ARRAY entity_types LOOP

            -- Insert source field definition if it doesn't exist
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
            VALUES (
                org.id,
                'source',
                'Source',
                'How this lead/contact/transaction/account was acquired',
                entity,
                'select',
                false,  -- Not required (can be null)
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
                'Lead Information',  -- Field group
                true,  -- Active
                true,  -- Enabled
                NOW(),
                NOW()
            )
            ON CONFLICT (organization_id, entity_type, field_name) DO UPDATE
            SET
                field_label = EXCLUDED.field_label,
                field_description = EXCLUDED.field_description,
                field_type = EXCLUDED.field_type,
                field_options = EXCLUDED.field_options,
                is_active = true,
                is_enabled = true,
                updated_at = NOW();

        END LOOP;
    END LOOP;
END $$;

-- Add source column to accounts table (if it doesn't exist)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS source VARCHAR(100);

-- Create index for accounts source filtering
CREATE INDEX IF NOT EXISTS idx_accounts_source ON accounts(source);

-- Add comments
COMMENT ON COLUMN accounts.source IS 'How this account was acquired: website, referral, social-media, cold-call, email, advertisement, trade-show, other';

-- Verify the migration worked
DO $$
DECLARE
    total_count INTEGER;
    expected_count INTEGER;
    org_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO org_count FROM organizations;
    expected_count := org_count * 4; -- 4 entity types per organization

    SELECT COUNT(*) INTO total_count
    FROM custom_field_definitions
    WHERE field_name = 'source';

    RAISE NOTICE '✅ Migration complete!';
    RAISE NOTICE 'Organizations: %', org_count;
    RAISE NOTICE 'Source field definitions created: % (expected: %)', total_count, expected_count;

    IF total_count = expected_count THEN
        RAISE NOTICE '✅ SUCCESS: All source fields created correctly!';
    ELSE
        RAISE WARNING '⚠️  WARNING: Expected % source fields but found %. Some may be missing!', expected_count, total_count;
    END IF;
END $$;
