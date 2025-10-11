-- Fix lead change tracking trigger to use correct column names
-- The trigger was referencing lead_value and lead_source but the actual columns are value and source

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

    -- Track other important field changes (FIXED: use correct column names)
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

-- The trigger itself doesn't need to be recreated, just the function
-- But let's recreate it anyway to ensure it's using the updated function
DROP TRIGGER IF EXISTS track_lead_changes_trigger ON leads;
CREATE TRIGGER track_lead_changes_trigger
    AFTER UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION track_lead_changes();
