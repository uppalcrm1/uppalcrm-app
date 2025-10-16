-- Migration: Add Contacts and Accounts tables for Lead Conversion
-- Run this script to enable lead-to-contact conversion functionality

-- ============================================
-- CONTACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Basic Information
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    title VARCHAR(100),

    -- Contact Details
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),

    -- Status and Type
    contact_type VARCHAR(50) DEFAULT 'customer',
    status VARCHAR(50) DEFAULT 'active',

    -- Relationship Info
    converted_from_lead_id UUID,
    source VARCHAR(100),

    -- Notes and Custom Data
    notes TEXT,
    custom_fields JSONB DEFAULT '{}',

    -- Tracking
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contact_date TIMESTAMP WITH TIME ZONE,

    UNIQUE(organization_id, email)
);

-- ============================================
-- ACCOUNTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    -- Account Details
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) DEFAULT 'trial',

    -- Software Edition Info
    edition VARCHAR(100),

    -- Device Information
    device_name VARCHAR(255),
    mac_address VARCHAR(17),
    device_registered_at TIMESTAMP WITH TIME ZONE,

    -- License Information
    license_key VARCHAR(255),
    license_status VARCHAR(50) DEFAULT 'pending',

    -- Billing
    billing_cycle VARCHAR(50),
    price DECIMAL(12,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',

    -- Trial Information
    is_trial BOOLEAN DEFAULT false,
    trial_start_date TIMESTAMP WITH TIME ZONE,
    trial_end_date TIMESTAMP WITH TIME ZONE,

    -- Subscription Dates
    subscription_start_date TIMESTAMP WITH TIME ZONE,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    next_renewal_date TIMESTAMP WITH TIME ZONE,

    -- Tracking
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    notes TEXT,
    custom_fields JSONB DEFAULT '{}'
);

-- ============================================
-- LEAD-CONTACT RELATIONSHIP TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS lead_contact_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

    relationship_type VARCHAR(50) NOT NULL,
    interest_type VARCHAR(50),
    relationship_context TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    UNIQUE(lead_id, contact_id)
);

-- ============================================
-- UPDATE LEADS TABLE
-- ============================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS linked_contact_id UUID REFERENCES contacts(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest_type VARCHAR(50);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_date TIMESTAMP WITH TIME ZONE;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_converted_from_lead ON contacts(converted_from_lead_id);

CREATE INDEX IF NOT EXISTS idx_accounts_organization_id ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_contact_id ON accounts(contact_id);
CREATE INDEX IF NOT EXISTS idx_accounts_mac_address ON accounts(mac_address);
CREATE INDEX IF NOT EXISTS idx_accounts_license_status ON accounts(license_status);
CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_accounts_next_renewal_date ON accounts(next_renewal_date);

CREATE INDEX IF NOT EXISTS idx_lead_contact_rel_lead_id ON lead_contact_relationships(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_contact_rel_contact_id ON lead_contact_relationships(contact_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_contact_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_isolation ON contacts;
CREATE POLICY contact_isolation ON contacts
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

DROP POLICY IF EXISTS account_isolation ON accounts;
CREATE POLICY account_isolation ON accounts
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

DROP POLICY IF EXISTS lead_contact_rel_isolation ON lead_contact_relationships;
CREATE POLICY lead_contact_rel_isolation ON lead_contact_relationships
    FOR ALL
    TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM leads l
            WHERE l.id = lead_contact_relationships.lead_id
            AND l.organization_id = current_setting('app.current_organization_id', true)::uuid
        )
    );

-- ============================================
-- TRIGGERS
-- ============================================
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at
    BEFORE UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE contacts IS 'Customer contact records created from converted leads';
COMMENT ON TABLE accounts IS 'Software accounts/licenses tied to contacts';
COMMENT ON TABLE lead_contact_relationships IS 'Tracks relationships between leads and contacts for returning customers';
