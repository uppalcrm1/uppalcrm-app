-- Contact Management System Database Migration
-- Transforms UppalCRM from lead management to complete software licensing platform
-- Objects 21-28: Full contact lifecycle from trial to licensing and transfers

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

BEGIN;

-- =============================================================================
-- 1. CONTACTS TABLE (Object 21) - Evolution from leads to customer contacts
-- =============================================================================

-- Rename leads table to contacts (preserving data)
ALTER TABLE IF EXISTS leads RENAME TO contacts_backup;

-- Create new contacts table with enhanced structure for software licensing
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Contact Information (enhanced from leads)
    title VARCHAR(100),
    company VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL, -- Required for software delivery
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Address Information (for licensing compliance)
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United States',
    
    -- Contact Status for Software Licensing
    contact_status VARCHAR(50) DEFAULT 'prospect', -- prospect, trial_user, customer, inactive
    contact_source VARCHAR(100), -- website, referral, social, cold-call, etc.
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    
    -- Customer Value Tracking
    lifetime_value DECIMAL(12,2) DEFAULT 0,
    total_purchases DECIMAL(12,2) DEFAULT 0,
    purchase_count INTEGER DEFAULT 0,
    
    -- Communication Preferences
    email_opt_in BOOLEAN DEFAULT true,
    sms_opt_in BOOLEAN DEFAULT false,
    marketing_opt_in BOOLEAN DEFAULT true,
    
    -- Assignment and Tracking
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up TIMESTAMP WITH TIME ZONE,
    
    -- Customer Lifecycle
    first_purchase_date TIMESTAMP WITH TIME ZONE,
    last_purchase_date TIMESTAMP WITH TIME ZONE,
    
    -- Lead Scoring (retained from leads)
    lead_score INTEGER DEFAULT 0,
    
    -- Notes and Internal Information
    notes TEXT,
    internal_notes TEXT, -- staff-only notes
    
    -- Ensure unique email per organization
    UNIQUE(organization_id, email)
);

-- Migrate data from leads to contacts (if backup exists)
INSERT INTO contacts (
    id, organization_id, title, company, first_name, last_name, email, phone, website,
    address_line1, address_line2, city, state, postal_code, country,
    contact_source, contact_status, priority, lifetime_value, notes,
    assigned_to, created_by, created_at, updated_at, last_contact_date, next_follow_up, lead_score
)
SELECT 
    cb.id, cb.organization_id, cb.title, cb.company, cb.first_name, cb.last_name, cb.email, cb.phone, cb.website,
    cb.address_line1, cb.address_line2, cb.city, cb.state, cb.postal_code, COALESCE(cb.country, 'United States'),
    COALESCE(ls.name, 'unknown'), 
    CASE 
        WHEN lst.name = 'Converted' THEN 'customer'
        WHEN lst.name = 'Qualified' THEN 'trial_user'
        WHEN cb.converted_date IS NOT NULL THEN 'customer'
        ELSE 'prospect'
    END,
    COALESCE(cb.priority, 'medium'), COALESCE(cb.value, 0), cb.notes,
    cb.assigned_to, cb.created_by, cb.created_at, cb.updated_at, cb.last_contact_date, cb.next_follow_up,
    COALESCE(cb.lead_score, 0)
FROM contacts_backup cb
LEFT JOIN lead_sources ls ON cb.lead_source_id = ls.id
LEFT JOIN lead_statuses lst ON cb.lead_status_id = lst.id
WHERE cb.id IS NOT NULL AND cb.email IS NOT NULL
ON CONFLICT (organization_id, email) DO NOTHING;

-- =============================================================================
-- 2. SOFTWARE EDITIONS TABLE (Object 22) - Product Catalog
-- =============================================================================

