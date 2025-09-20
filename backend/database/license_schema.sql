-- License Management System Database Schema
-- UppalCRM - B2C Software Licensing CRM
-- This schema supports device-specific licensing, trials, and multi-tenant architecture

-- =============================================
-- 1. SOFTWARE EDITIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS software_editions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Edition Details
    name VARCHAR(100) NOT NULL, -- Gold, Jio, Smart
    description TEXT,
    version VARCHAR(50),

    -- Pricing Structure (all in cents to avoid decimal issues)
    monthly_price INTEGER NOT NULL DEFAULT 0,
    quarterly_price INTEGER NOT NULL DEFAULT 0,
    semi_annual_price INTEGER NOT NULL DEFAULT 0,
    annual_price INTEGER NOT NULL DEFAULT 0,

    -- Features & Limits
    features JSONB DEFAULT '{}',
    max_devices INTEGER DEFAULT 1,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_trial_available BOOLEAN DEFAULT true,
    trial_duration_hours INTEGER DEFAULT 24,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),

    UNIQUE(organization_id, name)
);

-- =============================================
-- 2. DEVICE REGISTRATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS device_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Device Identification
    mac_address VARCHAR(17) NOT NULL, -- Format: XX:XX:XX:XX:XX:XX
    device_name VARCHAR(255),
    device_type VARCHAR(100), -- Desktop, Laptop, Server, etc.

    -- Device Fingerprinting
    hardware_hash VARCHAR(255), -- Additional device identification
    os_info JSONB DEFAULT '{}', -- Operating system details
    device_specs JSONB DEFAULT '{}', -- Hardware specifications

    -- Registration Details
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,

    -- Security
    registration_ip INET,
    user_agent TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(organization_id, mac_address)
);

-- =============================================
-- 3. TRIALS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS trials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    software_edition_id UUID NOT NULL REFERENCES software_editions(id) ON DELETE CASCADE,
    device_registration_id UUID REFERENCES device_registrations(id) ON DELETE SET NULL,

    -- Trial Details
    trial_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    trial_end TIMESTAMP NOT NULL,
    duration_hours INTEGER DEFAULT 24,

    -- Trial Status
    status VARCHAR(50) DEFAULT 'active', -- active, expired, converted, cancelled
    activation_code VARCHAR(100) UNIQUE,

    -- Conversion Tracking
    converted_to_license_id UUID REFERENCES software_licenses(id),
    conversion_date TIMESTAMP,

    -- Download & Activation
    download_count INTEGER DEFAULT 0,
    first_activation TIMESTAMP,
    last_activity TIMESTAMP,

    -- Email & Communication
    download_email_sent BOOLEAN DEFAULT false,
    expiry_reminder_sent BOOLEAN DEFAULT false,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- =============================================
-- 4. SOFTWARE LICENSES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS software_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    software_edition_id UUID NOT NULL REFERENCES software_editions(id) ON DELETE CASCADE,
    device_registration_id UUID NOT NULL REFERENCES device_registrations(id) ON DELETE CASCADE,

    -- License Details
    license_key VARCHAR(255) UNIQUE NOT NULL,
    license_type VARCHAR(50) DEFAULT 'standard', -- standard, trial, extended

    -- Billing & Duration
    billing_cycle VARCHAR(20) NOT NULL, -- monthly, quarterly, semi_annual, annual
    purchase_price INTEGER NOT NULL, -- Price paid in cents

    -- License Period
    issued_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,

    -- Status
    status VARCHAR(50) DEFAULT 'active', -- active, expired, suspended, cancelled, transferred
    is_auto_renew BOOLEAN DEFAULT true,

    -- Activation & Usage
    activation_date TIMESTAMP,
    last_activation TIMESTAMP,
    activation_count INTEGER DEFAULT 0,
    max_activations INTEGER DEFAULT 1,

    -- Transfer History
    original_device_id UUID REFERENCES device_registrations(id),
    transfer_count INTEGER DEFAULT 0,
    last_transfer_date TIMESTAMP,

    -- Trial Conversion
    converted_from_trial_id UUID REFERENCES trials(id),

    -- Payment & Billing
    payment_status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
    payment_reference VARCHAR(255),
    next_billing_date TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    notes TEXT,

    UNIQUE(organization_id, license_key)
);

