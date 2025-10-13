-- Create lead tracking tables
-- These tables are required for the lead status update functionality

-- Lead change history table
CREATE TABLE IF NOT EXISTS lead_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50) DEFAULT 'field_update',
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lead status history table
CREATE TABLE IF NOT EXISTS lead_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,
    duration_in_previous_status INTERVAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_change_history_lead ON lead_change_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_change_history_user ON lead_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_lead_change_history_org ON lead_change_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON lead_status_history(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_status ON lead_status_history(to_status);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_org ON lead_status_history(organization_id);

-- Fix lead trigger to use correct column names
CREATE OR REPLACE FUNCTION track_lead_changes()
RETURNS TRIGGER AS $$
DECLARE
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

    -- Track field changes (FIXED: use correct column names - value and source)
    IF OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'value', OLD.value::TEXT, NEW.value::TEXT);
    END IF;

    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'priority', OLD.priority, NEW.priority);
    END IF;

    IF OLD.source IS DISTINCT FROM NEW.source THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'source', OLD.source, NEW.source);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create or recreate the trigger
DROP TRIGGER IF EXISTS track_lead_changes_trigger ON leads;
CREATE TRIGGER track_lead_changes_trigger
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION track_lead_changes();
