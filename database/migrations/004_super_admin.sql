-- Super Admin Database Schema
-- Additional tables for platform management

-- Super admin users (separate from tenant users)
CREATE TABLE IF NOT EXISTS super_admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'super_admin',
    permissions JSONB DEFAULT '["view_all_organizations", "manage_trials", "view_analytics"]',
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Platform-wide business metrics tracking
CREATE TABLE IF NOT EXISTS platform_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    new_trials_started INTEGER DEFAULT 0,
    trials_expired INTEGER DEFAULT 0,
    trials_converted INTEGER DEFAULT 0,
    active_trials INTEGER DEFAULT 0,
    new_organizations INTEGER DEFAULT 0,
    active_organizations INTEGER DEFAULT 0,
    churned_organizations INTEGER DEFAULT 0,
    new_mrr DECIMAL(12,2) DEFAULT 0,
    churned_mrr DECIMAL(12,2) DEFAULT 0,
    total_mrr DECIMAL(12,2) DEFAULT 0,
    new_business_leads INTEGER DEFAULT 0,
    qualified_leads INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(date)
);

-- Organization notes and interactions
CREATE TABLE IF NOT EXISTS organization_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    admin_user_id UUID NOT NULL REFERENCES super_admin_users(id),
    note_type VARCHAR(50) NOT NULL,
    title VARCHAR(255),
    content TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'normal',
    follow_up_date DATE,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Organization engagement tracking
CREATE TABLE IF NOT EXISTS organization_engagement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_logins INTEGER DEFAULT 0,
    unique_users_active INTEGER DEFAULT 0,
    leads_created INTEGER DEFAULT 0,
    contacts_created INTEGER DEFAULT 0,
    features_used JSONB DEFAULT '[]',
    engagement_score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, date)
);

-- Super admin session management
CREATE TABLE IF NOT EXISTS super_admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_platform_metrics_date ON platform_metrics(date);
CREATE INDEX IF NOT EXISTS idx_organization_notes_org_id ON organization_notes(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_engagement_org_date ON organization_engagement(organization_id, date);
CREATE INDEX IF NOT EXISTS idx_super_admin_sessions_token ON super_admin_sessions(token_hash);

-- Views for common queries
CREATE OR REPLACE VIEW trial_overview AS
SELECT 
    o.id,
    o.name as organization_name,
    o.domain,
    o.trial_status,
    o.payment_status,
    o.trial_started_at,
    o.trial_ends_at,
    o.total_trial_count,
    EXTRACT(days FROM (o.trial_ends_at - NOW()))::INTEGER as days_remaining,
    u.first_name || ' ' || u.last_name as admin_name,
    u.email as admin_email,
    u.last_login as admin_last_login,
    COALESCE(latest_engagement.engagement_score, 0) as engagement_score,
    COALESCE(latest_engagement.total_logins, 0) as recent_logins,
    user_count.total_users,
    user_count.active_users,
    o.created_at as trial_created_at
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
LEFT JOIN (
    SELECT 
        organization_id,
        engagement_score,
        total_logins,
        ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY date DESC) as rn
    FROM organization_engagement
) latest_engagement ON latest_engagement.organization_id = o.id AND latest_engagement.rn = 1
LEFT JOIN (
    SELECT 
        organization_id,
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE is_active = true) as active_users
    FROM users
    GROUP BY organization_id
) user_count ON user_count.organization_id = o.id
WHERE o.trial_status IN ('active', 'expired', 'converted')
ORDER BY o.trial_ends_at ASC NULLS LAST;

