-- Platform Admin Migration
-- Creates platform_admins and trial_signups tables for Super Admin functionality

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create platform_admins table
CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trial_signups table
CREATE TABLE IF NOT EXISTS trial_signups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    website VARCHAR(500),
    phone VARCHAR(50),
    industry VARCHAR(255),
    team_size VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'qualified', 'converted', 'rejected')),
    notes TEXT,
    utm_source VARCHAR(255),
    utm_campaign VARCHAR(255),
    utm_medium VARCHAR(255),
    utm_term VARCHAR(255),
    utm_content TEXT,
    converted_organization_id UUID REFERENCES organizations(id),
    converted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email);
CREATE INDEX IF NOT EXISTS idx_platform_admins_is_active ON platform_admins(is_active);

CREATE INDEX IF NOT EXISTS idx_trial_signups_email ON trial_signups(email);
CREATE INDEX IF NOT EXISTS idx_trial_signups_status ON trial_signups(status);
CREATE INDEX IF NOT EXISTS idx_trial_signups_created_at ON trial_signups(created_at);
CREATE INDEX IF NOT EXISTS idx_trial_signups_utm_source ON trial_signups(utm_source);
CREATE INDEX IF NOT EXISTS idx_trial_signups_company ON trial_signups(company);
CREATE INDEX IF NOT EXISTS idx_trial_signups_search ON trial_signups USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || email || ' ' || company));

-- Add trigger to update updated_at timestamp on platform_admins
CREATE TRIGGER update_platform_admins_updated_at
    BEFORE UPDATE ON platform_admins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add trigger to update updated_at timestamp on trial_signups
CREATE TRIGGER update_trial_signups_updated_at
    BEFORE UPDATE ON trial_signups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default platform admin (you can change this after running the migration)
INSERT INTO platform_admins (email, password_hash, name)
VALUES (
    'admin@uppalcrm.com',
    '$2b$10$k8.1EZ3.Z3gJqHpTzJaKP.Wwd9YIyHf9.ZPHPHhMhTzHhd8XHsT1e', -- This is 'Admin123!' hashed
    'Platform Administrator'
) ON CONFLICT (email) DO NOTHING;

-- Create a function to get trial signup statistics
CREATE OR REPLACE FUNCTION get_trial_signup_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_signups',
        (SELECT COUNT(*) FROM trial_signups),
        'pending_signups',
        (SELECT COUNT(*) FROM trial_signups WHERE status = 'pending'),
        'contacted_signups',
        (SELECT COUNT(*) FROM trial_signups WHERE status = 'contacted'),
        'qualified_signups',
        (SELECT COUNT(*) FROM trial_signups WHERE status = 'qualified'),
        'converted_signups',
        (SELECT COUNT(*) FROM trial_signups WHERE status = 'converted'),
        'rejected_signups',
        (SELECT COUNT(*) FROM trial_signups WHERE status = 'rejected'),
        'total_conversions',
        (SELECT COUNT(*) FROM trial_signups WHERE converted_at IS NOT NULL),
        'signups_last_7_days',
        (SELECT COUNT(*) FROM trial_signups WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'),
        'signups_last_30_days',
        (SELECT COUNT(*) FROM trial_signups WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'),
        'conversion_rate',
        CASE
            WHEN (SELECT COUNT(*) FROM trial_signups) > 0 THEN
                ROUND(
                    (SELECT COUNT(*) FROM trial_signups WHERE converted_at IS NOT NULL)::numeric /
                    (SELECT COUNT(*) FROM trial_signups)::numeric * 100,
                    2
                )
            ELSE 0
        END
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Sample trial signups for testing (optional)
-- Uncomment these if you want some test data
/*
INSERT INTO trial_signups (first_name, last_name, email, company, industry, team_size, utm_source, utm_campaign, status) VALUES
('John', 'Doe', 'john.doe@techcorp.com', 'TechCorp Inc', 'Technology', '11-50', 'google', 'q4-2024', 'contacted'),
('Sarah', 'Johnson', 'sarah@startup.io', 'Startup.io', 'Software', '1-10', 'linkedin', 'startup-package', 'qualified'),
('Mike', 'Chen', 'mike.chen@enterprise.com', 'Enterprise Solutions', 'Consulting', '51-200', 'direct', null, 'pending'),
('Emily', 'Rodriguez', 'emily@design.studio', 'Design Studio', 'Creative', '1-10', 'facebook', 'creative-pro', 'converted'),
('David', 'Thompson', 'david@logistics.co', 'Global Logistics', 'Logistics', '201-500', 'google', 'enterprise-2024', 'pending')
ON CONFLICT (email) DO NOTHING;
*/

-- Grant necessary permissions (adjust as needed for your database user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON platform_admins TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON trial_signups TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

COMMIT;