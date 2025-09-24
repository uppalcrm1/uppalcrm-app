-- =============================================
-- Subscription Management System Database Schema
-- Multi-tenant CRM with comprehensive billing and usage tracking
-- =============================================

-- =============================================
-- 1. SUBSCRIPTION PLANS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Plan Details
    name VARCHAR(100) NOT NULL UNIQUE, -- starter, professional, enterprise, custom
    display_name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Pricing (all amounts in cents to avoid decimal issues)
    monthly_price INTEGER NOT NULL DEFAULT 0,
    yearly_price INTEGER DEFAULT NULL, -- NULL means not available yearly
    setup_fee INTEGER DEFAULT 0,

    -- Plan Features & Limits
    max_users INTEGER DEFAULT NULL, -- NULL means unlimited
    max_contacts INTEGER DEFAULT NULL, -- NULL means unlimited
    max_leads INTEGER DEFAULT NULL, -- NULL means unlimited
    max_storage_gb INTEGER DEFAULT NULL, -- NULL means unlimited
    max_api_calls_per_month INTEGER DEFAULT NULL, -- NULL means unlimited
    max_custom_fields INTEGER DEFAULT NULL, -- NULL means unlimited

    -- Feature Flags (what's included in this plan)
    features JSONB DEFAULT '{}',

    -- Plan Configuration
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true, -- Whether plan shows in public pricing
    sort_order INTEGER DEFAULT 0,

    -- Trial Configuration
    trial_days INTEGER DEFAULT 14,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 2. ORGANIZATION SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id),

    -- Subscription Details
    status VARCHAR(20) DEFAULT 'trial', -- trial, active, cancelled, expired, suspended
    billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly

    -- Pricing & Billing (stored in cents)
    current_price INTEGER NOT NULL, -- What they're currently paying
    quantity INTEGER DEFAULT 1, -- For per-user pricing

    -- Subscription Period
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,

    -- Usage Tracking
    usage_data JSONB DEFAULT '{}', -- Track current usage metrics

    -- Payment Information
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    payment_method_id VARCHAR(255),

    -- Cancellation
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    cancel_at_period_end BOOLEAN DEFAULT false,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(organization_id), -- One subscription per organization
    CHECK (status IN ('trial', 'active', 'cancelled', 'expired', 'suspended')),
    CHECK (billing_cycle IN ('monthly', 'yearly'))
);

-- =============================================
-- 3. SUBSCRIPTION USAGE TRACKING TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,

    -- Usage Period
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,

    -- Usage Metrics
    active_users INTEGER DEFAULT 0,
    total_contacts INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    storage_used_gb DECIMAL(10,2) DEFAULT 0,
    api_calls INTEGER DEFAULT 0,
    custom_fields_used INTEGER DEFAULT 0,

    -- Overage Tracking
    user_overage INTEGER DEFAULT 0,
    contact_overage INTEGER DEFAULT 0,
    lead_overage INTEGER DEFAULT 0,
    storage_overage_gb DECIMAL(10,2) DEFAULT 0,
    api_overage INTEGER DEFAULT 0,

    -- Calculated Fields
    total_overage_cost INTEGER DEFAULT 0, -- in cents

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure unique usage records per period
    UNIQUE(organization_id, period_start, period_end)
);

-- =============================================
-- 4. SUBSCRIPTION INVOICES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,

    -- Invoice Details
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- draft, sent, paid, failed, cancelled

    -- Billing Period
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,

    -- Amounts (in cents)
    subtotal INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER DEFAULT 0,
    discount_amount INTEGER DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    amount_paid INTEGER DEFAULT 0,
    amount_due INTEGER NOT NULL DEFAULT 0,

    -- Line Items (stored as JSON for flexibility)
    line_items JSONB DEFAULT '[]',

    -- Payment Information
    stripe_invoice_id VARCHAR(255),
    payment_date TIMESTAMP,
    payment_method VARCHAR(100),

    -- Due Date
    due_date TIMESTAMP,

    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CHECK (status IN ('draft', 'sent', 'paid', 'failed', 'cancelled'))
);

-- =============================================
-- 5. SUBSCRIPTION EVENTS TABLE (Audit Trail)
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE CASCADE,

    -- Event Details
    event_type VARCHAR(50) NOT NULL, -- created, upgraded, downgraded, cancelled, renewed, etc.
    description TEXT,

    -- Event Data
    old_data JSONB DEFAULT '{}',
    new_data JSONB DEFAULT '{}',

    -- User who performed the action
    performed_by UUID REFERENCES users(id),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 6. PLAN FEATURE DEFINITIONS
