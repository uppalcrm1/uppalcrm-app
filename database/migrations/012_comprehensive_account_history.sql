-- Comprehensive Account History Tracking
-- This migration ensures all account field changes are tracked

-- Ensure account_change_history table exists
CREATE TABLE IF NOT EXISTS account_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50) DEFAULT 'field_update',
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure account_status_history table exists
CREATE TABLE IF NOT EXISTS account_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,
    duration_in_previous_status INTERVAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_change_history_account ON account_change_history(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_change_history_user ON account_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_account_change_history_org ON account_change_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_account_status_history_account ON account_status_history(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_status_history_status ON account_status_history(to_status);
CREATE INDEX IF NOT EXISTS idx_account_status_history_org ON account_status_history(organization_id);

-- Comprehensive trigger function that tracks ALL account field changes
CREATE OR REPLACE FUNCTION track_account_changes()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    -- Get the user_id from the current session
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.owner_id;
    END;

    IF user_id IS NULL THEN
        user_id := NEW.owner_id;
    END IF;

    -- Track status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'status', OLD.status, NEW.status, 'status_change');

        INSERT INTO account_status_history (organization_id, account_id, from_status, to_status, changed_by)
        VALUES (NEW.organization_id, NEW.id, OLD.status, NEW.status, user_id);
    END IF;

    -- Track owner changes
    IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'owner_id', OLD.owner_id::TEXT, NEW.owner_id::TEXT, 'assignment');
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

    IF OLD.industry IS DISTINCT FROM NEW.industry THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'industry', OLD.industry, NEW.industry);
    END IF;

    IF OLD.website IS DISTINCT FROM NEW.website THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'website', OLD.website, NEW.website);
    END IF;

    IF OLD.phone IS DISTINCT FROM NEW.phone THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'phone', OLD.phone, NEW.phone);
    END IF;

    IF OLD.email IS DISTINCT FROM NEW.email THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'email', OLD.email, NEW.email);
    END IF;

    -- Track financial fields
    IF OLD.annual_revenue IS DISTINCT FROM NEW.annual_revenue THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'annual_revenue', OLD.annual_revenue::TEXT, NEW.annual_revenue::TEXT);
    END IF;

    IF OLD.employee_count IS DISTINCT FROM NEW.employee_count THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'employee_count', OLD.employee_count::TEXT, NEW.employee_count::TEXT);
    END IF;

    -- Track address changes
    IF OLD.billing_address IS DISTINCT FROM NEW.billing_address THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'billing_address', OLD.billing_address, NEW.billing_address);
    END IF;

    IF OLD.billing_city IS DISTINCT FROM NEW.billing_city THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'billing_city', OLD.billing_city, NEW.billing_city);
    END IF;

    IF OLD.billing_state IS DISTINCT FROM NEW.billing_state THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'billing_state', OLD.billing_state, NEW.billing_state);
    END IF;

    IF OLD.billing_postal_code IS DISTINCT FROM NEW.billing_postal_code THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'billing_postal_code', OLD.billing_postal_code, NEW.billing_postal_code);
    END IF;

    IF OLD.billing_country IS DISTINCT FROM NEW.billing_country THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'billing_country', OLD.billing_country, NEW.billing_country);
    END IF;

    IF OLD.shipping_address IS DISTINCT FROM NEW.shipping_address THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'shipping_address', OLD.shipping_address, NEW.shipping_address);
    END IF;

    IF OLD.shipping_city IS DISTINCT FROM NEW.shipping_city THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'shipping_city', OLD.shipping_city, NEW.shipping_city);
    END IF;

    IF OLD.shipping_state IS DISTINCT FROM NEW.shipping_state THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'shipping_state', OLD.shipping_state, NEW.shipping_state);
    END IF;

    IF OLD.shipping_postal_code IS DISTINCT FROM NEW.shipping_postal_code THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'shipping_postal_code', OLD.shipping_postal_code, NEW.shipping_postal_code);
    END IF;

    IF OLD.shipping_country IS DISTINCT FROM NEW.shipping_country THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'shipping_country', OLD.shipping_country, NEW.shipping_country);
    END IF;

    -- Track description/notes
    IF OLD.description IS DISTINCT FROM NEW.description THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'description', OLD.description, NEW.description);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS track_account_changes_trigger ON accounts;
CREATE TRIGGER track_account_changes_trigger
    AFTER UPDATE ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION track_account_changes();

-- Trigger for account creation
CREATE OR REPLACE FUNCTION track_account_creation()
RETURNS TRIGGER AS $$
DECLARE
    user_id UUID;
BEGIN
    BEGIN
        user_id := current_setting('app.current_user_id', true)::UUID;
    EXCEPTION WHEN OTHERS THEN
        user_id := NEW.owner_id;
    END;

    IF user_id IS NULL THEN
        user_id := NEW.owner_id;
    END IF;

    INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value, change_type)
    VALUES (NEW.organization_id, NEW.id, user_id, 'created', NULL, 'Account created', 'creation');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_account_creation_trigger ON accounts;
CREATE TRIGGER track_account_creation_trigger
    AFTER INSERT ON accounts
    FOR EACH ROW
    EXECUTE FUNCTION track_account_creation();
