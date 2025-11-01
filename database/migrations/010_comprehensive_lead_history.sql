-- Comprehensive Lead History Tracking
-- This migration ensures all lead field changes are tracked in lead_change_history

-- Ensure lead_change_history table exists
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

-- Ensure lead_status_history table exists
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

-- Comprehensive trigger function that tracks ALL lead field changes
CREATE OR REPLACE FUNCTION track_lead_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user_id from the current session or default to assigned_to
    -- This should be set by the application using: SELECT set_config('app.current_user_id', user_id, true)
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.assigned_to;
    END;

    -- If user_id is still null, try to use the assigned_to field
    IF user_id IS NULL THEN
        user_id := NEW.assigned_to;
    END IF;

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

    -- Track all contact information changes
    IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'first_name', OLD.first_name, NEW.first_name);
    END IF;

    IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'last_name', OLD.last_name, NEW.last_name);
    END IF;

    IF OLD.email IS DISTINCT FROM NEW.email THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'email', OLD.email, NEW.email);
    END IF;

    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'phone', OLD.phone, NEW.phone);
    END IF;

    IF OLD.company IS DISTINCT FROM NEW.company THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'company', OLD.company, NEW.company);
    END IF;

    -- Track lead details changes
    IF OLD.title IS DISTINCT FROM NEW.title THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'title', OLD.title, NEW.title);
    END IF;

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

    -- Track address changes
    IF OLD.address IS DISTINCT FROM NEW.address THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'address', OLD.address, NEW.address);
    END IF;

    IF OLD.city IS DISTINCT FROM NEW.city THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'city', OLD.city, NEW.city);
    END IF;

    IF OLD.state IS DISTINCT FROM NEW.state THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'state', OLD.state, NEW.state);
    END IF;

    IF OLD.postal_code IS DISTINCT FROM NEW.postal_code THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'postal_code', OLD.postal_code, NEW.postal_code);
    END IF;

    IF OLD.country IS DISTINCT FROM NEW.country THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'country', OLD.country, NEW.country);
    END IF;

    -- Track notes changes
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'notes', OLD.notes, NEW.notes);
    END IF;

    -- Track custom fields changes (if stored as JSONB)
    IF OLD.custom_fields IS DISTINCT FROM NEW.custom_fields THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'custom_fields', OLD.custom_fields::TEXT, NEW.custom_fields::TEXT);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger to ensure it's up to date
DROP TRIGGER IF EXISTS track_lead_changes_trigger ON leads;
CREATE TRIGGER track_lead_changes_trigger
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION track_lead_changes();

-- Also create a trigger for lead creation
CREATE OR REPLACE FUNCTION track_lead_creation()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user_id from the current session or default to assigned_to
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.assigned_to;
    END;

    -- If user_id is still null, try to use the assigned_to field
    IF user_id IS NULL THEN
        user_id := NEW.assigned_to;
    END IF;

    -- Record lead creation
    INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value, change_type)
    VALUES (NEW.organization_id, NEW.id, user_id, 'created', NULL, 'Lead created', 'creation');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for lead creation
DROP TRIGGER IF EXISTS track_lead_creation_trigger ON leads;
CREATE TRIGGER track_lead_creation_trigger
    AFTER INSERT ON leads
    FOR EACH ROW
    EXECUTE FUNCTION track_lead_creation();
