-- Migration 020: Consolidate account_type + license_status → account_status
-- Replaces three fields (account_type, license_status, is_trial) with single account_status field
-- Valid values: active, inactive, suspended, cancelled, on_hold

BEGIN;

-- Step 1: Add the new account_status column
ALTER TABLE accounts
ADD COLUMN account_status VARCHAR(50) DEFAULT 'active';

-- Step 2: Drop dependent views
DROP VIEW IF EXISTS active_accounts CASCADE;
DROP VIEW IF EXISTS deleted_accounts CASCADE;

-- Step 3: Migrate data from license_status to account_status
-- Mapping: pending → on_hold, expired → inactive, active/suspended/cancelled stay same
UPDATE accounts
SET account_status = CASE
    WHEN license_status = 'pending' THEN 'on_hold'
    WHEN license_status = 'expired' THEN 'inactive'
    WHEN license_status IN ('active', 'suspended', 'cancelled') THEN license_status
    ELSE 'active'
END
WHERE deleted_at IS NULL;

-- For soft-deleted accounts, set status to cancelled
UPDATE accounts
SET account_status = 'cancelled'
WHERE deleted_at IS NOT NULL;

-- Step 4: Drop the old columns
ALTER TABLE accounts DROP COLUMN license_status;
ALTER TABLE accounts DROP COLUMN account_type;
ALTER TABLE accounts DROP COLUMN is_trial;

-- Step 4: Update indexes - drop old indexes
DROP INDEX IF EXISTS idx_accounts_license_status;
DROP INDEX IF EXISTS idx_accounts_account_type;

-- Step 5: Create new index for account_status
CREATE INDEX idx_accounts_account_status ON accounts(account_status);

-- Step 6: Update indexes - verify new index on account_status was created
-- (account_change_history updates are optional and handled separately if needed)

COMMIT;
