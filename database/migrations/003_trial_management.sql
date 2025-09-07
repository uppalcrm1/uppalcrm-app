-- Enhanced Organizations table for trial management
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_status VARCHAR(50) DEFAULT 'never_started';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 30;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'trial';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS total_trial_count INTEGER DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_trial_at TIMESTAMP WITH TIME ZONE;

-- Organization Trial History table
CREATE TABLE IF NOT EXISTS organization_trial_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    trial_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    trial_duration_days INTEGER NOT NULL,
    trial_outcome VARCHAR(50), -- 'converted', 'expired', 'cancelled', 'active'
    converted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, trial_start_date)
);

-- Organization Subscriptions table
CREATE TABLE IF NOT EXISTS organization_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL,
    price_per_month DECIMAL(10,2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'trial',
    
    -- Trial Management
    trial_started_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    
    -- Subscription Management
    subscription_started_at TIMESTAMP WITH TIME ZONE,
    subscription_ends_at TIMESTAMP WITH TIME ZONE,
    next_billing_date TIMESTAMP WITH TIME ZONE,
    
    -- Payment
    last_payment_at TIMESTAMP WITH TIME ZONE,
    last_payment_amount DECIMAL(10,2),
    payment_method_id VARCHAR(255),
    payment_processor VARCHAR(50),
    
    -- Grace Period
    grace_period_ends_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_trial_status ON organizations(trial_status);
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at ON organizations(trial_ends_at);
CREATE INDEX IF NOT EXISTS idx_organizations_payment_status ON organizations(payment_status);

-- Enable RLS
ALTER TABLE organization_trial_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY organization_trial_history_isolation ON organization_trial_history
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

CREATE POLICY organization_subscriptions_isolation ON organization_subscriptions
    FOR ALL TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Function to start a 30-day trial (no waiting period)
CREATE OR REPLACE FUNCTION start_organization_trial(
    org_id UUID,
    trial_days INTEGER DEFAULT 30
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    trial_end TIMESTAMP WITH TIME ZONE;
BEGIN
    trial_end := NOW() + (trial_days || ' days')::interval;
    
    -- Update organization
    UPDATE organizations 
    SET 
        trial_started_at = NOW(),
        trial_ends_at = trial_end,
        trial_status = 'active',
        trial_days = trial_days,
        payment_status = 'trial',
        total_trial_count = COALESCE(total_trial_count, 0) + 1,
        last_trial_at = NOW(),
        is_active = true,
        updated_at = NOW()
    WHERE id = org_id;
    
    -- Create trial history record
    INSERT INTO organization_trial_history (
        organization_id,
        trial_start_date,
        trial_end_date,
        trial_duration_days,
        trial_outcome
    ) VALUES (
        org_id,
        NOW(),
        trial_end,
        trial_days,
        'active'
    );
    
    -- Create subscription record
    INSERT INTO organization_subscriptions (
        organization_id,
        plan_name,
        billing_cycle,
        price_per_month,
        status,
        trial_started_at,
        trial_ends_at
    ) VALUES (
        org_id,
        'professional',
        'monthly',
        29.00,
        'trial',
        NOW(),
        trial_end
    );
    
    RETURN TRUE;
END;
$;

-- Function to check eligibility (no waiting period required)
CREATE OR REPLACE FUNCTION can_start_new_trial(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    current_status VARCHAR(50);
BEGIN
    SELECT trial_status
    INTO current_status
    FROM organizations 
    WHERE id = org_id;
    
    -- Business rules:
    -- 1. Must not have active trial
    -- 2. No waiting period required
    -- 3. No maximum trial limit
    
    IF current_status = 'active' THEN
        RETURN FALSE; -- Already in trial
    END IF;
    
    RETURN TRUE; -- Can always start new trial when not active
END;
$;

-- Function to expire trials
CREATE OR REPLACE FUNCTION expire_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    expired_count INTEGER := 0;
    org_record RECORD;
BEGIN
    FOR org_record IN 
        SELECT id, name 
        FROM organizations 
        WHERE trial_status = 'active' 
        AND trial_ends_at <= NOW()
    LOOP
        -- Update organization status
        UPDATE organizations 
        SET 
            trial_status = 'expired',
            payment_status = 'trial_expired',
            subscription_ends_at = NOW() + interval '7 days',
            grace_period_ends_at = NOW() + interval '7 days',
            is_active = false,
            updated_at = NOW()
        WHERE id = org_record.id;
        
        -- Update subscription status
        UPDATE organization_subscriptions 
        SET 
            status = 'expired',
            grace_period_ends_at = NOW() + interval '7 days',
            updated_at = NOW()
        WHERE organization_id = org_record.id AND status = 'trial';
        
        -- Update trial history
        UPDATE organization_trial_history 
        SET trial_outcome = 'expired'
        WHERE organization_id = org_record.id AND trial_outcome = 'active';
        
        expired_count := expired_count + 1;
    END LOOP;
    
    RETURN expired_count;
END;
$;