-- =====================================================
-- MIGRATION 018a: FIX SOFT DELETE TRIGGER
-- Fixes the trigger function to avoid field reference errors
-- Author: Account Management Agent
-- Date: 2025-12-15
-- =====================================================

-- Drop the problematic trigger function and recreate it with proper handling
DROP FUNCTION IF EXISTS log_soft_delete_operation() CASCADE;

-- Create improved trigger function that handles table-specific fields properly
CREATE OR REPLACE FUNCTION log_soft_delete_operation()
RETURNS TRIGGER AS $$
DECLARE
    previous_value TEXT;
BEGIN
    -- Only log if deleted_at changed from NULL to a timestamp (soft delete)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Get the previous status/type value based on table
        IF TG_TABLE_NAME = 'accounts' THEN
            previous_value := OLD.account_type;
        ELSIF TG_TABLE_NAME = 'transactions' THEN
            previous_value := OLD.status;
        ELSE
            previous_value := NULL;
        END IF;

        INSERT INTO audit_log (
            organization_id,
            action,
            entity_type,
            entity_id,
            performed_by,
            reason,
            metadata
        ) VALUES (
            NEW.organization_id,
            'soft_delete',
            TG_TABLE_NAME,
            NEW.id,
            NEW.deleted_by,
            NEW.deletion_reason,
            jsonb_build_object(
                'deleted_at', NEW.deleted_at,
                'previous_status', previous_value
            )
        );
    END IF;

    -- Log restore operations (deleted_at changes from timestamp to NULL)
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        INSERT INTO audit_log (
            organization_id,
            action,
            entity_type,
            entity_id,
            performed_by,
            metadata
        ) VALUES (
            NEW.organization_id,
            'restore',
            TG_TABLE_NAME,
            NEW.id,
            NEW.updated_by,
            jsonb_build_object(
                'restored_at', NOW(),
                'was_deleted_at', OLD.deleted_at,
                'was_deleted_by', OLD.deleted_by,
                'original_deletion_reason', OLD.deletion_reason
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate triggers for both tables
DROP TRIGGER IF EXISTS trigger_log_account_soft_delete ON accounts;
CREATE TRIGGER trigger_log_account_soft_delete
    AFTER UPDATE ON accounts
    FOR EACH ROW
    WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
    EXECUTE FUNCTION log_soft_delete_operation();

DROP TRIGGER IF EXISTS trigger_log_transaction_soft_delete ON transactions;
CREATE TRIGGER trigger_log_transaction_soft_delete
    AFTER UPDATE ON transactions
    FOR EACH ROW
    WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
    EXECUTE FUNCTION log_soft_delete_operation();

-- Verify the fix
DO $$
BEGIN
    RAISE NOTICE '✅ Trigger function updated successfully!';
    RAISE NOTICE '   - Fixed field reference issue';
    RAISE NOTICE '   - Triggers recreated for accounts and transactions';
END;
$$;
