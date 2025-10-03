-- Trial Management System Migration
-- Adds 30-day trial tracking and management capabilities

-- ============================================
-- 1. Update trial_signups table
-- ============================================

ALTER TABLE trial_signups
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_extended BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_extension_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trial_extension_count INTEGER DEFAULT 0;

-- Create index for trial end date (for finding expiring/expired trials)
CREATE INDEX IF NOT EXISTS idx_trial_signups_end_date ON trial_signups(trial_end_date);

-- ============================================
-- 2. Update organizations table
-- ============================================

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_trial BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS trial_status VARCHAR(20) DEFAULT 'active';

-- Create index for trial expiration checks
CREATE INDEX IF NOT EXISTS idx_organizations_trial_expires ON organizations(trial_expires_at) WHERE is_trial = true;
CREATE INDEX IF NOT EXISTS idx_organizations_trial_status ON organizations(trial_status) WHERE is_trial = true;

-- Add constraint for trial_status enum values
ALTER TABLE organizations
DROP CONSTRAINT IF EXISTS trial_status_check;

ALTER TABLE organizations
ADD CONSTRAINT trial_status_check
CHECK (trial_status IN ('active', 'expired', 'converted'));

-- ============================================
-- 3. Update existing trial signups with dates
-- ============================================

-- Set trial dates for already converted signups (if converted_at exists)
UPDATE trial_signups
SET
    trial_start_date = converted_at,
    trial_end_date = converted_at + INTERVAL '30 days'
WHERE converted_at IS NOT NULL
  AND trial_start_date IS NULL;

-- Set trial dates for pending signups (use created_at as estimate)
UPDATE trial_signups
SET
    trial_start_date = created_at,
    trial_end_date = created_at + INTERVAL '30 days'
WHERE trial_start_date IS NULL;

-- ============================================
-- 4. Update existing organizations
-- ============================================

-- Mark organizations created from trial signups as trials
UPDATE organizations o
SET
    is_trial = true,
    trial_status = CASE
        WHEN NOW() > (o.created_at + INTERVAL '30 days') THEN 'expired'
        ELSE 'active'
    END,
    trial_expires_at = o.created_at + INTERVAL '30 days'
FROM trial_signups ts
WHERE o.id = ts.converted_organization_id
  AND o.is_trial IS NULL;

-- ============================================
-- 5. Helper function to calculate trial days remaining
-- ============================================

CREATE OR REPLACE FUNCTION get_trial_days_remaining(trial_end TIMESTAMP WITH TIME ZONE)
RETURNS INTEGER AS $$
BEGIN
    RETURN GREATEST(0, EXTRACT(DAY FROM (trial_end - NOW()))::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- 6. Helper function to extend trial
-- ============================================

CREATE OR REPLACE FUNCTION extend_trial(
    p_trial_signup_id UUID,
    p_extension_days INTEGER DEFAULT 30
)
RETURNS TABLE(
    new_end_date TIMESTAMP WITH TIME ZONE,
    total_extensions INTEGER
) AS $$
DECLARE
    v_current_end_date TIMESTAMP WITH TIME ZONE;
    v_new_end_date TIMESTAMP WITH TIME ZONE;
    v_org_id UUID;
    v_extension_count INTEGER;
BEGIN
    -- Get current trial info
    SELECT trial_end_date, converted_organization_id, trial_extension_count
    INTO v_current_end_date, v_org_id, v_extension_count
    FROM trial_signups
    WHERE id = p_trial_signup_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trial signup not found';
    END IF;

    -- Calculate new end date
    v_new_end_date := v_current_end_date + (p_extension_days || ' days')::INTERVAL;
    v_extension_count := COALESCE(v_extension_count, 0) + 1;

    -- Update trial_signups
    UPDATE trial_signups
    SET
        trial_end_date = v_new_end_date,
        trial_extended = true,
        trial_extension_date = NOW(),
        trial_extension_count = v_extension_count
    WHERE id = p_trial_signup_id;

    -- Update organization if it exists
    IF v_org_id IS NOT NULL THEN
        UPDATE organizations
        SET
            trial_expires_at = v_new_end_date,
            trial_status = 'active'
        WHERE id = v_org_id;
    END IF;

    RETURN QUERY SELECT v_new_end_date, v_extension_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. Helper function to archive expired trial
-- ============================================

CREATE OR REPLACE FUNCTION archive_expired_trial(p_trial_signup_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
    v_trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get organization ID and trial end date
    SELECT converted_organization_id, trial_end_date
    INTO v_org_id, v_trial_end
    FROM trial_signups
    WHERE id = p_trial_signup_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trial signup not found';
    END IF;

    -- Check if trial is actually expired
    IF v_trial_end > NOW() THEN
        RAISE EXCEPTION 'Trial has not expired yet';
    END IF;

    -- Update trial signup status
    UPDATE trial_signups
    SET status = 'expired'
    WHERE id = p_trial_signup_id;

    -- Deactivate organization if it exists
    IF v_org_id IS NOT NULL THEN
        UPDATE organizations
        SET
            is_active = false,
            trial_status = 'expired'
        WHERE id = v_org_id;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

COMMIT;
