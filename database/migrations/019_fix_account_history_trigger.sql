-- Fix: Update account history triggers to use created_by instead of owner_id
-- Date: 2025-12-19
-- Description: The account history triggers were using owner_id which doesn't exist in the accounts table.
--              Changed to use created_by field instead.

-- Fix the account changes trigger
CREATE OR REPLACE FUNCTION track_account_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user_id from the current session
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.created_by;
    END;

    IF user_id IS NULL THEN
        user_id := NEW.created_by;
    END IF;

    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'status', OLD.status, NEW.status, 'status_change');

        INSERT INTO account_status_history (organization_id, account_id, from_status, to_status, changed_by)
        VALUES (NEW.organization_id, NEW.id, OLD.status, NEW.status, user_id);
    END IF;

    -- Track owner changes (using created_by instead of owner_id)
    IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'created_by', OLD.created_by::TEXT, NEW.created_by::TEXT, 'assignment');
    END IF;

    -- Track account name and details
    IF OLD.account_name IS DISTINCT FROM NEW.account_name THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'account_name', OLD.account_name, NEW.account_name);
    END IF;

    IF OLD.account_type IS DISTINCT FROM NEW.account_type THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'account_type', OLD.account_type, NEW.account_type);
    END IF;

    -- Track contact changes
    IF OLD.contact_id IS DISTINCT FROM NEW.contact_id THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'contact_id', OLD.contact_id::TEXT, NEW.contact_id::TEXT);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fix the account creation trigger
CREATE OR REPLACE FUNCTION track_account_creation()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.created_by;
    END;

    IF user_id IS NULL THEN
        user_id := NEW.created_by;
    END IF;

    -- Only insert history if we have a valid user_id
    IF user_id IS NOT NULL THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'created', NULL, 'Account created', 'creation');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