CREATE TABLE software_editions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Edition Details
    name VARCHAR(100) NOT NULL, -- Gold, Jio, Smart
    display_name VARCHAR(150) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    
    -- Pricing Information
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) DEFAULT 'one_time', -- one_time, monthly, yearly
    
    -- Trial Configuration
    trial_duration_hours INTEGER DEFAULT 24,
    trial_available BOOLEAN DEFAULT true,
    
    -- Product Features
    features JSONB DEFAULT '[]', -- Array of feature descriptions
    system_requirements JSONB DEFAULT '{}', -- Hardware/software requirements
    
    -- Availability and Status
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    
    -- File Information
    download_size_mb INTEGER,
    installer_filename VARCHAR(255),
    installer_path TEXT,
    
    -- Marketing
    marketing_description TEXT,
    benefits JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, name, version)
);

-- =============================================================================
-- 3. ACCOUNTS TABLE (Object 23) - Individual Software Accounts per Device
-- =============================================================================

CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Account Details
    account_name VARCHAR(255) NOT NULL, -- Friendly name for the account/device
    account_type VARCHAR(50) DEFAULT 'standard', -- standard, enterprise, developer
    
    -- Account Credentials (for software access)
    username VARCHAR(100),
    password_hash VARCHAR(255), -- If software requires login
    api_key VARCHAR(255), -- For API access if needed
    
    -- Account Status
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled, trial
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    suspended_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    -- Relationship tracking
    created_by UUID REFERENCES users(id),
    
    UNIQUE(organization_id, contact_id, account_name)
);

-- =============================================================================
-- 4. DEVICE REGISTRATIONS TABLE (Object 24) - MAC Address Tracking
-- =============================================================================

CREATE TABLE device_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    
    -- Device Identification
    mac_address VARCHAR(17) NOT NULL, -- Format: XX:XX:XX:XX:XX:XX
    device_name VARCHAR(255), -- User-friendly device name
    device_type VARCHAR(50), -- desktop, laptop, server, mobile
    
    -- Device Information
    hardware_info JSONB DEFAULT '{}', -- CPU, RAM, OS, etc.
    operating_system VARCHAR(100),
    os_version VARCHAR(50),
    
    -- Registration Status
    status VARCHAR(50) DEFAULT 'active', -- active, deregistered, suspended
    
    -- Timestamps
    registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE,
    deregistered_at TIMESTAMP WITH TIME ZONE,
    
    -- Registration metadata
    registration_ip INET,
    user_agent TEXT,
    registered_by UUID REFERENCES users(id),
    
    UNIQUE(organization_id, mac_address, account_id)
);

-- =============================================================================
-- 5. SOFTWARE LICENSES TABLE (Object 25) - 1:1 Device Licensing
-- =============================================================================

CREATE TABLE software_licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    software_edition_id UUID NOT NULL REFERENCES software_editions(id) ON DELETE CASCADE,
    device_registration_id UUID NOT NULL REFERENCES device_registrations(id) ON DELETE CASCADE,
    
    -- License Details
    license_key VARCHAR(255) UNIQUE NOT NULL, -- Generated license key
    license_type VARCHAR(50) DEFAULT 'standard', -- standard, trial, enterprise, educational
    
    -- License Status
    status VARCHAR(50) DEFAULT 'active', -- active, expired, suspended, revoked, transferred
    
    -- License Validity
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    activated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for perpetual licenses
    
    -- Usage Tracking
    activation_count INTEGER DEFAULT 0,
    max_activations INTEGER DEFAULT 1, -- Usually 1 for 1:1 device licensing
    last_activated_at TIMESTAMP WITH TIME ZONE,
    
    -- Purchase Information
    purchase_price DECIMAL(10,2),
    purchase_currency VARCHAR(3) DEFAULT 'USD',
    purchased_at TIMESTAMP WITH TIME ZONE,
    
    -- License Management
    issued_by UUID REFERENCES users(id),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT,
    
    -- Transfer tracking (for license transfers)
    original_device_registration_id UUID, -- Tracks original device if transferred
    transfer_count INTEGER DEFAULT 0,
    
    UNIQUE(organization_id, license_key),
    UNIQUE(device_registration_id, software_edition_id) -- One license per device per edition
);

