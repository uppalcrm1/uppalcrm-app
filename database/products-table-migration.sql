-- Product Catalog System Migration
-- Creates products table for managing subscription editions and pricing

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    allowed_billing_cycles JSONB DEFAULT '["monthly", "annual"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    color VARCHAR(50),
    features JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add product_id to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);

-- Add edition column if it doesn't exist (for backward compatibility)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS edition VARCHAR(50);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_organization ON products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_default ON products(is_default);
CREATE INDEX IF NOT EXISTS idx_products_display_order ON products(display_order);
CREATE INDEX IF NOT EXISTS idx_accounts_product ON accounts(product_id);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for products
DROP POLICY IF EXISTS products_isolation_policy ON products;
CREATE POLICY products_isolation_policy ON products
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Seed initial products for all existing organizations
DO $$
DECLARE
    org_record RECORD;
    admin_user_id UUID;
BEGIN
    -- Loop through all organizations
    FOR org_record IN SELECT id FROM organizations LOOP
        -- Get an admin user for this organization (or use NULL)
        SELECT id INTO admin_user_id
        FROM users
        WHERE organization_id = org_record.id
        AND role = 'admin'
        LIMIT 1;

        -- Insert Standard Edition
        INSERT INTO products (
            organization_id, name, description, price, currency,
            allowed_billing_cycles, is_active, is_default, display_order,
            color, features, created_by
        ) VALUES (
            org_record.id,
            'Standard',
            'Basic features for small teams',
            49.00,
            'USD',
            '["monthly", "quarterly", "semi-annual", "annual"]'::jsonb,
            true,
            true, -- Standard is default
            1,
            'blue',
            '["Up to 5 users", "Basic CRM features", "Email support", "1GB storage"]'::jsonb,
            admin_user_id
        ) ON CONFLICT DO NOTHING;

        -- Insert Gold Edition
        INSERT INTO products (
            organization_id, name, description, price, currency,
            allowed_billing_cycles, is_active, is_default, display_order,
            color, features, created_by
        ) VALUES (
            org_record.id,
            'Gold',
            'Enhanced features for growing businesses',
            99.00,
            'USD',
            '["monthly", "quarterly", "semi-annual", "annual"]'::jsonb,
            true,
            false,
            2,
            'yellow',
            '["Up to 20 users", "Advanced CRM features", "Priority support", "10GB storage", "Custom reports"]'::jsonb,
            admin_user_id
        ) ON CONFLICT DO NOTHING;

        -- Insert Jio Edition
        INSERT INTO products (
            organization_id, name, description, price, currency,
            allowed_billing_cycles, is_active, is_default, display_order,
            color, features, created_by
        ) VALUES (
            org_record.id,
            'Jio',
            'Professional features for enterprises',
            149.00,
            'USD',
            '["monthly", "quarterly", "semi-annual", "annual"]'::jsonb,
            true,
            false,
            3,
            'purple',
            '["Unlimited users", "Full CRM suite", "24/7 support", "50GB storage", "Advanced analytics", "API access"]'::jsonb,
            admin_user_id
        ) ON CONFLICT DO NOTHING;

        -- Insert Smart Edition
        INSERT INTO products (
            organization_id, name, description, price, currency,
            allowed_billing_cycles, is_active, is_default, display_order,
            color, features, created_by
        ) VALUES (
            org_record.id,
            'Smart',
            'Premium features with AI capabilities',
            199.00,
            'USD',
            '["monthly", "quarterly", "semi-annual", "annual"]'::jsonb,
            true,
            false,
            4,
            'green',
            '["Unlimited users", "AI-powered insights", "White-label options", "100GB storage", "Dedicated account manager", "SLA guarantee"]'::jsonb,
            admin_user_id
        ) ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at_trigger ON products;
CREATE TRIGGER products_updated_at_trigger
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_products_updated_at();

-- Create trigger to ensure only one default product per organization
CREATE OR REPLACE FUNCTION ensure_single_default_product()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_default = true THEN
        -- Unset all other default products in the same organization
        UPDATE products
        SET is_default = false
        WHERE organization_id = NEW.organization_id
        AND id != NEW.id
        AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_single_default_trigger ON products;
CREATE TRIGGER ensure_single_default_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_default_product();
