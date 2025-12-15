-- Fix: Update contact creation trigger to use created_by instead of assigned_to
-- Date: 2025-12-15
-- Description: The track_contact_creation trigger was using assigned_to which can be NULL,
--              causing NOT NULL constraint violations. Changed to use created_by field.

CREATE OR REPLACE FUNCTION track_contact_creation()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Try to get user_id from session setting first
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NULL;
    END;

    -- If session setting doesn't exist, use created_by from the new contact
    IF user_id IS NULL THEN
        user_id := NEW.created_by;
    END IF;

    -- Only insert history if we have a valid user_id
    IF user_id IS NOT NULL THEN
        INSERT INTO contact_change_history (organization_id, contact_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'created', NULL, 'Contact created', 'creation');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also update the track_contact_changes function to use created_by as fallback
CREATE OR REPLACE FUNCTION track_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user_id from the current session
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NULL;
    END;

    -- Fallback to created_by if session setting doesn't exist
    IF user_id IS NULL THEN
        user_id := NEW.created_by;
    END IF;

    -- Only track changes if we have a valid user_id
    IF user_id IS NULL THEN
        RETURN NEW;
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
