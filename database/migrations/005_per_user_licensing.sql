-- Per-User Licensing System Migration
-- This migration implements complete per-user licensing with $15/user/month pricing
-- Supports manual license management and prepares for future automation

-- Add licensing fields to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS purchased_licenses INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS license_price_per_user DECIMAL(10,2) DEFAULT 15.00,
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auto_billing BOOLEAN DEFAULT false;

-- Create organization_licenses table for detailed tracking
CREATE TABLE IF NOT EXISTS organization_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    license_type VARCHAR(50) DEFAULT 'user_seat',
    quantity INTEGER NOT NULL DEFAULT 1,
    price_per_license DECIMAL(10,2) NOT NULL DEFAULT 15.00,
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, quarterly, annual
    status VARCHAR(20) DEFAULT 'active', -- active, suspended, cancelled
    purchased_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_billed_date TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create license_usage_history table for tracking changes
CREATE TABLE IF NOT EXISTS license_usage_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- added, removed, upgraded, downgraded
    previous_count INTEGER,
    new_count INTEGER,
    price_change DECIMAL(10,2),
    reason TEXT,
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create billing_events table for payment tracking
CREATE TABLE IF NOT EXISTS billing_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    licenses_count INTEGER NOT NULL,
    price_per_license DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    billing_status VARCHAR(20) DEFAULT 'pending', -- pending, paid, overdue, cancelled
    payment_method TEXT,
    payment_reference TEXT,
    invoice_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_org_licenses_organization_id ON organization_licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_license_history_organization_id ON license_usage_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_organization_id ON billing_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_events_status ON billing_events(billing_status);

-- Add constraints
ALTER TABLE organization_licenses 
ADD CONSTRAINT IF NOT EXISTS check_license_quantity CHECK (quantity > 0),
ADD CONSTRAINT IF NOT EXISTS check_license_price CHECK (price_per_license >= 0);

ALTER TABLE organizations 
ADD CONSTRAINT IF NOT EXISTS check_purchased_licenses CHECK (purchased_licenses >= 0);

-- Enable RLS on new tables
ALTER TABLE organization_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY license_isolation ON organization_licenses
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY license_history_isolation ON license_usage_history
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY billing_events_isolation ON billing_events
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Create updated_at triggers for new tables
CREATE TRIGGER update_organization_licenses_updated_at
    BEFORE UPDATE ON organization_licenses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_license_usage_history_updated_at
    BEFORE UPDATE ON license_usage_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Initialize existing organizations with default licenses
-- This handles organizations that already exist in the system
INSERT INTO organization_licenses (organization_id, quantity, price_per_license, billing_cycle, status)
SELECT 
    id as organization_id,
    COALESCE(purchased_licenses, 5) as quantity,
    15.00 as price_per_license,
    'monthly' as billing_cycle,
    'active' as status
FROM organizations 
WHERE NOT EXISTS (
    SELECT 1 FROM organization_licenses ol WHERE ol.organization_id = organizations.id
);

-- Update organizations with calculated next billing date for paid accounts
UPDATE organizations 
SET next_billing_date = NOW() + INTERVAL '1 month'
WHERE next_billing_date IS NULL AND payment_status = 'paid';

-- Replace the existing user limit check function to use purchased_licenses
DROP TRIGGER IF EXISTS enforce_user_limit ON users;
DROP FUNCTION IF EXISTS check_user_limit();

-- New function to check license limits (not max_users)
CREATE OR REPLACE FUNCTION check_license_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_count INTEGER;
    purchased_licenses INTEGER;
BEGIN
    -- Get current active user count and purchased licenses
    SELECT 
        COUNT(*) FILTER (WHERE u.is_active = true),
        COALESCE(ol.quantity, o.purchased_licenses, 5)
    INTO user_count, purchased_licenses
    FROM users u
    RIGHT JOIN organizations o ON o.id = NEW.organization_id
    LEFT JOIN organization_licenses ol ON ol.organization_id = o.id AND ol.status = 'active'
    WHERE u.organization_id = NEW.organization_id OR u.organization_id IS NULL
    GROUP BY ol.quantity, o.purchased_licenses;
    
    -- Check if adding this user would exceed license limit
    IF user_count >= purchased_licenses THEN
        RAISE EXCEPTION 'License limit exceeded for organization. Active users: %, Purchased licenses: %', 
            user_count, purchased_licenses;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to enforce license limits
CREATE TRIGGER enforce_license_limit
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION check_license_limit();

-- Function to get organization license summary
CREATE OR REPLACE FUNCTION get_organization_license_info(org_id UUID)
RETURNS TABLE (
    organization_id UUID,
    organization_name TEXT,
    purchased_licenses INTEGER,
    active_users BIGINT,
    available_seats INTEGER,
    monthly_cost DECIMAL(10,2),
    utilization_percentage INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        o.id as organization_id,
        o.name as organization_name,
        COALESCE(ol.quantity, o.purchased_licenses, 5) as purchased_licenses,
        COUNT(u.id) FILTER (WHERE u.is_active = true) as active_users,
        (COALESCE(ol.quantity, o.purchased_licenses, 5) - COUNT(u.id) FILTER (WHERE u.is_active = true))::INTEGER as available_seats,
        (COALESCE(ol.quantity, o.purchased_licenses, 5) * COALESCE(ol.price_per_license, 15.00)) as monthly_cost,
        ROUND((COUNT(u.id) FILTER (WHERE u.is_active = true)::DECIMAL / COALESCE(ol.quantity, o.purchased_licenses, 5)) * 100)::INTEGER as utilization_percentage
    FROM organizations o
    LEFT JOIN organization_licenses ol ON ol.organization_id = o.id AND ol.status = 'active'
    LEFT JOIN users u ON u.organization_id = o.id
    WHERE o.id = org_id
    GROUP BY o.id, o.name, ol.quantity, o.purchased_licenses, ol.price_per_license;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON TABLE organization_licenses IS 'Detailed license tracking per organization with pricing and billing cycles';
COMMENT ON TABLE license_usage_history IS 'Audit trail for all license changes and adjustments';
COMMENT ON TABLE billing_events IS 'Payment and billing history for organizations';
COMMENT ON COLUMN organizations.purchased_licenses IS 'Number of user licenses purchased (legacy field, use organization_licenses table for detailed tracking)';
COMMENT ON COLUMN organizations.license_price_per_user IS 'Price per user license in USD (default $15.00)';