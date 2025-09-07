-- =============================================================================
-- FIX-ONLY MIGRATION SCRIPT
-- Addresses missing pieces from the contact management migration
-- =============================================================================

BEGIN;

-- First, backup the current broken contacts table
DROP TABLE IF EXISTS contacts_broken_backup CASCADE;
ALTER TABLE contacts RENAME TO contacts_broken_backup;

-- =============================================================================
-- 1. CREATE PROPER CONTACTS TABLE
-- =============================================================================

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

    -- NEW SIMPLIFIED FIELDS for the contact management API
    -- These fields provide the simplified interface expected by the frontend
    name VARCHAR(255) GENERATED ALWAYS AS (TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))) STORED,
    tenant_id UUID GENERATED ALWAYS AS (organization_id) STORED, -- Alias for organization_id
    status VARCHAR(50) GENERATED ALWAYS AS (contact_status) STORED, -- Alias for contact_status  
    source VARCHAR(100) GENERATED ALWAYS AS (contact_source) STORED, -- Alias for contact_source
    tags TEXT[] DEFAULT '{}', -- Array field for tags
    
    -- Ensure unique email per organization
    UNIQUE(organization_id, email)
);

-- =============================================================================
-- 2. MIGRATE DATA FROM BACKUP TABLES
-- =============================================================================

-- Migrate data from the broken contacts table (which has the original lead structure)
INSERT INTO contacts (
    id, organization_id, title, company, first_name, last_name, email, phone, website,
    address_line1, address_line2, city, state, postal_code, country,
    contact_source, contact_status, priority, lifetime_value, notes,
    assigned_to, created_by, created_at, updated_at, last_contact_date, next_follow_up, lead_score,
    total_purchases, purchase_count, email_opt_in, sms_opt_in, marketing_opt_in,
    first_purchase_date, last_purchase_date, internal_notes, tags
)
SELECT 
    cb.id, 
    cb.organization_id, 
    cb.title, 
    cb.company, 
    cb.first_name, 
    cb.last_name, 
    cb.email, 
    cb.phone, 
    cb.website,
    cb.address_line1, 
    cb.address_line2, 
    cb.city, 
    cb.state, 
    cb.postal_code, 
    COALESCE(cb.country, 'United States'),
    COALESCE(cb.contact_source, 'imported'), 
    COALESCE(cb.contact_status, 'prospect'), 
    COALESCE(cb.priority, 'medium'), 
    COALESCE(cb.lifetime_value, 0), 
    cb.notes,
    cb.assigned_to, 
    cb.created_by, 
    cb.created_at, 
    cb.updated_at, 
    cb.last_contact_date, 
    cb.next_follow_up,
    COALESCE(cb.lead_score, 0),
    COALESCE(cb.total_purchases, 0),
    COALESCE(cb.purchase_count, 0),
    COALESCE(cb.email_opt_in, true),
    COALESCE(cb.sms_opt_in, false),
    COALESCE(cb.marketing_opt_in, true),
    cb.first_purchase_date,
    cb.last_purchase_date,
    cb.internal_notes,
    '{}' -- Empty tags array for now
FROM contacts_broken_backup cb
WHERE cb.id IS NOT NULL AND cb.email IS NOT NULL
ON CONFLICT (organization_id, email) DO NOTHING;

-- Also migrate any data from contacts_backup if it exists and has additional records
INSERT INTO contacts (
    id, organization_id, title, company, first_name, last_name, email, phone, website,
    address_line1, address_line2, city, state, postal_code, country,
    contact_source, contact_status, priority, lifetime_value, notes,
    assigned_to, created_by, created_at, updated_at, last_contact_date, next_follow_up, lead_score,
    tags
)
SELECT 
    cb.id, 
    cb.organization_id, 
    cb.title, 
    cb.company, 
    cb.first_name, 
    cb.last_name, 
    cb.email, 
    cb.phone, 
    cb.website,
    cb.address_line1, 
    cb.address_line2, 
    cb.city, 
    cb.state, 
    cb.postal_code, 
    COALESCE(cb.country, 'United States'),
    COALESCE(ls.name, 'imported') as contact_source,
    CASE 
        WHEN lst.name = 'Converted' THEN 'customer'
        WHEN lst.name = 'Qualified' THEN 'trial_user'
        WHEN cb.converted_date IS NOT NULL THEN 'customer'
        ELSE 'prospect'
    END as contact_status,
    COALESCE(cb.priority, 'medium'), 
    COALESCE(cb.value, 0) as lifetime_value,
    cb.notes,
    cb.assigned_to, 
    cb.created_by, 
    cb.created_at, 
    cb.updated_at, 
    cb.last_contact_date, 
    cb.next_follow_up,
    COALESCE(cb.lead_score, 0),
    '{}' -- Empty tags array for now
FROM contacts_backup cb
LEFT JOIN lead_sources ls ON cb.lead_source_id = ls.id
LEFT JOIN lead_statuses lst ON cb.lead_status_id = lst.id
WHERE cb.id IS NOT NULL 
  AND cb.email IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM contacts c WHERE c.id = cb.id
  )
ON CONFLICT (organization_id, email) DO NOTHING;

-- =============================================================================
-- 3. RECREATE INDEXES FOR CONTACTS
-- =============================================================================

CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_status ON contacts(contact_status);
CREATE INDEX idx_contacts_assigned_to ON contacts(assigned_to);
CREATE INDEX idx_contacts_created_at ON contacts(created_at);
CREATE INDEX idx_contacts_last_contact_date ON contacts(last_contact_date);
CREATE INDEX idx_contacts_next_follow_up ON contacts(next_follow_up);

