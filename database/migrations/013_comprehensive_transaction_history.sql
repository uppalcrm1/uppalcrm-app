-- Comprehensive Transaction History Tracking
-- This migration ensures all transaction field changes are tracked

-- Ensure transaction_change_history table exists
CREATE TABLE IF NOT EXISTS transaction_change_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    changed_by UUID NOT NULL REFERENCES users(id),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_type VARCHAR(50) DEFAULT 'field_update',
    change_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure transaction_status_history table exists
CREATE TABLE IF NOT EXISTS transaction_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by UUID NOT NULL REFERENCES users(id),
    change_reason TEXT,
    duration_in_previous_status INTERVAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transaction_change_history_transaction ON transaction_change_history(transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_change_history_user ON transaction_change_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_transaction_change_history_org ON transaction_change_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_transaction_status_history_transaction ON transaction_status_history(transaction_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_status_history_status ON transaction_status_history(to_status);
CREATE INDEX IF NOT EXISTS idx_transaction_status_history_org ON transaction_status_history(organization_id);

-- Comprehensive trigger function that tracks ALL transaction field changes
CREATE OR REPLACE FUNCTION track_transaction_changes()
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
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value, change_type)
        VALUES (NEW.organization_id, NEW.id, user_id, 'status', OLD.status, NEW.status, 'status_change');

        INSERT INTO transaction_status_history (organization_id, transaction_id, from_status, to_status, changed_by)
        VALUES (NEW.organization_id, NEW.id, OLD.status, NEW.status, user_id);
    END IF;

    -- Track transaction details
    IF OLD.transaction_type IS DISTINCT FROM NEW.transaction_type THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'transaction_type', OLD.transaction_type, NEW.transaction_type);
    END IF;

    IF OLD.amount IS DISTINCT FROM NEW.amount THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'amount', OLD.amount::TEXT, NEW.amount::TEXT);
    END IF;

    IF OLD.currency IS DISTINCT FROM NEW.currency THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'currency', OLD.currency, NEW.currency);
    END IF;

    IF OLD.payment_method IS DISTINCT FROM NEW.payment_method THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'payment_method', OLD.payment_method, NEW.payment_method);
    END IF;

    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'payment_status', OLD.payment_status, NEW.payment_status);
    END IF;

    -- Track transaction dates
    IF OLD.transaction_date IS DISTINCT FROM NEW.transaction_date THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'transaction_date', OLD.transaction_date::TEXT, NEW.transaction_date::TEXT);
    END IF;

    IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'due_date', OLD.due_date::TEXT, NEW.due_date::TEXT);
    END IF;

    IF OLD.paid_date IS DISTINCT FROM NEW.paid_date THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'paid_date', OLD.paid_date::TEXT, NEW.paid_date::TEXT);
    END IF;

    -- Track relationships
    IF OLD.contact_id IS DISTINCT FROM NEW.contact_id THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'contact_id', OLD.contact_id::TEXT, NEW.contact_id::TEXT);
    END IF;

    IF OLD.account_id IS DISTINCT FROM NEW.account_id THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'account_id', OLD.account_id::TEXT, NEW.account_id::TEXT);
    END IF;

    -- Track reference information
    IF OLD.reference_number IS DISTINCT FROM NEW.reference_number THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'reference_number', OLD.reference_number, NEW.reference_number);
    END IF;

    IF OLD.invoice_number IS DISTINCT FROM NEW.invoice_number THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'invoice_number', OLD.invoice_number, NEW.invoice_number);
    END IF;

    -- Track description/notes
    IF OLD.description IS DISTINCT FROM NEW.description THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'description', OLD.description, NEW.description);
    END IF;

    IF OLD.notes IS DISTINCT FROM NEW.notes THEN
        INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'notes', OLD.notes, NEW.notes);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS track_transaction_changes_trigger ON transactions;
CREATE TRIGGER track_transaction_changes_trigger
    AFTER UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION track_transaction_changes();

-- Trigger for transaction creation
CREATE OR REPLACE FUNCTION track_transaction_creation()
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

    INSERT INTO transaction_change_history (organization_id, transaction_id, changed_by, field_name, old_value, new_value, change_type)
    VALUES (NEW.organization_id, NEW.id, user_id, 'created', NULL, 'Transaction created', 'creation');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS track_transaction_creation_trigger ON transactions;
CREATE TRIGGER track_transaction_creation_trigger
    AFTER INSERT ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION track_transaction_creation();
