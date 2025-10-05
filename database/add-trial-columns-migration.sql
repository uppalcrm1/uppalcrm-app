-- Add missing trial-related columns to organizations table
-- This migration adds columns that the application expects but are missing

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT FALSE;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_status VARCHAR(50);

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE;

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE;

-- Update existing organizations with subscription_plan = 'trial' to have is_trial = true
UPDATE organizations
SET is_trial = TRUE,
    trial_status = 'active'
WHERE subscription_plan = 'trial' AND is_trial IS NULL;

-- Add constraint to ensure trial_status has valid values
ALTER TABLE organizations
ADD CONSTRAINT trial_status_check
CHECK (trial_status IS NULL OR trial_status IN ('active', 'expired', 'converted'));

-- Add comment for documentation
COMMENT ON COLUMN organizations.is_trial IS 'True if organization is in trial period, false if paid';
COMMENT ON COLUMN organizations.trial_status IS 'Status of trial: active, expired, or converted (to paid)';
COMMENT ON COLUMN organizations.trial_start_date IS 'When the trial period started';
COMMENT ON COLUMN organizations.trial_expires_at IS 'When the trial period expires';
