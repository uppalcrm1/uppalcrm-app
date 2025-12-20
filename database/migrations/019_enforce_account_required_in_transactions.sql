-- Migration: Enforce Account Required in Transactions
-- Makes account_id and contact_id required (NOT NULL) to enforce business rule
-- Every transaction MUST be linked to an account and contact

-- Step 1: Delete any orphaned transactions (if any exist)
-- This ensures data integrity before adding constraints
DELETE FROM transactions
WHERE account_id IS NULL OR contact_id IS NULL;

-- Step 2: Make columns NOT NULL
ALTER TABLE transactions
  ALTER COLUMN account_id SET NOT NULL;

ALTER TABLE transactions
  ALTER COLUMN contact_id SET NOT NULL;

-- Step 3: Update foreign key constraints to CASCADE delete
-- If an account is deleted, its transactions should also be deleted
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_account_id_fkey,
  ADD CONSTRAINT transactions_account_id_fkey
    FOREIGN KEY (account_id)
    REFERENCES accounts(id)
    ON DELETE CASCADE;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_contact_id_fkey,
  ADD CONSTRAINT transactions_contact_id_fkey
    FOREIGN KEY (contact_id)
    REFERENCES contacts(id)
    ON DELETE CASCADE;

-- Add comment explaining the business rule
COMMENT ON COLUMN transactions.account_id IS 'Account ID (REQUIRED) - Every transaction must be linked to an account';
COMMENT ON COLUMN transactions.contact_id IS 'Contact ID (REQUIRED) - Every transaction must be linked to a contact';
