-- =====================================================
-- FIX: Update triggers that reference dropped account_type column
-- Date: 2026-03-05
-- Description: Migration 020 dropped the account_type column and replaced it
--   with account_status. But two trigger functions still reference OLD.account_type,
--   causing "record 'old' has no field 'account_type'" errors on account updates
--   (including soft deletes).
--
-- Fixes:
--   1. log_soft_delete_operation() - change OLD.account_type → OLD.account_status
--   2. track_account_changes()    - change OLD/NEW.account_type → OLD/NEW.account_status
-- =====================================================

-- Fix 1: log_soft_delete_operation()
CREATE OR REPLACE FUNCTION log_soft_delete_operation()
RETURNS TRIGGER AS $$
DECLARE
    previous_value TEXT;
BEGIN
    -- Only log if deleted_at changed from NULL to a timestamp (soft delete)
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        -- Get the previous status/type value based on table
        IF TG_TABLE_NAME = 'accounts' THEN
            previous_value := OLD.account_status;
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

-- Fix 2: track_account_changes()
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

    -- Track account name changes
    IF OLD.account_name IS DISTINCT FROM NEW.account_name THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'account_name', OLD.account_name, NEW.account_name);
    END IF;

    -- Track account_status changes (was account_type before migration 020)
    IF OLD.account_status IS DISTINCT FROM NEW.account_status THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'account_status', OLD.account_status, NEW.account_status);
    END IF;

    -- Track contact changes
    IF OLD.contact_id IS DISTINCT FROM NEW.contact_id THEN
        INSERT INTO account_change_history (organization_id, account_id, changed_by, field_name, old_value, new_value)
        VALUES (NEW.organization_id, NEW.id, user_id, 'contact_id', OLD.contact_id::TEXT, NEW.contact_id::TEXT);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verify
DO $$
BEGIN
    RAISE NOTICE '✅ Fixed trigger functions:';
    RAISE NOTICE '   - log_soft_delete_operation(): OLD.account_type → OLD.account_status';
    RAISE NOTICE '   - track_account_changes(): OLD/NEW.account_type → OLD/NEW.account_status';
END;
$$;