-- =============================================================================
-- 6. TRIALS TABLE (Object 26) - 24-hour Trials
-- =============================================================================

CREATE TABLE trials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    software_edition_id UUID NOT NULL REFERENCES software_editions(id) ON DELETE CASCADE,
    device_registration_id UUID REFERENCES device_registrations(id), -- Optional: may start before device registration
    
    -- Trial Details
    trial_key VARCHAR(255) UNIQUE NOT NULL, -- Unique trial key/code
    trial_duration_hours INTEGER DEFAULT 24,
    
    -- Trial Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, expired, converted, cancelled
    
    -- Trial Timeline
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE, -- Calculated: started_at + trial_duration_hours
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- Trial Usage
    activation_count INTEGER DEFAULT 0,
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    usage_minutes INTEGER DEFAULT 0, -- Actual usage time tracked
    
    -- Conversion Tracking
    converted_to_license BOOLEAN DEFAULT false,
    converted_at TIMESTAMP WITH TIME ZONE,
    converted_license_id UUID REFERENCES software_licenses(id),
    
    -- Request Information
    request_ip INET,
    user_agent TEXT,
    request_notes TEXT, -- Why they want to trial
    
    -- Internal Tracking
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(organization_id, contact_id, software_edition_id) -- One active trial per contact per edition
);

-- =============================================================================
-- 7. LICENSE TRANSFERS TABLE (Object 27) - Free Transfers with Time Calculations
-- =============================================================================

CREATE TABLE license_transfers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    software_license_id UUID NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,
    
    -- Transfer Details
    transfer_type VARCHAR(50) DEFAULT 'device_change', -- device_change, ownership_change, hardware_upgrade
    transfer_reason TEXT,
    
    -- Source and Target
    from_device_registration_id UUID NOT NULL REFERENCES device_registrations(id),
    to_device_registration_id UUID REFERENCES device_registrations(id), -- NULL if new device not yet registered
    from_account_id UUID REFERENCES accounts(id), -- May transfer between accounts
    to_account_id UUID REFERENCES accounts(id),
    
    -- Transfer Status
    status VARCHAR(50) DEFAULT 'pending', -- pending, approved, completed, rejected, cancelled
    
    -- Time Tracking (for free transfer calculations)
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE,
    
    -- Transfer Rules and Validation
    is_free_transfer BOOLEAN DEFAULT true, -- Based on time since last transfer
    transfer_fee DECIMAL(8,2) DEFAULT 0,
    days_since_last_transfer INTEGER, -- Calculated field
    min_days_for_free_transfer INTEGER DEFAULT 30, -- Policy setting
    
    -- Approval Workflow
    requested_by UUID REFERENCES users(id), -- Staff member processing request
    approved_by UUID REFERENCES users(id),
    rejection_reason TEXT,
    
    -- Old License Details (preserved for audit)
    old_license_key VARCHAR(255),
    old_device_mac_address VARCHAR(17),
    
    -- New License Details (updated after completion)
    new_license_key VARCHAR(255), -- Usually same key, but may generate new one
    new_device_mac_address VARCHAR(17)
);

-- =============================================================================
-- 8. DOWNLOADS_ACTIVATIONS TABLE (Object 28) - Email Delivery and Activation Tracking
-- =============================================================================

