-- Migration: Add subscription management fields to organizations table
-- Purpose: Enable super admin to manage organization subscriptions and billing
-- Created: 2025-11-03

-- Add contact information fields
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);

-- Add subscription status field with validation
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial';

-- Add trial and billing date fields
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS next_billing_date TIMESTAMP WITH TIME ZONE;

-- Add cost tracking
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS monthly_cost DECIMAL(10,2) DEFAULT 0;

-- Add internal notes
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add check constraint for subscription_status
DO $$
BEGIN
    -- Drop constraint if it exists (for idempotency)
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_subscription_status'
    ) THEN
        ALTER TABLE organizations DROP CONSTRAINT check_subscription_status;
    END IF;

    -- Add constraint
    ALTER TABLE organizations
    ADD CONSTRAINT check_subscription_status
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'suspended'));
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status
ON organizations(subscription_status)
WHERE subscription_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at
ON organizations(trial_ends_at)
WHERE trial_ends_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_organizations_next_billing_date
ON organizations(next_billing_date)
WHERE next_billing_date IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN organizations.contact_email IS 'Primary contact email for the business';
COMMENT ON COLUMN organizations.contact_phone IS 'Contact phone number';
COMMENT ON COLUMN organizations.subscription_status IS 'Current subscription status: trial, active, past_due, cancelled, suspended';
COMMENT ON COLUMN organizations.trial_ends_at IS 'When the trial period ends';
COMMENT ON COLUMN organizations.billing_email IS 'Email address for billing/invoices (can differ from contact_email)';
COMMENT ON COLUMN organizations.payment_method IS 'Payment method description (e.g., Credit Card ending in 1234, PayPal, Bank Transfer)';
COMMENT ON COLUMN organizations.last_payment_date IS 'Last successful payment date';
COMMENT ON COLUMN organizations.next_billing_date IS 'Next scheduled billing date';
COMMENT ON COLUMN organizations.monthly_cost IS 'Current monthly cost for this organization';
COMMENT ON COLUMN organizations.notes IS 'Internal notes about the organization (visible only to super admin)';

-- Create a function to update subscription status based on trial expiry
CREATE OR REPLACE FUNCTION update_expired_trials()
RETURNS void AS $$
BEGIN
    UPDATE organizations
    SET subscription_status = 'suspended',
        updated_at = NOW()
    WHERE subscription_status = 'trial'
      AND trial_ends_at IS NOT NULL
      AND trial_ends_at < NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_expired_trials() IS 'Updates organizations with expired trials to suspended status';

-- Create a function to calculate next billing date based on monthly cycle
CREATE OR REPLACE FUNCTION calculate_next_billing_date(last_billing TIMESTAMP WITH TIME ZONE)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- Add 1 month to the last billing date
    RETURN (last_billing + INTERVAL '1 month')::TIMESTAMP WITH TIME ZONE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_next_billing_date(TIMESTAMP WITH TIME ZONE) IS 'Calculates next billing date by adding 1 month to the given date';

-- Log success
DO $$
BEGIN
    RAISE NOTICE '✅ Successfully added subscription management fields to organizations table';
    RAISE NOTICE '📊 Added fields: contact_email, contact_phone, subscription_status, trial_ends_at, billing_email, payment_method, last_payment_date, next_billing_date, monthly_cost, notes';
    RAISE NOTICE '🔒 Added constraint: check_subscription_status (trial, active, past_due, cancelled, suspended)';
    RAISE NOTICE '📈 Created indexes: subscription_status, trial_ends_at, next_billing_date';
    RAISE NOTICE '⚙️  Created functions: update_expired_trials(), calculate_next_billing_date()';
END $$;