-- =============================================
-- 5. LICENSE TRANSFERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS license_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Transfer Details
    from_device_id UUID NOT NULL REFERENCES device_registrations(id),
    to_device_id UUID NOT NULL REFERENCES device_registrations(id),

    -- Transfer Timing
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    old_end_date TIMESTAMP NOT NULL,
    new_end_date TIMESTAMP NOT NULL,
    days_lost INTEGER DEFAULT 0, -- Days lost in transfer

    -- Transfer Reason & Notes
    reason VARCHAR(255),
    transfer_type VARCHAR(50) DEFAULT 'customer_request', -- customer_request, admin_transfer, device_replacement

    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed, cancelled

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_by UUID REFERENCES users(id),
    notes TEXT
);

-- =============================================
-- 6. DOWNLOADS & ACTIVATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS downloads_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Reference (can be either license or trial)
    license_id UUID REFERENCES software_licenses(id) ON DELETE CASCADE,
    trial_id UUID REFERENCES trials(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Download Details
    download_token VARCHAR(255) UNIQUE NOT NULL,
    download_url TEXT,
    download_expires_at TIMESTAMP NOT NULL,

    -- Download Tracking
    download_count INTEGER DEFAULT 0,
    first_download TIMESTAMP,
    last_download TIMESTAMP,
    download_ip INET,
    user_agent TEXT,

    -- Activation Tracking
    activation_count INTEGER DEFAULT 0,
    first_activation TIMESTAMP,
    last_activation TIMESTAMP,
    activation_device_info JSONB DEFAULT '{}',

    -- Email Delivery
    email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP,
    email_opened BOOLEAN DEFAULT false,
    email_opened_at TIMESTAMP,

    -- Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, downloaded, activated, expired

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- 7. BILLING & PAYMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS billing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,

    -- Payment Details
    payment_reference VARCHAR(255) UNIQUE,
    payment_method VARCHAR(50), -- credit_card, paypal, bank_transfer, etc.
    payment_processor VARCHAR(50), -- stripe, paypal, manual, etc.

    -- Amount & Currency
    amount INTEGER NOT NULL, -- Amount in cents
    currency VARCHAR(3) DEFAULT 'USD',
    tax_amount INTEGER DEFAULT 0,
    discount_amount INTEGER DEFAULT 0,
    total_amount INTEGER NOT NULL,

    -- Billing Period
    billing_period_start TIMESTAMP NOT NULL,
    billing_period_end TIMESTAMP NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,

    -- Payment Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed, refunded, cancelled
    payment_date TIMESTAMP,

    -- Gateway Response
    gateway_transaction_id VARCHAR(255),
    gateway_response JSONB DEFAULT '{}',

    -- Refund Information
    refund_amount INTEGER DEFAULT 0,
    refund_date TIMESTAMP,
    refund_reason TEXT,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_by UUID REFERENCES users(id),
    notes TEXT
);

-- =============================================
-- 8. RENEWALS & SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS renewals_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,

    -- Renewal Details
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    next_renewal_date TIMESTAMP NOT NULL,

    -- Subscription Settings
    auto_renew BOOLEAN DEFAULT true,
    billing_cycle VARCHAR(20) NOT NULL,
    renewal_price INTEGER NOT NULL, -- Price for next renewal in cents

    -- Renewal Status
    status VARCHAR(50) DEFAULT 'active', -- active, cancelled, expired, failed
    cancellation_date TIMESTAMP,
    cancellation_reason TEXT,

    -- Renewal Attempts
    last_renewal_attempt TIMESTAMP,
    renewal_attempt_count INTEGER DEFAULT 0,
    next_retry_date TIMESTAMP,

    -- Payment Method
    payment_method_id VARCHAR(255), -- Reference to payment method in gateway
    payment_processor VARCHAR(50),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- =============================================