CREATE TABLE downloads_activations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    
    -- Related Records
    software_edition_id UUID NOT NULL REFERENCES software_editions(id) ON DELETE CASCADE,
    software_license_id UUID REFERENCES software_licenses(id), -- NULL for trials
    trial_id UUID REFERENCES trials(id), -- NULL for purchased licenses
    account_id UUID REFERENCES accounts(id),
    device_registration_id UUID REFERENCES device_registrations(id),
    
    -- Download/Activation Type
    activity_type VARCHAR(50) NOT NULL, -- email_sent, download_started, download_completed, activation_attempted, activation_successful
    
    -- Email Delivery Tracking
    email_sent_at TIMESTAMP WITH TIME ZONE,
    email_delivered_at TIMESTAMP WITH TIME ZONE,
    email_opened_at TIMESTAMP WITH TIME ZONE,
    email_clicked_at TIMESTAMP WITH TIME ZONE,
    email_message_id VARCHAR(255), -- Email service message ID
    email_bounce_reason TEXT,
    email_status VARCHAR(50), -- sent, delivered, opened, clicked, bounced, complained
    
    -- Download Tracking
    download_started_at TIMESTAMP WITH TIME ZONE,
    download_completed_at TIMESTAMP WITH TIME ZONE,
    download_url TEXT,
    download_ip INET,
    download_user_agent TEXT,
    download_size_bytes BIGINT,
    download_duration_seconds INTEGER,
    
    -- Activation Tracking
    activation_attempted_at TIMESTAMP WITH TIME ZONE,
    activation_successful_at TIMESTAMP WITH TIME ZONE,
    activation_ip INET,
    activation_user_agent TEXT,
    activation_device_info JSONB,
    activation_error_message TEXT,
    
    -- License/Trial Key Used
    license_key VARCHAR(255),
    trial_key VARCHAR(255),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_agent TEXT,
    ip_address INET,
    referrer_url TEXT,
    
    -- Notes
    notes TEXT,
    internal_notes TEXT
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Contacts indexes
CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(contact_status);
CREATE INDEX idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_contacts_last_contact_date ON contacts(last_contact_date);
CREATE INDEX idx_contacts_next_follow_up ON contacts(next_follow_up);

-- Software editions indexes
CREATE INDEX idx_software_editions_organization_id ON software_editions(organization_id);
CREATE INDEX idx_software_editions_active ON software_editions(is_active);
CREATE INDEX idx_software_editions_name ON software_editions(name);

-- Accounts indexes
CREATE INDEX idx_accounts_organization_id ON accounts(organization_id);
CREATE INDEX idx_accounts_contact_id ON accounts(contact_id);
CREATE INDEX idx_accounts_status ON accounts(status);

-- Device registrations indexes
CREATE INDEX idx_device_registrations_organization_id ON device_registrations(organization_id);
CREATE INDEX idx_device_registrations_account_id ON device_registrations(account_id);
CREATE INDEX idx_device_registrations_mac_address ON device_registrations(mac_address);
CREATE INDEX idx_device_registrations_status ON device_registrations(status);

-- Software licenses indexes
CREATE INDEX idx_software_licenses_organization_id ON software_licenses(organization_id);
CREATE INDEX idx_software_licenses_account_id ON software_licenses(account_id);
CREATE INDEX idx_software_licenses_edition_id ON software_licenses(software_edition_id);
CREATE INDEX idx_software_licenses_device_id ON software_licenses(device_registration_id);
CREATE INDEX idx_software_licenses_key ON software_licenses(license_key);
CREATE INDEX idx_software_licenses_status ON software_licenses(status);
CREATE INDEX idx_software_licenses_expires_at ON software_licenses(expires_at);

-- Trials indexes
CREATE INDEX idx_trials_organization_id ON trials(organization_id);
CREATE INDEX idx_trials_contact_id ON trials(contact_id);
CREATE INDEX idx_trials_edition_id ON trials(software_edition_id);
CREATE INDEX idx_trials_status ON trials(status);
CREATE INDEX idx_trials_expires_at ON trials(expires_at);
CREATE INDEX idx_trials_key ON trials(trial_key);

