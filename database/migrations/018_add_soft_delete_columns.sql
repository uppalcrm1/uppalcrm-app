-- =====================================================
-- MIGRATION 018: SOFT DELETE SYSTEM
-- Adds soft delete capability to accounts and transactions
-- Author: Account Management Agent
-- Date: 2025-12-15
-- =====================================================

-- PURPOSE:
-- Implement soft delete functionality to preserve data integrity,
-- maintain audit trails, and comply with financial record retention requirements.
--
-- Instead of permanently deleting records (DELETE FROM table), we mark them
-- as deleted (UPDATE table SET deleted_at = NOW()) so data remains for:
-- - Audit trails and compliance
-- - Financial record retention
-- - Accidental deletion recovery
-- - Referential integrity maintenance

-- =====================================================
-- STEP 1: ADD SOFT DELETE COLUMNS TO ACCOUNTS TABLE
-- =====================================================

ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- =====================================================
-- STEP 2: ADD SOFT DELETE COLUMNS TO TRANSACTIONS TABLE
-- =====================================================

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS deletion_reason TEXT,
ADD COLUMN IF NOT EXISTS is_void BOOLEAN DEFAULT FALSE;

-- =====================================================
-- STEP 3: CREATE INDEXES FOR PERFORMANCE
-- =====================================================
-- These indexes are critical for query performance when filtering
-- by deleted_at IS NULL (which will be added to most queries)

CREATE INDEX IF NOT EXISTS idx_accounts_deleted_at
ON accounts(deleted_at);

CREATE INDEX IF NOT EXISTS idx_transactions_deleted_at
ON transactions(deleted_at);

-- Composite indexes for the most common query pattern:
-- WHERE organization_id = ? AND deleted_at IS NULL
-- The partial index only indexes rows where deleted_at IS NULL,
-- making queries for active (non-deleted) records very fast

CREATE INDEX IF NOT EXISTS idx_accounts_org_not_deleted
ON accounts(organization_id, deleted_at)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_org_not_deleted
ON transactions(organization_id, deleted_at)
WHERE deleted_at IS NULL;

-- =====================================================
-- STEP 4: ADD COLUMN DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN accounts.deleted_at IS
'Timestamp when record was soft deleted (NULL = active, not deleted)';

COMMENT ON COLUMN accounts.deleted_by IS
'UUID of user who deleted this record (for audit trail)';

COMMENT ON COLUMN accounts.deletion_reason IS
'User-provided reason for deletion (e.g., "Customer requested cancellation", "Non-payment", "Duplicate account")';

COMMENT ON COLUMN transactions.deleted_at IS
'Timestamp when transaction was voided/soft deleted (NULL = valid transaction)';

COMMENT ON COLUMN transactions.deleted_by IS
'UUID of user who voided this transaction (for audit trail)';

COMMENT ON COLUMN transactions.deletion_reason IS
'User-provided reason for voiding (e.g., "Duplicate entry", "Data entry error", "Fraudulent transaction")';

COMMENT ON COLUMN transactions.is_void IS
'Mark transaction as void for accounting purposes (soft delete). When TRUE, transaction should be excluded from revenue calculations';

-- =====================================================
-- STEP 5: CREATE AUDIT LOG TABLE (if not exists)
-- =====================================================
-- This table logs all soft delete and restore operations
-- for complete audit trail

CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Action details
    action VARCHAR(50) NOT NULL, -- 'soft_delete', 'restore', 'void'
    entity_type VARCHAR(50) NOT NULL, -- 'account', 'transaction'
    entity_id UUID NOT NULL,

    -- Who and when
    performed_by UUID REFERENCES users(id),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Additional context
    reason TEXT,
    metadata JSONB, -- Store additional data (old values, new values, etc.)

    -- IP and session info (for security)
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Index for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_log_organization
ON audit_log(organization_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
ON audit_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_performed_at
ON audit_log(performed_at DESC);

-- Enable RLS on audit log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_isolation_policy ON audit_log;
CREATE POLICY audit_log_isolation_policy ON audit_log
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

COMMENT ON TABLE audit_log IS
'Audit trail for all soft delete, restore, and void operations';

-- =====================================================
-- STEP 6: CREATE HELPER FUNCTIONS
-- =====================================================

-- Function to log soft delete operations
CREATE OR REPLACE FUNCTION log_soft_delete_operation()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if deleted_at changed from NULL to a timestamp
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
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
                'previous_status', CASE
                    WHEN TG_TABLE_NAME = 'accounts' THEN OLD.account_type
                    WHEN TG_TABLE_NAME = 'transactions' THEN OLD.status
                    ELSE NULL
                END
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

-- =====================================================
-- STEP 7: CREATE TRIGGERS FOR AUTOMATIC AUDIT LOGGING
-- =====================================================

-- Trigger for accounts table
DROP TRIGGER IF EXISTS trigger_log_account_soft_delete ON accounts;
CREATE TRIGGER trigger_log_account_soft_delete
    AFTER UPDATE ON accounts
    FOR EACH ROW
    WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
    EXECUTE FUNCTION log_soft_delete_operation();

-- Trigger for transactions table
DROP TRIGGER IF EXISTS trigger_log_transaction_soft_delete ON transactions;
CREATE TRIGGER trigger_log_transaction_soft_delete
    AFTER UPDATE ON transactions
    FOR EACH ROW
    WHEN (OLD.deleted_at IS DISTINCT FROM NEW.deleted_at)
    EXECUTE FUNCTION log_soft_delete_operation();

-- =====================================================
-- STEP 8: CREATE VIEWS FOR CONVENIENCE
-- =====================================================

-- View for active (non-deleted) accounts
CREATE OR REPLACE VIEW active_accounts AS
SELECT * FROM accounts
WHERE deleted_at IS NULL;

COMMENT ON VIEW active_accounts IS
'Shows only active (non-deleted) accounts. Use this view for standard queries.';

-- View for active (non-voided) transactions
CREATE OR REPLACE VIEW active_transactions AS
SELECT * FROM transactions
WHERE deleted_at IS NULL AND is_void = FALSE;

COMMENT ON VIEW active_transactions IS
'Shows only active (non-voided) transactions. Use for revenue calculations.';

-- View for deleted accounts (for admin review)
CREATE OR REPLACE VIEW deleted_accounts AS
SELECT
    a.*,
    u.email as deleted_by_email,
    u.first_name || ' ' || u.last_name as deleted_by_name
FROM accounts a
LEFT JOIN users u ON a.deleted_by = u.id
WHERE a.deleted_at IS NOT NULL
ORDER BY a.deleted_at DESC;

COMMENT ON VIEW deleted_accounts IS
'Shows deleted accounts with deletion details. Admin use only.';

-- View for voided transactions (for admin review)
CREATE OR REPLACE VIEW voided_transactions AS
SELECT
    t.*,
    u.email as voided_by_email,
    u.first_name || ' ' || u.last_name as voided_by_name
FROM transactions t
LEFT JOIN users u ON t.deleted_by = u.id
WHERE t.deleted_at IS NOT NULL OR t.is_void = TRUE
ORDER BY t.deleted_at DESC;

COMMENT ON VIEW voided_transactions IS
'Shows voided transactions with void details. Admin use only.';

-- =====================================================
-- STEP 9: MIGRATION VERIFICATION
-- =====================================================

-- Verify columns were added
DO $$
DECLARE
    accounts_deleted_at_exists BOOLEAN;
    transactions_deleted_at_exists BOOLEAN;
    audit_log_exists BOOLEAN;
BEGIN
    -- Check accounts table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'deleted_at'
    ) INTO accounts_deleted_at_exists;

    -- Check transactions table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'transactions' AND column_name = 'deleted_at'
    ) INTO transactions_deleted_at_exists;

    -- Check audit_log table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'audit_log'
    ) INTO audit_log_exists;

    -- Report results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SOFT DELETE MIGRATION VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Accounts.deleted_at column: %',
        CASE WHEN accounts_deleted_at_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE 'Transactions.deleted_at column: %',
        CASE WHEN transactions_deleted_at_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE 'Audit_log table: %',
        CASE WHEN audit_log_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
    RAISE NOTICE '========================================';

    -- Verify all components exist
    IF NOT (accounts_deleted_at_exists AND transactions_deleted_at_exists AND audit_log_exists) THEN
        RAISE EXCEPTION 'Migration incomplete! Some components are missing.';
    ELSE
        RAISE NOTICE '✓ Migration completed successfully!';
    END IF;
END;
$$;

-- =====================================================
-- MIGRATION NOTES
-- =====================================================
--
-- IMPORTANT IMPLEMENTATION NOTES:
--
-- 1. QUERY UPDATES REQUIRED:
--    All queries fetching accounts or transactions MUST now add:
--    WHERE deleted_at IS NULL
--
--    Example:
--    OLD: SELECT * FROM accounts WHERE organization_id = ?
--    NEW: SELECT * FROM accounts WHERE organization_id = ? AND deleted_at IS NULL
--
-- 2. SOFT DELETE OPERATION:
--    Instead of: DELETE FROM accounts WHERE id = ?
--    Use: UPDATE accounts SET deleted_at = NOW(), deleted_by = ?, deletion_reason = ? WHERE id = ?
--
-- 3. RESTORE OPERATION:
--    UPDATE accounts SET deleted_at = NULL, deleted_by = NULL, deletion_reason = NULL WHERE id = ?
--
-- 4. REVENUE CALCULATIONS:
--    Exclude voided transactions:
--    WHERE deleted_at IS NULL AND is_void = FALSE
--
-- 5. ADMIN VIEW:
--    Admins can view deleted records by:
--    - Using includeDeleted=true query parameter
--    - Querying the deleted_accounts or voided_transactions views
--
-- 6. DATA RETENTION:
--    Deleted records remain in database indefinitely.
--    Consider archiving old deleted records (>2 years) to separate table.
--
-- 7. BACKUP BEFORE RUNNING:
--    Always backup database before running this migration!
--
-- =====================================================
-- ROLLBACK INSTRUCTIONS (IF NEEDED)
-- =====================================================
--
-- To rollback this migration:
--
-- DROP VIEW IF EXISTS active_accounts;
-- DROP VIEW IF EXISTS active_transactions;
-- DROP VIEW IF EXISTS deleted_accounts;
-- DROP VIEW IF EXISTS voided_transactions;
--
-- DROP TRIGGER IF EXISTS trigger_log_account_soft_delete ON accounts;
-- DROP TRIGGER IF EXISTS trigger_log_transaction_soft_delete ON transactions;
-- DROP FUNCTION IF EXISTS log_soft_delete_operation();
--
-- DROP TABLE IF EXISTS audit_log;
--
-- DROP INDEX IF EXISTS idx_accounts_deleted_at;
-- DROP INDEX IF EXISTS idx_transactions_deleted_at;
-- DROP INDEX IF EXISTS idx_accounts_org_not_deleted;
-- DROP INDEX IF EXISTS idx_transactions_org_not_deleted;
--
-- ALTER TABLE accounts DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS deleted_by;
-- ALTER TABLE accounts DROP COLUMN IF EXISTS deletion_reason;
--
-- ALTER TABLE transactions DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS deleted_by;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS deletion_reason;
-- ALTER TABLE transactions DROP COLUMN IF EXISTS is_void;
--
-- =====================================================