-- 9. RENEWAL ALERTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS renewal_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    license_id UUID NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Alert Configuration
    alert_type VARCHAR(50) NOT NULL, -- expiry_warning, renewal_reminder, payment_failed, etc.
    days_before_expiry INTEGER NOT NULL, -- 30, 14, 7, 1

    -- Alert Status
    scheduled_date TIMESTAMP NOT NULL,
    sent_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, cancelled

    -- Alert Content
    email_subject VARCHAR(255),
    email_template VARCHAR(100),
    alert_channel VARCHAR(50) DEFAULT 'email', -- email, sms, in_app, webhook

    -- Response Tracking
    email_opened BOOLEAN DEFAULT false,
    email_clicked BOOLEAN DEFAULT false,
    response_action VARCHAR(100), -- renewed, cancelled, ignored
    response_date TIMESTAMP,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Software Editions
CREATE INDEX idx_software_editions_org_active ON software_editions(organization_id, is_active);
CREATE INDEX idx_software_editions_name ON software_editions(organization_id, name);

-- Device Registrations
CREATE INDEX idx_device_registrations_org_contact ON device_registrations(organization_id, contact_id);
CREATE INDEX idx_device_registrations_mac ON device_registrations(organization_id, mac_address);
CREATE INDEX idx_device_registrations_active ON device_registrations(organization_id, is_active);

-- Trials
CREATE INDEX idx_trials_org_contact ON trials(organization_id, contact_id);
CREATE INDEX idx_trials_status ON trials(organization_id, status);
CREATE INDEX idx_trials_expiry ON trials(organization_id, trial_end);
CREATE INDEX idx_trials_edition ON trials(software_edition_id);

-- Software Licenses
CREATE INDEX idx_software_licenses_org_contact ON software_licenses(organization_id, contact_id);
CREATE INDEX idx_software_licenses_device ON software_licenses(device_registration_id);
CREATE INDEX idx_software_licenses_status ON software_licenses(organization_id, status);
CREATE INDEX idx_software_licenses_expiry ON software_licenses(organization_id, end_date);
CREATE INDEX idx_software_licenses_key ON software_licenses(license_key);

-- License Transfers
CREATE INDEX idx_license_transfers_license ON license_transfers(license_id);
CREATE INDEX idx_license_transfers_date ON license_transfers(organization_id, transfer_date);

-- Downloads & Activations
CREATE INDEX idx_downloads_activations_license ON downloads_activations(license_id);
CREATE INDEX idx_downloads_activations_trial ON downloads_activations(trial_id);
CREATE INDEX idx_downloads_activations_token ON downloads_activations(download_token);
CREATE INDEX idx_downloads_activations_expires ON downloads_activations(download_expires_at);

-- Billing & Payments
CREATE INDEX idx_billing_payments_org_contact ON billing_payments(organization_id, contact_id);
CREATE INDEX idx_billing_payments_license ON billing_payments(license_id);
CREATE INDEX idx_billing_payments_status ON billing_payments(organization_id, status);
CREATE INDEX idx_billing_payments_date ON billing_payments(organization_id, payment_date);

-- Renewals & Subscriptions
CREATE INDEX idx_renewals_subscriptions_license ON renewals_subscriptions(license_id);
CREATE INDEX idx_renewals_subscriptions_renewal_date ON renewals_subscriptions(organization_id, next_renewal_date);
CREATE INDEX idx_renewals_subscriptions_status ON renewals_subscriptions(organization_id, status);