-- License transfers indexes
CREATE INDEX idx_license_transfers_organization_id ON license_transfers(organization_id);
CREATE INDEX idx_license_transfers_license_id ON license_transfers(software_license_id);
CREATE INDEX idx_license_transfers_from_device ON license_transfers(from_device_registration_id);
CREATE INDEX idx_license_transfers_to_device ON license_transfers(to_device_registration_id);
CREATE INDEX idx_license_transfers_status ON license_transfers(status);
CREATE INDEX idx_license_transfers_requested_at ON license_transfers(requested_at);

-- Downloads/activations indexes
CREATE INDEX idx_downloads_activations_organization_id ON downloads_activations(organization_id);
CREATE INDEX idx_downloads_activations_contact_id ON downloads_activations(contact_id);
CREATE INDEX idx_downloads_activations_edition_id ON downloads_activations(software_edition_id);
CREATE INDEX idx_downloads_activations_license_id ON downloads_activations(software_license_id);
CREATE INDEX idx_downloads_activations_trial_id ON downloads_activations(trial_id);
CREATE INDEX idx_downloads_activations_type ON downloads_activations(activity_type);
CREATE INDEX idx_downloads_activations_created_at ON downloads_activations(created_at);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS for all new tables
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE software_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE downloads_activations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY contacts_isolation ON contacts
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY software_editions_isolation ON software_editions
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY accounts_isolation ON accounts
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY device_registrations_isolation ON device_registrations
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY software_licenses_isolation ON software_licenses
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY trials_isolation ON trials
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY license_transfers_isolation ON license_transfers
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY downloads_activations_isolation ON downloads_activations
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT COLUMNS
-- =============================================================================

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_software_editions_updated_at
    BEFORE UPDATE ON software_editions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DEFAULT DATA FOR SOFTWARE EDITIONS (Gold, Jio, Smart)
-- =============================================================================

-- Insert default software editions for all existing organizations
INSERT INTO software_editions (organization_id, name, display_name, description, price, trial_duration_hours, features, system_requirements, marketing_description, benefits)
SELECT 
    o.id,
    'Gold',
    'Gold Edition',
    'Premium software edition with advanced features and priority support',
    299.99,
    24,
    '["Advanced Analytics", "Priority Support", "Cloud Sync", "Advanced Reporting", "API Access", "Custom Integrations"]'::jsonb,
    '{"min_ram_gb": 8, "min_storage_gb": 10, "os": "Windows 10+, macOS 10.15+, Linux Ubuntu 18+", "processor": "Dual-core 2.5GHz+"}'::jsonb,
    'The most comprehensive edition with all premium features, perfect for businesses requiring advanced functionality and dedicated support.',
    '["30-day money-back guarantee", "24/7 priority support", "Free updates for 1 year", "Advanced security features", "Cloud storage integration"]'::jsonb
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM software_editions se 
    WHERE se.organization_id = o.id AND se.name = 'Gold'
);

INSERT INTO software_editions (organization_id, name, display_name, description, price, trial_duration_hours, features, system_requirements, marketing_description, benefits)
SELECT 
    o.id,
    'Jio',
    'Jio Edition',
    'Mid-tier software edition with essential business features',
    149.99,
    24,
    '["Core Analytics", "Standard Support", "Data Export", "Basic Reporting", "Email Integration"]'::jsonb,
    '{"min_ram_gb": 4, "min_storage_gb": 5, "os": "Windows 10+, macOS 10.13+, Linux Ubuntu 16+", "processor": "Dual-core 2.0GHz+"}'::jsonb,
    'Perfect balance of features and value, ideal for small to medium businesses looking for reliable functionality.',
    '["14-day money-back guarantee", "Business hours support", "Free updates for 6 months", "Standard security features", "Email support"]'::jsonb
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM software_editions se 
    WHERE se.organization_id = o.id AND se.name = 'Jio'
);

