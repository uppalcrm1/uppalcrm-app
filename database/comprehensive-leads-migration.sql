-- Comprehensive Lead Management Database Migration
-- This migration creates all necessary tables for full CRM lead management functionality

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Lead Sources table
CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    color VARCHAR(7) DEFAULT '#3B82F6', -- hex color for UI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Lead Status Definitions table
CREATE TABLE IF NOT EXISTS lead_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    order_position INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_final BOOLEAN DEFAULT false, -- converted/lost statuses
    color VARCHAR(7) DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Enhanced Leads table (replacing the simple one)
DROP TABLE IF EXISTS leads CASCADE;
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    lead_source_id UUID REFERENCES lead_sources(id),
    lead_status_id UUID REFERENCES lead_statuses(id),
    
    -- Contact Information
    title VARCHAR(100),
    company VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    website VARCHAR(255),
    
    -- Lead Details
    priority VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    value DECIMAL(12,2) DEFAULT 0, -- potential deal value
    probability INTEGER DEFAULT 0 CHECK (probability >= 0 AND probability <= 100),
    notes TEXT,
    
    -- Address Information
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    
    -- Assignment and Tracking
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up TIMESTAMP WITH TIME ZONE,
    converted_date TIMESTAMP WITH TIME ZONE,
    
    -- Scoring
    lead_score INTEGER DEFAULT 0,
    
    -- Ensure unique email per organization (if email provided)
    UNIQUE(organization_id, email)
);

-- Lead Assignments table (for team assignments and history)
CREATE TABLE IF NOT EXISTS lead_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    assigned_from UUID REFERENCES users(id),
    assigned_to UUID NOT NULL REFERENCES users(id),
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Lead Interactions table (calls, emails, meetings, etc.)
CREATE TABLE IF NOT EXISTS lead_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    
    -- Interaction Details
    interaction_type VARCHAR(50) NOT NULL, -- call, email, meeting, note, task
    subject VARCHAR(255),
    description TEXT,
    outcome VARCHAR(100), -- successful, no_answer, callback_requested, etc.
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed', -- scheduled, completed, cancelled
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead Scoring Rules table
CREATE TABLE IF NOT EXISTS lead_scoring_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Rule Details
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rule_type VARCHAR(50) NOT NULL, -- demographic, behavioral, engagement
    
    -- Conditions (stored as JSONB for flexibility)
    conditions JSONB NOT NULL, -- e.g., {"field": "company_size", "operator": "greater_than", "value": 100}
    
    -- Scoring
    points INTEGER NOT NULL DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Lead Tags table (for flexible categorization)
CREATE TABLE IF NOT EXISTS lead_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, name)
);

-- Lead Tag Assignments (many-to-many relationship)
CREATE TABLE IF NOT EXISTS lead_tag_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES lead_tags(id) ON DELETE CASCADE,
    assigned_by UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(lead_id, tag_id)
);

-- Lead Documents table (for file attachments)
CREATE TABLE IF NOT EXISTS lead_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    
    -- File Details
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    file_path TEXT, -- storage path or URL
    
    -- Metadata
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(lead_status_id);
CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(lead_source_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_next_follow_up ON leads(next_follow_up);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);

CREATE INDEX IF NOT EXISTS idx_lead_sources_organization_id ON lead_sources(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_statuses_organization_id ON lead_statuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead_id ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_assignments_assigned_to ON lead_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead_id ON lead_interactions(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_user_id ON lead_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_scheduled_at ON lead_interactions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_lead_scoring_rules_organization_id ON lead_scoring_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_tags_organization_id ON lead_tags(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_tag_assignments_lead_id ON lead_tag_assignments(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_documents_lead_id ON lead_documents(lead_id);

-- Enable Row Level Security for all tables
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_scoring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all tables
CREATE POLICY lead_sources_isolation ON lead_sources
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY lead_statuses_isolation ON lead_statuses
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY leads_isolation ON leads
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY lead_assignments_isolation ON lead_assignments
    FOR ALL TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM leads l 
            WHERE l.id = lead_assignments.lead_id 
            AND l.organization_id = current_setting('app.current_organization_id')::uuid
        )
    );

CREATE POLICY lead_interactions_isolation ON lead_interactions
    FOR ALL TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM leads l 
            WHERE l.id = lead_interactions.lead_id 
            AND l.organization_id = current_setting('app.current_organization_id')::uuid
        )
    );

CREATE POLICY lead_scoring_rules_isolation ON lead_scoring_rules
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY lead_tags_isolation ON lead_tags
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY lead_tag_assignments_isolation ON lead_tag_assignments
    FOR ALL TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM leads l 
            WHERE l.id = lead_tag_assignments.lead_id 
            AND l.organization_id = current_setting('app.current_organization_id')::uuid
        )
    );

CREATE POLICY lead_documents_isolation ON lead_documents
    FOR ALL TO PUBLIC
    USING (
        EXISTS (
            SELECT 1 FROM leads l 
            WHERE l.id = lead_documents.lead_id 
            AND l.organization_id = current_setting('app.current_organization_id')::uuid
        )
    );

-- Create triggers for updated_at columns
CREATE TRIGGER update_lead_sources_updated_at
    BEFORE UPDATE ON lead_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_statuses_updated_at
    BEFORE UPDATE ON lead_statuses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_interactions_updated_at
    BEFORE UPDATE ON lead_interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_scoring_rules_updated_at
    BEFORE UPDATE ON lead_scoring_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default lead sources
INSERT INTO lead_sources (organization_id, name, description, color) 
SELECT o.id, 'Website', 'Leads from company website', '#10B981'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_sources ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Website'
);