-- Renewal Alerts
CREATE INDEX idx_renewal_alerts_license ON renewal_alerts(license_id);
CREATE INDEX idx_renewal_alerts_scheduled ON renewal_alerts(organization_id, scheduled_date, status);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE software_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewals_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE renewal_alerts ENABLE ROW LEVEL SECURITY;

-- Software Editions Policies
CREATE POLICY software_editions_org_isolation ON software_editions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Device Registrations Policies
CREATE POLICY device_registrations_org_isolation ON device_registrations
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Trials Policies
CREATE POLICY trials_org_isolation ON trials
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Software Licenses Policies
CREATE POLICY software_licenses_org_isolation ON software_licenses
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- License Transfers Policies
CREATE POLICY license_transfers_org_isolation ON license_transfers
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Downloads & Activations Policies
CREATE POLICY downloads_activations_org_isolation ON downloads_activations
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Billing & Payments Policies
CREATE POLICY billing_payments_org_isolation ON billing_payments
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Renewals & Subscriptions Policies
CREATE POLICY renewals_subscriptions_org_isolation ON renewals_subscriptions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Renewal Alerts Policies
CREATE POLICY renewal_alerts_org_isolation ON renewal_alerts
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_software_editions_updated_at BEFORE UPDATE ON software_editions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_registrations_updated_at BEFORE UPDATE ON device_registrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trials_updated_at BEFORE UPDATE ON trials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_software_licenses_updated_at BEFORE UPDATE ON software_licenses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_downloads_activations_updated_at BEFORE UPDATE ON downloads_activations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_payments_updated_at BEFORE UPDATE ON billing_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_renewals_subscriptions_updated_at BEFORE UPDATE ON renewals_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_renewal_alerts_updated_at BEFORE UPDATE ON renewal_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to generate license keys
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS VARCHAR(255) AS $$
DECLARE
    key_prefix VARCHAR(10) := 'UPPAL-';
    random_part VARCHAR(20);
BEGIN
    random_part := encode(gen_random_bytes(10), 'hex');
    RETURN key_prefix || UPPER(random_part);
END;
$$ LANGUAGE plpgsql;

-- Function to calculate end date based on billing cycle
CREATE OR REPLACE FUNCTION calculate_license_end_date(start_date TIMESTAMP, billing_cycle VARCHAR(20))
RETURNS TIMESTAMP AS $$
BEGIN
    CASE billing_cycle
        WHEN 'monthly' THEN
            RETURN start_date + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            RETURN start_date + INTERVAL '3 months';
        WHEN 'semi_annual' THEN
            RETURN start_date + INTERVAL '6 months';
        WHEN 'annual' THEN
            RETURN start_date + INTERVAL '1 year';
        ELSE
            RETURN start_date + INTERVAL '1 month';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate trial end date
CREATE OR REPLACE FUNCTION calculate_trial_end_date(start_date TIMESTAMP, duration_hours INTEGER)
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN start_date + (duration_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEED DATA FOR SOFTWARE EDITIONS
-- =============================================

-- Insert default software editions for organizations
-- This will be handled by the application during organization setup

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE software_editions IS 'Product catalog for different software editions (Gold, Jio, Smart) with pricing tiers';
COMMENT ON TABLE device_registrations IS 'MAC address-based device tracking for license binding';
COMMENT ON TABLE trials IS '24-hour trials with unlimited flexibility per customer per edition';
COMMENT ON TABLE software_licenses IS '1:1 device licensing with MAC address binding and billing cycles';
COMMENT ON TABLE license_transfers IS 'Free transfers between customer devices with time-based expiry calculation';
COMMENT ON TABLE downloads_activations IS 'Email delivery and activation tracking for licenses and trials';
COMMENT ON TABLE billing_payments IS 'Transaction processing for different billing cycles';
COMMENT ON TABLE renewals_subscriptions IS 'Account-based renewal tracking and subscription management';
COMMENT ON TABLE renewal_alerts IS 'Automated expiry notifications (30, 14, 7, 1 day before expiry)';