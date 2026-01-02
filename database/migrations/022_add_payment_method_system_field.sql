-- Migration: Add payment_method system field to custom_field_definitions
-- This allows organizations to customize payment method options in Field Configuration

-- Insert payment_method field definition for each organization
-- Note: This needs to be run for each existing organization

DO $$
DECLARE
    org RECORD;
BEGIN
    -- Loop through all organizations and create the payment_method field for each
    FOR org IN SELECT id FROM organizations LOOP
        -- Insert payment_method field definition if it doesn't exist
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
            created_at,
            updated_at
        )
        VALUES (
            org.id,
            'payment_method',
            'Payment Method',
            'Method of payment for this transaction',
            'transactions',
            'select',
            true,  -- Required field
            true,  -- Searchable
            true,  -- Filterable
            1,     -- Display order
            true,  -- Show in list view
            true,  -- Show in detail view
            true,  -- Show in create form
            true,  -- Show in edit form
            '[
                {"value": "credit_card", "label": "Credit Card"},
                {"value": "debit_card", "label": "Debit Card"},
                {"value": "bank_transfer", "label": "Bank Transfer"},
                {"value": "paypal", "label": "PayPal"},
                {"value": "cash", "label": "Cash"},
                {"value": "check", "label": "Check"},
                {"value": "stripe", "label": "Stripe"},
                {"value": "other", "label": "Other"}
            ]'::jsonb,
            'Credit Card',  -- Default value
            'Select payment method',
            'Payment Information',
            true,  -- Active
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
            updated_at = NOW();
    END LOOP;
END $$;

-- Add comment
COMMENT ON TABLE custom_field_definitions IS 'Custom and system field definitions for entities. The payment_method field for transactions is a system field that can be customized per organization.';
