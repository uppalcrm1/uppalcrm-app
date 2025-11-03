-- Fix lead creation trigger to use created_by column
-- This prevents NULL constraint violations in lead_change_history

CREATE OR REPLACE FUNCTION track_lead_creation()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Priority order for getting user_id:
    -- 1. NEW.created_by (the user who created the lead)
    -- 2. app.current_user_id session variable
    -- 3. NEW.assigned_to (fallback)

    -- First, try to use created_by from the lead record
    user_id := NEW.created_by;

    -- If still null, try session variable
    IF user_id IS NULL THEN
        BEGIN
            user_id := current_setting('app.current_user_id', true)::UUID;
        EXCEPTION WHEN OTHERS THEN
            user_id := NULL;
        END;
    END IF;

    -- If still null, try assigned_to
    IF user_id IS NULL THEN
        user_id := NEW.assigned_to;
    END IF;

    -- Only insert history if we have a valid user_id
    IF user_id IS NOT NULL THEN
        INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'created', NULL, 'Lead created', 'creation');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists, no need to recreate
