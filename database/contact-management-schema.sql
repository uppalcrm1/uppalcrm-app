-- =====================================================
-- CONTACT MANAGEMENT SYSTEM - DATABASE SCHEMA
-- Add these tables to your existing UppalCRM database
-- =====================================================

-- Step 1: Update the existing CONTACTS table with new fields
-- Add new columns to existing contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(50) DEFAULT 'customer';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS customer_type VARCHAR(50) DEFAULT 'individual';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_licenses INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS communication_preferences JSONB DEFAULT '{"email": true, "sms": false}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Map existing fields to our new schema where needed
-- total_lifetime_value maps to lifetime_value (already exists)
-- Update status column to have better default if empty
UPDATE contacts SET status = 'active' WHERE status IS NULL OR status = '';

-- Step 2: Create CONTACT_CUSTOM_FIELDS table for dynamic fields
CREATE TABLE IF NOT EXISTS contact_custom_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Field definition
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,
    field_type VARCHAR(50) NOT NULL, -- text, number, date, select, boolean, email, phone

    -- Field configuration
    is_required BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    -- For select/dropdown fields
    field_options JSONB, -- e.g., ["Option 1", "Option 2", "Option 3"]

    -- Validation rules
    validation_rules JSONB, -- e.g., {"min": 0, "max": 100} for numbers

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Ensure unique field names per organization
    UNIQUE(organization_id, field_name)
);

-- Step 3: Create CONTACT_FIELD_VALUES table to store dynamic field data
CREATE TABLE IF NOT EXISTS contact_field_values (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES contact_custom_fields(id) ON DELETE CASCADE,

    -- Store the actual field value as text (convert as needed)
    field_value TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one value per contact per field
    UNIQUE(contact_id, field_id)
);

-- Step 4: Create CONTACT_INTERACTIONS table for communication tracking
CREATE TABLE IF NOT EXISTS contact_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL, -- email, call, meeting, note, support_ticket
    direction VARCHAR(20) NOT NULL, -- inbound, outbound
    subject VARCHAR(500),
    content TEXT,

    -- Metadata
    duration_minutes INTEGER, -- for calls/meetings
    email_message_id VARCHAR(500), -- for email tracking

    -- User tracking
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 5: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_lifecycle_stage ON contacts(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
CREATE INDEX IF NOT EXISTS idx_contacts_last_activity ON contacts(last_activity_date);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);

CREATE INDEX IF NOT EXISTS idx_contact_custom_fields_org ON contact_custom_fields(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_custom_fields_active ON contact_custom_fields(is_active);

CREATE INDEX IF NOT EXISTS idx_contact_field_values_contact ON contact_field_values(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_field_values_field ON contact_field_values(field_id);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact ON contact_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_org ON contact_interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_type ON contact_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_contact_interactions_created ON contact_interactions(created_at);

-- Step 6: Enable Row Level Security (RLS) for multi-tenant isolation
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

-- Step 7: Create RLS policies for contacts
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS contacts_isolation ON contacts;
    DROP POLICY IF EXISTS contact_custom_fields_isolation ON contact_custom_fields;
    DROP POLICY IF EXISTS contact_field_values_isolation ON contact_field_values;
    DROP POLICY IF EXISTS contact_interactions_isolation ON contact_interactions;

    -- Create new policies
    CREATE POLICY contacts_isolation ON contacts
        FOR ALL
        TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::UUID);

    CREATE POLICY contact_custom_fields_isolation ON contact_custom_fields
        FOR ALL
        TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::UUID);

    CREATE POLICY contact_field_values_isolation ON contact_field_values
        FOR ALL
        TO PUBLIC
        USING (
            contact_id IN (
                SELECT id FROM contacts
                WHERE organization_id = current_setting('app.current_organization_id')::UUID
            )
        );

    CREATE POLICY contact_interactions_isolation ON contact_interactions
        FOR ALL
        TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::UUID);
END $$;

-- Step 8: Update the leads table to track conversion status
ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_to_contact_id UUID REFERENCES contacts(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS conversion_date TIMESTAMP WITH TIME ZONE;

-- Create index for lead conversion tracking
CREATE INDEX IF NOT EXISTS idx_leads_converted ON leads(converted_to_contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_conversion_date ON leads(conversion_date);

-- Step 9: Create trigger to update timestamps
CREATE OR REPLACE FUNCTION update_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contacts_updated_at ON contacts;
CREATE TRIGGER trigger_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_updated_at();

DROP TRIGGER IF EXISTS trigger_contact_field_values_updated_at ON contact_field_values;
CREATE TRIGGER trigger_contact_field_values_updated_at
    BEFORE UPDATE ON contact_field_values
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_updated_at();