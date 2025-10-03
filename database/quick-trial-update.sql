-- Quick update to mark existing organizations as trials
-- Run this after the main migration to test the trial UI

-- First, make sure the columns exist
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_status VARCHAR(20) DEFAULT 'active';

-- Mark all current organizations as active trials expiring in 30 days
UPDATE organizations
SET
    is_trial = true,
    trial_status = 'active',
    trial_expires_at = NOW() + INTERVAL '30 days'
WHERE is_trial IS NULL OR is_trial = false;

-- Verify the update
SELECT
    id,
    name,
    is_trial,
    trial_status,
    trial_expires_at,
    EXTRACT(DAY FROM (trial_expires_at - NOW()))::INTEGER as days_remaining
FROM organizations;
