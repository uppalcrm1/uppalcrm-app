-- Add leads table to existing schema

-- Leads table with tenant isolation
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(100),
    company VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    source VARCHAR(100), -- website, referral, social, cold-call, etc.
    status VARCHAR(50) DEFAULT 'new', -- new, contacted, qualified, converted, lost
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    value DECIMAL(12,2) DEFAULT 0, -- potential deal value
    notes TEXT,
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up TIMESTAMP WITH TIME ZONE,
    
    -- Ensure unique email per organization (if email provided)
    UNIQUE(organization_id, email)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for leads
CREATE POLICY lead_isolation ON leads
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Create trigger for updated_at
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add some sample lead statuses and sources as reference
COMMENT ON COLUMN leads.status IS 'Lead status: new, contacted, qualified, proposal, negotiation, converted, lost';
COMMENT ON COLUMN leads.priority IS 'Lead priority: low, medium, high';
COMMENT ON COLUMN leads.source IS 'Lead source: website, referral, social, cold-call, email, advertisement, trade-show, other';