-- Comprehensive Contact History Tracking
-- This migration ensures all contact field changes are tracked

-- Ensure contact_change_history table exists
CREATE TABLE IF NOT EXISTS contact_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50) DEFAULT 'field_update',
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure contact_status_history table exists
CREATE TABLE IF NOT EXISTS contact_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,
    duration_in_previous_status INTERVAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_change_history_contact ON contact_change_history(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_change_history_user ON contact_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_contact_change_history_org ON contact_change_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_contact_status_history_contact ON contact_status_history(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_status_history_status ON contact_status_history(to_status);
CREATE INDEX IF NOT EXISTS idx_contact_status_history_org ON contact_status_history(organization_id);

-- Comprehensive trigger function that tracks ALL contact field changes
CREATE OR REPLACE FUNCTION track_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user_id from the current session
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.assigned_to;
    END;

    IF user_id IS NULL THEN
        user_id := NEW.assigned_to;
    END IF;

    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'status', OLD.status, NEW.status, 'status_change');

        INSERT INTO contact_status_history (organization_id, contact_id, from_status, to_status, changed_by)
        VALUES (NEW.organization_id, NEW.id, OLD.status, NEW.status, user_id);
    END IF;

    -- Track assignment changes
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT, 'assignment');
    END IF;

    -- Track contact information changes
    IF OLD.first_name IS DISTINCT FROM NEW.first_name THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'first_name', OLD.first_name, NEW.first_name);
    END IF;

    IF OLD.last_name IS DISTINCT FROM NEW.last_name THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'last_name', OLD.last_name, NEW.last_name);
    END IF;

    IF OLD.email IS DISTINCT FROM NEW.email THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'email', OLD.email, NEW.email);
    END IF;

    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'phone', OLD.phone, NEW.phone);
    END IF;

    IF OLD.company IS DISTINCT FROM NEW.company THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'company', OLD.company, NEW.company);
    END IF;

    IF OLD.title IS DISTINCT FROM NEW.title THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'title', OLD.title, NEW.title);
    END IF;

    -- Track type and priority changes
    IF OLD.type IS DISTINCT FROM NEW.type THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'type', OLD.type, NEW.type);
    END IF;

    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'priority', OLD.priority, NEW.priority);
    END IF;

    IF OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'value', OLD.value::TEXT, NEW.value::TEXT);
    END IF;

    IF OLD.source IS DISTINCT FROM NEW.source THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'source', OLD.source, NEW.source);
    END IF;

    -- Track address changes
    IF OLD.address IS DISTINCT FROM NEW.address THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'address', OLD.address, NEW.address);
    END IF;

    IF OLD.city IS DISTINCT FROM NEW.city THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'city', OLD.city, NEW.city);
    END IF;

    IF OLD.state IS DISTINCT FROM NEW.state THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'state', OLD.state, NEW.state);
    END IF;

    IF OLD.postal_code IS DISTINCT FROM NEW.postal_code THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'postal_code', OLD.postal_code, NEW.postal_code);
    END IF;

    IF OLD.country IS DISTINCT FROM NEW.country THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'country', OLD.country, NEW.country);
    END IF;

    -- Track notes changes
    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'notes', OLD.notes, NEW.notes);
    END IF;

    -- Track lead conversion
    IF OLD.converted_from_lead_id IS DISTINCT FROM NEW.converted_from_lead_id THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'converted_from_lead', OLD.converted_from_lead_id::TEXT, NEW.converted_from_lead_id::TEXT, 'conversion');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS track_contact_changes_trigger ON contacts;
CREATE TRIGGER track_contact_changes_trigger
    AFTER UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION track_contact_changes();

-- Trigger for contact creation
CREATE OR REPLACE FUNCTION track_contact_creation()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.assigned_to;
    END;

    IF user_id IS NULL THEN
        user_id := NEW.assigned_to;
    END IF;

    INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value, change_type)
    VALUES (NEW.organization_id, NEW.id, user_id, 'created', NULL, 'Contact created', 'creation');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_contact_creation_trigger ON contacts;
CREATE TRIGGER track_contact_creation_trigger
    AFTER INSERT ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION track_contact_creation();