INSERT INTO lead_sources (organization_id, name, description, color) 
SELECT o.id, 'Referral', 'Leads from customer referrals', '#8B5CF6'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_sources ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Referral'
);

INSERT INTO lead_sources (organization_id, name, description, color) 
SELECT o.id, 'Social Media', 'Leads from social media platforms', '#3B82F6'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_sources ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Social Media'
);

INSERT INTO lead_sources (organization_id, name, description, color) 
SELECT o.id, 'Cold Call', 'Leads from cold calling', '#EF4444'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_sources ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Cold Call'
);

INSERT INTO lead_sources (organization_id, name, description, color) 
SELECT o.id, 'Email Campaign', 'Leads from email marketing', '#F59E0B'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_sources ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Email Campaign'
);

-- Insert default lead statuses
INSERT INTO lead_statuses (organization_id, name, description, order_position, color) 
SELECT o.id, 'New', 'Newly created lead', 1, '#6B7280'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_statuses ls 
    WHERE ls.organization_id = o.id AND ls.name = 'New'
);

INSERT INTO lead_statuses (organization_id, name, description, order_position, color) 
SELECT o.id, 'Contacted', 'Lead has been contacted', 2, '#3B82F6'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_statuses ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Contacted'
);

INSERT INTO lead_statuses (organization_id, name, description, order_position, color) 
SELECT o.id, 'Qualified', 'Lead meets qualification criteria', 3, '#8B5CF6'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_statuses ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Qualified'
);

INSERT INTO lead_statuses (organization_id, name, description, order_position, color) 
SELECT o.id, 'Proposal', 'Proposal sent to lead', 4, '#F59E0B'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_statuses ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Proposal'
);

INSERT INTO lead_statuses (organization_id, name, description, order_position, color) 
SELECT o.id, 'Negotiation', 'In negotiation phase', 5, '#EC4899'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_statuses ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Negotiation'
);

INSERT INTO lead_statuses (organization_id, name, description, order_position, is_final, color) 
SELECT o.id, 'Converted', 'Lead converted to customer', 6, true, '#10B981'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_statuses ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Converted'
);

INSERT INTO lead_statuses (organization_id, name, description, order_position, is_final, color) 
SELECT o.id, 'Lost', 'Lead was lost', 7, true, '#EF4444'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_statuses ls 
    WHERE ls.organization_id = o.id AND ls.name = 'Lost'
);

-- Insert default lead tags
INSERT INTO lead_tags (organization_id, name, color) 
SELECT o.id, 'Hot Lead', '#EF4444'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_tags lt 
    WHERE lt.organization_id = o.id AND lt.name = 'Hot Lead'
);

INSERT INTO lead_tags (organization_id, name, color) 
SELECT o.id, 'Enterprise', '#8B5CF6'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_tags lt 
    WHERE lt.organization_id = o.id AND lt.name = 'Enterprise'
);

INSERT INTO lead_tags (organization_id, name, color) 
SELECT o.id, 'SMB', '#10B981'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_tags lt 
    WHERE lt.organization_id = o.id AND lt.name = 'SMB'
);

INSERT INTO lead_tags (organization_id, name, color) 
SELECT o.id, 'Follow Up', '#F59E0B'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_tags lt 
    WHERE lt.organization_id = o.id AND lt.name = 'Follow Up'
);

-- Insert default scoring rules
INSERT INTO lead_scoring_rules (organization_id, name, description, rule_type, conditions, points) 
SELECT o.id, 'Company Size Bonus', 'Points for larger companies', 'demographic', 
       '{"field": "company", "operator": "not_empty"}', 10
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_scoring_rules lsr 
    WHERE lsr.organization_id = o.id AND lsr.name = 'Company Size Bonus'
);

INSERT INTO lead_scoring_rules (organization_id, name, description, rule_type, conditions, points) 
SELECT o.id, 'Email Provided', 'Points for providing email', 'demographic', 
       '{"field": "email", "operator": "not_empty"}', 15
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_scoring_rules lsr 
    WHERE lsr.organization_id = o.id AND lsr.name = 'Email Provided'
);

INSERT INTO lead_scoring_rules (organization_id, name, description, rule_type, conditions, points) 
SELECT o.id, 'Phone Provided', 'Points for providing phone', 'demographic', 
       '{"field": "phone", "operator": "not_empty"}', 10
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM lead_scoring_rules lsr 
    WHERE lsr.organization_id = o.id AND lsr.name = 'Phone Provided'
);

-- Comments for documentation
COMMENT ON TABLE lead_sources IS 'Lead sources for tracking where leads originated';
COMMENT ON TABLE lead_statuses IS 'Customizable lead statuses for pipeline management';
COMMENT ON TABLE leads IS 'Enhanced leads table with comprehensive lead information';
COMMENT ON TABLE lead_assignments IS 'History of lead assignments between team members';
COMMENT ON TABLE lead_interactions IS 'All interactions with leads (calls, emails, meetings, notes)';
COMMENT ON TABLE lead_scoring_rules IS 'Configurable rules for automatic lead scoring';
COMMENT ON TABLE lead_tags IS 'Flexible tagging system for lead categorization';
COMMENT ON TABLE lead_tag_assignments IS 'Many-to-many relationship between leads and tags';
COMMENT ON TABLE lead_documents IS 'File attachments related to leads';

COMMENT ON COLUMN leads.lead_score IS 'Automatically calculated lead score based on scoring rules';
COMMENT ON COLUMN leads.probability IS 'Probability of conversion (0-100%)';
COMMENT ON COLUMN lead_interactions.interaction_type IS 'Type: call, email, meeting, note, task';
COMMENT ON COLUMN lead_scoring_rules.conditions IS 'JSONB conditions for rule evaluation';