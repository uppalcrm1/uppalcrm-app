-- Add columns to trial_signups table to store auto-generated credentials
-- This enables automatic org provisioning for trial signups

ALTER TABLE trial_signups
ADD COLUMN IF NOT EXISTS organization_slug VARCHAR(255),
ADD COLUMN IF NOT EXISTS generated_password VARCHAR(255),
ADD COLUMN IF NOT EXISTS credentials_sent_at TIMESTAMP WITH TIME ZONE;

-- Create index for organization_slug
CREATE INDEX IF NOT EXISTS idx_trial_signups_org_slug ON trial_signups(organization_slug);

COMMIT;
