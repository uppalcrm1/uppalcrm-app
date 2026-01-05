-- Migration: Add billing_term_months column to accounts table
-- This helps with renewal date calculations and makes billing terms explicit

-- Add billing_term_months column
ALTER TABLE accounts
ADD COLUMN IF NOT EXISTS billing_term_months INTEGER DEFAULT 1;

-- Update existing records to set billing_term_months based on billing_cycle
UPDATE accounts
SET billing_term_months = CASE
  WHEN billing_cycle = 'monthly' THEN 1
  WHEN billing_cycle = 'quarterly' THEN 3
  WHEN billing_cycle = 'semi_annual' OR billing_cycle = 'semi-annual' THEN 6
  WHEN billing_cycle = 'annual' THEN 12
  WHEN billing_cycle = 'biennial' OR billing_cycle = 'bi-annual' THEN 24
  ELSE 1
END
WHERE billing_term_months IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_accounts_next_renewal
ON accounts(next_renewal_date)
WHERE next_renewal_date IS NOT NULL;

-- Add comment
COMMENT ON COLUMN accounts.billing_term_months IS 'Number of months in billing term (1=monthly, 3=quarterly, 6=semi-annual, 12=annual, 24=biennial)';