INSERT INTO software_editions (organization_id, name, display_name, description, price, trial_duration_hours, features, system_requirements, marketing_description, benefits)
SELECT 
    o.id,
    'Smart',
    'Smart Edition',
    'Entry-level software edition with core functionality',
    79.99,
    24,
    '["Basic Analytics", "Community Support", "Standard Export", "Basic Security"]'::jsonb,
    '{"min_ram_gb": 2, "min_storage_gb": 2, "os": "Windows 8+, macOS 10.12+, Linux Ubuntu 14+", "processor": "Single-core 1.5GHz+"}'::jsonb,
    'Affordable entry point with essential features, perfect for individuals and small teams getting started.',
    '["7-day money-back guarantee", "Community forum support", "Free updates for 3 months", "Basic documentation access"]'::jsonb
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM software_editions se 
    WHERE se.organization_id = o.id AND se.name = 'Smart'
);

-- =============================================================================
-- UTILITY FUNCTIONS FOR LICENSE MANAGEMENT
-- =============================================================================

-- Function to generate license keys
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS TEXT AS $$
DECLARE
    key_length INTEGER := 25;
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..key_length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        -- Add hyphens every 5 characters for readability
        IF i % 5 = 0 AND i < key_length THEN
            result := result || '-';
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to generate trial keys
CREATE OR REPLACE FUNCTION generate_trial_key()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := 'TRIAL-';
    i INTEGER;
BEGIN
    FOR i IN 1..15 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        -- Add hyphens every 5 characters for readability
        IF i % 5 = 0 AND i < 15 THEN
            result := result || '-';
        END IF;
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to check if transfer is eligible for free transfer
CREATE OR REPLACE FUNCTION is_transfer_eligible_free(
    license_id UUID,
    min_days INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
    last_transfer_date TIMESTAMP WITH TIME ZONE;
    days_since_transfer INTEGER;
BEGIN
    -- Get the most recent transfer date
    SELECT requested_at INTO last_transfer_date
    FROM license_transfers
    WHERE software_license_id = license_id
      AND status = 'completed'
    ORDER BY requested_at DESC
    LIMIT 1;
    
    -- If no previous transfers, it's always free
    IF last_transfer_date IS NULL THEN
        RETURN TRUE;
    END IF;
    
    -- Calculate days since last transfer
    days_since_transfer := EXTRACT(DAY FROM NOW() - last_transfer_date);
    
    RETURN days_since_transfer >= min_days;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE contacts IS 'Contact management table - evolution from leads to customer contacts with software licensing focus';
COMMENT ON TABLE software_editions IS 'Product catalog for software editions (Gold, Jio, Smart) with pricing and features';
COMMENT ON TABLE accounts IS 'Individual software accounts per device for customers';
COMMENT ON TABLE device_registrations IS 'MAC address tracking for device-based licensing';
COMMENT ON TABLE software_licenses IS '1:1 device licensing with unique license keys per device per edition';
COMMENT ON TABLE trials IS '24-hour trial management with conversion tracking';
COMMENT ON TABLE license_transfers IS 'Free transfer system with time-based calculations and approval workflow';
COMMENT ON TABLE downloads_activations IS 'Email delivery and activation tracking for complete customer journey';

COMMENT ON COLUMN contacts.contact_status IS 'Contact lifecycle: prospect, trial_user, customer, inactive';
COMMENT ON COLUMN software_licenses.license_key IS 'Unique license key generated for each device-edition combination';
COMMENT ON COLUMN trials.trial_duration_hours IS 'Trial duration in hours (default 24 hours)';
COMMENT ON COLUMN license_transfers.is_free_transfer IS 'Calculated based on time since last transfer and organization policy';
COMMENT ON COLUMN downloads_activations.activity_type IS 'Activity type: email_sent, download_started, download_completed, activation_attempted, activation_successful';

COMMIT;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Clean up backup table (uncomment after verifying migration)
-- DROP TABLE IF EXISTS contacts_backup;

SELECT 'Contact Management System migration completed successfully!' AS message;