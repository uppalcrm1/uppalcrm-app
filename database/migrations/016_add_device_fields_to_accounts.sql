-- Migration: Add device and billing fields to accounts table
-- Adds missing columns needed for lead conversion with device/billing details

-- Add device information columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS device_registered_at TIMESTAMP WITH TIME ZONE;

-- Add license information columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS license_key VARCHAR(255);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS license_status VARCHAR(50) DEFAULT 'pending';

-- Add billing columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(50);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';

-- Add trial information columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE;

-- Add subscription date columns
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_start_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_end_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS next_renewal_date TIMESTAMP WITH TIME ZONE;

-- Add notes and custom fields
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_accounts_mac_address ON accounts(mac_address);
CREATE INDEX IF NOT EXISTS idx_accounts_license_status ON accounts(license_status);
CREATE INDEX IF NOT EXISTS idx_accounts_next_renewal_date ON accounts(next_renewal_date);

-- Add comments
COMMENT ON COLUMN accounts.device_name IS 'Name of the device/license assigned to this account';
COMMENT ON COLUMN accounts.mac_address IS 'MAC address of the registered device';
COMMENT ON COLUMN accounts.billing_cycle IS 'Billing frequency: monthly, quarterly, semi-annual, annual';
COMMENT ON COLUMN accounts.is_trial IS 'Whether this is a trial account';