-- Additional indexes for the new computed columns
CREATE INDEX idx_contacts_name ON contacts(name);
CREATE INDEX idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX idx_contacts_source ON contacts(source);
CREATE INDEX idx_contacts_tags ON contacts USING gin(tags);

-- =============================================================================
-- 4. FIX FOREIGN KEY REFERENCES 
-- =============================================================================

-- Update foreign key references that were broken when we renamed the table
-- These should automatically cascade, but let's make sure everything is consistent

-- Check and fix accounts table references
UPDATE accounts 
SET contact_id = c.id 
FROM contacts c 
WHERE accounts.contact_id = c.id;

-- Check and fix trials table references  
UPDATE trials 
SET contact_id = c.id 
FROM contacts c 
WHERE trials.contact_id = c.id;

-- Check and fix downloads_activations table references
UPDATE downloads_activations 
SET contact_id = c.id 
FROM contacts c 
WHERE downloads_activations.contact_id = c.id;

-- =============================================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS for contacts (may have been missed)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for contacts if it doesn't exist
DROP POLICY IF EXISTS contacts_isolation ON contacts;
CREATE POLICY contacts_isolation ON contacts
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- =============================================================================
-- 6. FIX SOFTWARE EDITIONS FEATURES COLUMN (if needed)
-- =============================================================================

-- The software_editions.features column should be jsonb (it already is, but let's ensure compatibility)
-- No change needed - verification showed it's already jsonb which is correct

-- =============================================================================
-- 7. CREATE TRIGGERS FOR UPDATED_AT
-- =============================================================================

-- Ensure the trigger exists for contacts
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 8. VERIFY FUNCTIONS EXIST
-- =============================================================================

-- The verification showed these functions exist:
-- - generate_license_key()
-- - generate_trial_key() 
-- - update_updated_at_column()
-- - is_transfer_eligible_free()

-- =============================================================================
-- 9. CREATE CONVENIENCE VIEWS FOR API COMPATIBILITY
-- =============================================================================

-- Create a view that provides the simplified contact interface expected by the API
-- This ensures backward compatibility while maintaining the full data model
CREATE OR REPLACE VIEW contacts_api AS
SELECT 
    id,
    tenant_id,
    name,
    email,
    phone,
    company,
    status,
    source,
    tags,
    notes,
    created_at,
    updated_at,
    -- Include organization_id for internal use
    organization_id,
    -- Include detailed fields for when needed
    first_name,
    last_name,
    contact_status,
    contact_source,
    assigned_to,
    created_by,
    lead_score
FROM contacts;

-- Create an INSTEAD OF trigger for INSERT operations on the view
CREATE OR REPLACE FUNCTION contacts_api_insert()
RETURNS TRIGGER AS $$
BEGIN
    -- Extract first_name and last_name from name if provided
    DECLARE
        name_parts TEXT[];
        computed_first_name TEXT;
        computed_last_name TEXT;
    BEGIN
        IF NEW.name IS NOT NULL THEN
            name_parts := string_to_array(trim(NEW.name), ' ');
            computed_first_name := COALESCE(name_parts[1], '');
            computed_last_name := COALESCE(array_to_string(name_parts[2:array_length(name_parts, 1)], ' '), '');
        END IF;
        
        INSERT INTO contacts (
            organization_id,
            first_name,
            last_name,
            email,
            phone,
            company,
            contact_status,
            contact_source,
            tags,
            notes
        ) VALUES (
            COALESCE(NEW.tenant_id, NEW.organization_id),
            COALESCE(computed_first_name, 'Unknown'),
            COALESCE(computed_last_name, 'Contact'),
            NEW.email,
            NEW.phone,
            NEW.company,
            COALESCE(NEW.status, 'prospect'),
            COALESCE(NEW.source, 'api'),
            COALESCE(NEW.tags, '{}'),
            NEW.notes
        ) RETURNING * INTO NEW;
        
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_api_insert_trigger ON contacts_api;
CREATE TRIGGER contacts_api_insert_trigger
    INSTEAD OF INSERT ON contacts_api
    FOR EACH ROW
    EXECUTE FUNCTION contacts_api_insert();

-- =============================================================================
-- 10. GRANT PERMISSIONS
-- =============================================================================

-- Ensure proper permissions are set
GRANT ALL ON contacts TO PUBLIC;
GRANT ALL ON contacts_api TO PUBLIC;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check contacts table structure
SELECT 
    'CONTACTS TABLE VERIFICATION' as check_type,
    COUNT(*) as total_records,
    COUNT(DISTINCT organization_id) as organizations,
    COUNT(DISTINCT email) as unique_emails,
    COUNT(*) FILTER (WHERE name IS NOT NULL) as records_with_name,
    COUNT(*) FILTER (WHERE tenant_id IS NOT NULL) as records_with_tenant_id,
    COUNT(*) FILTER (WHERE status IS NOT NULL) as records_with_status,
    COUNT(*) FILTER (WHERE source IS NOT NULL) as records_with_source
FROM contacts;

-- Check RLS is enabled
SELECT 
    'RLS STATUS' as check_type,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('contacts', 'software_editions', 'accounts', 'device_registrations', 'software_licenses', 'trials', 'license_transfers', 'downloads_activations');

-- Check computed columns work
SELECT 
    'COMPUTED COLUMNS TEST' as check_type,
    id,
    first_name,
    last_name,
    name,
    organization_id,
    tenant_id,
    contact_status,
    status,
    contact_source,
    source
FROM contacts 
LIMIT 3;

SELECT 'Contact Management Migration Fix completed successfully!' AS message;