-- =============================================
CREATE TABLE IF NOT EXISTS plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Feature Details
    feature_key VARCHAR(100) NOT NULL UNIQUE, -- api_access, custom_reports, advanced_analytics
    feature_name VARCHAR(100) NOT NULL,
    description TEXT,
    feature_type VARCHAR(20) DEFAULT 'boolean', -- boolean, numeric, text

    -- Feature Configuration
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 7. PLAN FEATURE MAPPINGS
-- =============================================
CREATE TABLE IF NOT EXISTS plan_feature_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    plan_feature_id UUID NOT NULL REFERENCES plan_features(id) ON DELETE CASCADE,

    -- Feature Value (for numeric/text features)
    feature_value TEXT,
    is_included BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(subscription_plan_id, plan_feature_id)
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Subscription Plans
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX idx_subscription_plans_public ON subscription_plans(is_public, is_active);

-- Organization Subscriptions
CREATE INDEX idx_org_subscriptions_org_id ON organization_subscriptions(organization_id);
CREATE INDEX idx_org_subscriptions_status ON organization_subscriptions(status);
CREATE INDEX idx_org_subscriptions_period ON organization_subscriptions(current_period_start, current_period_end);
CREATE INDEX idx_org_subscriptions_trial ON organization_subscriptions(trial_end) WHERE status = 'trial';

-- Usage Tracking
CREATE INDEX idx_subscription_usage_org_period ON subscription_usage(organization_id, period_start, period_end);
CREATE INDEX idx_subscription_usage_subscription ON subscription_usage(subscription_id);

-- Invoices
CREATE INDEX idx_subscription_invoices_org ON subscription_invoices(organization_id);
CREATE INDEX idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX idx_subscription_invoices_due_date ON subscription_invoices(due_date) WHERE status = 'sent';

-- Events
CREATE INDEX idx_subscription_events_org ON subscription_events(organization_id);
CREATE INDEX idx_subscription_events_subscription ON subscription_events(subscription_id);
CREATE INDEX idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX idx_subscription_events_date ON subscription_events(created_at);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on subscription tables
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Organization Subscriptions Policies
CREATE POLICY org_subscriptions_isolation ON organization_subscriptions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Usage Tracking Policies
CREATE POLICY subscription_usage_isolation ON subscription_usage
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Invoices Policies
CREATE POLICY subscription_invoices_isolation ON subscription_invoices
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Events Policies
CREATE POLICY subscription_events_isolation ON subscription_events
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Create or update the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to subscription tables
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_subscriptions_updated_at BEFORE UPDATE ON organization_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_usage_updated_at BEFORE UPDATE ON subscription_usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscription_invoices_updated_at BEFORE UPDATE ON subscription_invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plan_features_updated_at BEFORE UPDATE ON plan_features
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS VARCHAR(50) AS $$
DECLARE
    year_month VARCHAR(6);
    sequence_num INTEGER;
    invoice_num VARCHAR(50);
BEGIN
    year_month := TO_CHAR(NOW(), 'YYYYMM');

    -- Get next sequence number for this month
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 8) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM subscription_invoices
    WHERE invoice_number LIKE 'INV-' || year_month || '%';

    invoice_num := 'INV-' || year_month || LPAD(sequence_num::TEXT, 4, '0');

    RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to check if organization has feature access