-- Business leads view
CREATE OR REPLACE VIEW business_leads AS
SELECT 
    o.id,
    o.name as company_name,
    o.domain,
    o.trial_status,
    u.first_name || ' ' || u.last_name as contact_name,
    u.email as contact_email,
    o.trial_started_at as lead_date,
    o.trial_ends_at,
    EXTRACT(days FROM (NOW() - o.trial_started_at))::INTEGER as days_since_signup,
    COALESCE(latest_engagement.engagement_score, 0) as engagement_score,
    CASE 
        WHEN COALESCE(latest_engagement.engagement_score, 0) >= 70 THEN 'Hot'
        WHEN COALESCE(latest_engagement.engagement_score, 0) >= 40 THEN 'Warm'
        ELSE 'Cold'
    END as lead_temperature,
    COALESCE(note_count.total_notes, 0) as notes_count,
    o.created_at
FROM organizations o
LEFT JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
LEFT JOIN (
    SELECT 
        organization_id,
        engagement_score,
        ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY date DESC) as rn
    FROM organization_engagement
) latest_engagement ON latest_engagement.organization_id = o.id AND latest_engagement.rn = 1
LEFT JOIN (
    SELECT organization_id, COUNT(*) as total_notes
    FROM organization_notes GROUP BY organization_id
) note_count ON note_count.organization_id = o.id
WHERE o.trial_started_at IS NOT NULL
ORDER BY o.trial_started_at DESC;

-- Functions
CREATE OR REPLACE FUNCTION calculate_daily_metrics(metric_date DATE DEFAULT CURRENT_DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO platform_metrics (
        date, new_trials_started, trials_expired, trials_converted,
        active_trials, new_organizations, active_organizations, new_business_leads
    )
    SELECT 
        metric_date,
        COUNT(*) FILTER (WHERE DATE(trial_started_at) = metric_date),
        COUNT(*) FILTER (WHERE DATE(trial_ends_at) = metric_date AND trial_status = 'expired'),
        (SELECT COUNT(*) FROM organization_subscriptions 
         WHERE DATE(subscription_started_at) = metric_date AND status = 'active'),
        COUNT(*) FILTER (WHERE trial_status = 'active'),
        COUNT(*) FILTER (WHERE DATE(created_at) = metric_date),
        COUNT(*) FILTER (WHERE is_active = true),
        COUNT(*) FILTER (WHERE DATE(trial_started_at) = metric_date)
    FROM organizations
    ON CONFLICT (date) DO UPDATE SET
        new_trials_started = EXCLUDED.new_trials_started,
        trials_expired = EXCLUDED.trials_expired,
        trials_converted = EXCLUDED.trials_converted,
        active_trials = EXCLUDED.active_trials,
        new_organizations = EXCLUDED.new_organizations,
        active_organizations = EXCLUDED.active_organizations,
        new_business_leads = EXCLUDED.new_business_leads;
    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION get_expiring_trials(days_ahead INTEGER DEFAULT 7)
RETURNS TABLE (
    organization_id UUID, organization_name VARCHAR(255), admin_name TEXT,
    admin_email VARCHAR(255), days_remaining INTEGER, engagement_score INTEGER, risk_level TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tv.id, tv.organization_name, tv.admin_name, tv.admin_email, tv.days_remaining, tv.engagement_score,
        CASE 
            WHEN tv.days_remaining <= 1 AND tv.engagement_score < 30 THEN 'Critical'
            WHEN tv.days_remaining <= 3 AND tv.engagement_score < 50 THEN 'High'
            WHEN tv.days_remaining <= 7 AND tv.engagement_score < 70 THEN 'Medium'
            ELSE 'Low'
        END
    FROM trial_overview tv
    WHERE tv.trial_status = 'active' AND tv.days_remaining BETWEEN 0 AND days_ahead
    ORDER BY tv.days_remaining ASC, tv.engagement_score ASC;
END;
$$;

-- Insert initial super admin user (password: admin123)
INSERT INTO super_admin_users (email, password_hash, first_name, last_name)
VALUES (
    'admin@yourcrm.com', 
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewdBNT8K4Q5V0VgG',
    'Super', 'Admin'
) ON CONFLICT (email) DO NOTHING;