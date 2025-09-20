-- Lead Activity Enhancement Schema
-- Adds comprehensive activity tracking, change history, and follower functionality

-- Enhance lead_interactions table for better activity tracking
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS outcome VARCHAR(100);
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS participants JSONB;
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS activity_metadata JSONB;
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS duration INTEGER; -- in minutes
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead_date ON lead_interactions(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_type ON lead_interactions(interaction_type);

-- Lead change history table for audit trail
CREATE TABLE IF NOT EXISTS lead_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50) DEFAULT 'field_update', -- field_update, status_change, assignment, creation
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for change history
CREATE INDEX IF NOT EXISTS idx_lead_change_history_lead ON lead_change_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_change_history_user ON lead_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_lead_change_history_org ON lead_change_history(organization_id);

-- Lead followers table (for follow functionality)
CREATE TABLE IF NOT EXISTS lead_followers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notification_preferences JSONB DEFAULT '{"email": true, "in_app": true}'::jsonb,
    UNIQUE(lead_id, user_id)
);

-- Create indexes for followers
CREATE INDEX IF NOT EXISTS idx_lead_followers_lead ON lead_followers(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_followers_user ON lead_followers(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_followers_org ON lead_followers(organization_id);

-- Lead duplicate detection table
CREATE TABLE IF NOT EXISTS lead_duplicates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    duplicate_lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    similarity_score DECIMAL(3,2), -- 0.00 to 1.00
    duplicate_fields JSONB, -- which fields are duplicates
    status VARCHAR(20) DEFAULT 'detected', -- detected, reviewed, merged, dismissed
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(lead_id, duplicate_lead_id)
);

-- Create indexes for duplicates
CREATE INDEX IF NOT EXISTS idx_lead_duplicates_lead ON lead_duplicates(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_duplicates_status ON lead_duplicates(status);
CREATE INDEX IF NOT EXISTS idx_lead_duplicates_org ON lead_duplicates(organization_id);

-- Lead status progression tracking
CREATE TABLE IF NOT EXISTS lead_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,
    duration_in_previous_status INTERVAL, -- how long it was in previous status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for status history
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON lead_status_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_status ON lead_status_history(to_status);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_org ON lead_status_history(organization_id);

-- RLS Policies for new tables

-- Lead change history policies
ALTER TABLE lead_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view change history for their organization leads"
ON lead_change_history FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert change history for their organization leads"
ON lead_change_history FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

-- Lead followers policies
ALTER TABLE lead_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own lead follows"
ON lead_followers FOR ALL
USING (
    user_id = auth.uid() AND
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can view followers for their organization leads"
ON lead_followers FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

-- Lead duplicates policies
ALTER TABLE lead_duplicates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view duplicates for their organization leads"
ON lead_duplicates FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can manage duplicates for their organization leads"
ON lead_duplicates FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

-- Lead status history policies
ALTER TABLE lead_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view status history for their organization leads"
ON lead_status_history FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can insert status history for their organization leads"
ON lead_status_history FOR INSERT
WITH CHECK (
    organization_id IN (
        SELECT organization_id FROM users WHERE id = auth.uid()
    )
);

-- Add helpful functions for lead management

-- Function to calculate lead stage progression
CREATE OR REPLACE FUNCTION calculate_lead_stage_duration(p_lead_id UUID, p_status VARCHAR)
RETURNS INTERVAL AS $$
DECLARE
    duration INTERVAL;
BEGIN
    SELECT COALESCE(
        NOW() - MAX(created_at),
        NOW() - (SELECT created_at FROM leads WHERE id = p_lead_id)
    ) INTO duration
    FROM lead_status_history
    WHERE lead_id = p_lead_id AND to_status = p_status;

    RETURN COALESCE(duration, INTERVAL '0');
END;
$$ LANGUAGE plpgsql;

-- Function to get lead activity summary
CREATE OR REPLACE FUNCTION get_lead_activity_summary(p_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    summary JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_activities', COUNT(*),
        'last_activity', MAX(created_at),
        'activity_types', jsonb_object_agg(interaction_type, type_count)
    ) INTO summary
    FROM (
        SELECT
            interaction_type,
            COUNT(*) as type_count,
            created_at
        FROM lead_interactions
        WHERE lead_id = p_lead_id
        GROUP BY interaction_type, created_at
    ) activities;

    RETURN COALESCE(summary, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically track lead changes
CREATE OR REPLACE FUNCTION track_lead_changes()
RETURNS TRIGGER AS $$
DECLARE
    field_name TEXT;
    old_val TEXT;
    new_val TEXT;
    user_id UUID;
BEGIN
    -- Get the user_id from the current session or a default
    SELECT COALESCE(current_setting('app.current_user_id', true)::UUID, NEW.assigned_to) INTO user_id;

    -- Track status changes specifically
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'status', OLD.status, NEW.status, 'status_change');

        INSERT INTO lead_status_history (organization_id, lead_id, from_status, to_status, changed_by)
        VALUES (NEW.organization_id, NEW.id, OLD.status, NEW.status, user_id);
    END IF;

    -- Track assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT, 'assignment');
    END IF;

    -- Track other important field changes
    IF OLD.lead_value IS DISTINCT FROM NEW.lead_value THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'lead_value', OLD.lead_value::TEXT, NEW.lead_value::TEXT);
    END IF;

    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'priority', OLD.priority, NEW.priority);
    END IF;

    IF OLD.lead_source IS DISTINCT FROM NEW.lead_source THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'lead_source', OLD.lead_source, NEW.lead_source);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lead changes
DROP TRIGGER IF EXISTS track_lead_changes_trigger ON leads;
CREATE TRIGGER track_lead_changes_trigger
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION track_lead_changes();

-- Create trigger for initial lead creation tracking
CREATE OR REPLACE FUNCTION track_lead_creation()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    SELECT COALESCE(current_setting('app.current_user_id', true)::UUID, NEW.assigned_to) INTO user_id;

    INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, new_value, change_type)
    VALUES (NEW.organization_id, NEW.id, user_id, 'created', 'Lead created', 'creation');

    INSERT INTO lead_status_history (organization_id, lead_id, to_status, changed_by)
    VALUES (NEW.organization_id, NEW.id, NEW.status, user_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_lead_creation_trigger ON leads;
CREATE TRIGGER track_lead_creation_trigger
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION track_lead_creation();