CREATE OR REPLACE FUNCTION has_feature_access(org_id UUID, feature_key VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    has_access BOOLEAN := FALSE;
BEGIN
    SELECT COALESCE(pfm.is_included, FALSE)
    INTO has_access
    FROM organization_subscriptions os
    JOIN plan_feature_mappings pfm ON pfm.subscription_plan_id = os.subscription_plan_id
    JOIN plan_features pf ON pf.id = pfm.plan_feature_id
    WHERE os.organization_id = org_id
    AND os.status IN ('trial', 'active')
    AND pf.feature_key = feature_key
    AND pf.is_active = TRUE;

    RETURN COALESCE(has_access, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Function to get current usage for organization
CREATE OR REPLACE FUNCTION get_current_usage(org_id UUID)
RETURNS TABLE(
    active_users INTEGER,
    total_contacts INTEGER,
    total_leads INTEGER,
    storage_used_gb DECIMAL,
    api_calls INTEGER,
    custom_fields_used INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM users WHERE organization_id = org_id AND is_active = TRUE),
        (SELECT COUNT(*)::INTEGER FROM contacts WHERE organization_id = org_id),
        (SELECT COUNT(*)::INTEGER FROM leads WHERE organization_id = org_id),
        0.0::DECIMAL, -- TODO: Implement storage calculation
        0::INTEGER, -- TODO: Implement API call tracking
        (SELECT COUNT(DISTINCT field_name)::INTEGER FROM contact_custom_fields WHERE organization_id = org_id)
    ;
END;
$$ LANGUAGE plpgsql;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limits(org_id UUID, usage_type VARCHAR, additional_count INTEGER DEFAULT 1)
RETURNS BOOLEAN AS $$
DECLARE
    current_count INTEGER;
    plan_limit INTEGER;
    can_add BOOLEAN := TRUE;
BEGIN
    -- Get current subscription plan limits
    SELECT
        CASE usage_type
            WHEN 'users' THEN sp.max_users
            WHEN 'contacts' THEN sp.max_contacts
            WHEN 'leads' THEN sp.max_leads
            WHEN 'custom_fields' THEN sp.max_custom_fields
        END
    INTO plan_limit
    FROM organization_subscriptions os
    JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
    WHERE os.organization_id = org_id AND os.status IN ('trial', 'active');

    -- If plan_limit is NULL, it means unlimited
    IF plan_limit IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Get current usage count
    SELECT
        CASE usage_type
            WHEN 'users' THEN (SELECT COUNT(*) FROM users WHERE organization_id = org_id AND is_active = TRUE)
            WHEN 'contacts' THEN (SELECT COUNT(*) FROM contacts WHERE organization_id = org_id)
            WHEN 'leads' THEN (SELECT COUNT(*) FROM leads WHERE organization_id = org_id)
            WHEN 'custom_fields' THEN (SELECT COUNT(DISTINCT field_name) FROM contact_custom_fields WHERE organization_id = org_id)
            ELSE 0
        END
    INTO current_count;

    -- Check if adding additional_count would exceed the limit
    can_add := (current_count + additional_count) <= plan_limit;

    RETURN can_add;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEED DATA FOR SUBSCRIPTION PLANS
-- =============================================

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, monthly_price, yearly_price, max_users, max_contacts, max_leads, features, is_public, sort_order, trial_days)
VALUES
-- Starter Plan
('starter', 'Starter', 'Perfect for small teams getting started with CRM', 2900, 29000, 5, 1000, 500,
 '{"basic_reports": true, "email_support": true, "basic_integrations": true}', true, 1, 14),

-- Professional Plan
('professional', 'Professional', 'Great for growing businesses', 9900, 99000, 25, 10000, 5000,
 '{"advanced_reports": true, "priority_support": true, "advanced_integrations": true, "custom_fields": true, "api_access": true}', true, 2, 14),

-- Enterprise Plan
('enterprise', 'Enterprise', 'For large organizations with advanced needs', 29900, 299000, NULL, NULL, NULL,
 '{"unlimited_everything": true, "white_label": true, "dedicated_support": true, "sso": true, "advanced_security": true}', true, 3, 30),

-- Free Trial Plan
('trial', 'Free Trial', 'Trial plan for new organizations', 0, NULL, 3, 100, 50,
 '{"basic_reports": true}', false, 0, 14)
ON CONFLICT (name) DO NOTHING;

-- Insert plan features
INSERT INTO plan_features (feature_key, feature_name, description, feature_type)
VALUES
('basic_reports', 'Basic Reports', 'Access to standard CRM reports', 'boolean'),
('advanced_reports', 'Advanced Reports', 'Custom reports and analytics', 'boolean'),
('api_access', 'API Access', 'REST API access for integrations', 'boolean'),
('custom_fields', 'Custom Fields', 'Create custom fields for contacts and leads', 'boolean'),
('email_support', 'Email Support', 'Email support during business hours', 'boolean'),
('priority_support', 'Priority Support', 'Priority email and chat support', 'boolean'),
('dedicated_support', 'Dedicated Support', 'Dedicated account manager', 'boolean'),
('sso', 'Single Sign-On', 'SAML/OAuth SSO integration', 'boolean'),
('white_label', 'White Label', 'Remove branding and customize interface', 'boolean'),
('advanced_security', 'Advanced Security', 'Enhanced security features and audit logs', 'boolean')
ON CONFLICT (feature_key) DO NOTHING;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE subscription_plans IS 'Defines available subscription plans with pricing and feature limits';
COMMENT ON TABLE organization_subscriptions IS 'Tracks each organization subscription status and billing information';
COMMENT ON TABLE subscription_usage IS 'Records usage metrics for billing and limit enforcement';
COMMENT ON TABLE subscription_invoices IS 'Manages billing invoices and payment tracking';
COMMENT ON TABLE subscription_events IS 'Audit trail for all subscription-related events';
COMMENT ON TABLE plan_features IS 'Defines available features that can be included in plans';
COMMENT ON TABLE plan_feature_mappings IS 'Maps which features are included in each plan';