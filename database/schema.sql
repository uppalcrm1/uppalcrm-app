-- Multi-tenant CRM Database Schema
-- This schema implements row-level security for complete tenant isolation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;

-- Organizations table (tenants)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    settings JSONB DEFAULT '{}',
    subscription_plan VARCHAR(50) DEFAULT 'starter',
    max_users INTEGER DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Users table with tenant isolation
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- admin, user, viewer
    permissions JSONB DEFAULT '[]',
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    
    -- Ensure globally unique email
    UNIQUE(email)
);

-- User sessions for JWT token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Create indexes for performance
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_lookup ON users(email) WHERE is_active = true;
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for organizations
CREATE POLICY org_isolation ON organizations
    FOR ALL
    TO PUBLIC
    USING (id = current_setting('app.current_organization_id')::uuid);

-- Create RLS policies for users
CREATE POLICY user_isolation ON users
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Create RLS policies for user_sessions
CREATE POLICY session_isolation ON user_sessions
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to validate user count limit
CREATE OR REPLACE FUNCTION check_user_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_count INTEGER;
    max_users INTEGER;
BEGIN
    SELECT COUNT(*), o.max_users 
    INTO user_count, max_users
    FROM users u
    JOIN organizations o ON o.id = u.organization_id
    WHERE u.organization_id = NEW.organization_id
      AND u.is_active = true
    GROUP BY o.max_users;
    
    IF user_count >= max_users THEN
        RAISE EXCEPTION 'User limit exceeded for organization. Current: %, Max: %', user_count, max_users;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce user limits
CREATE TRIGGER enforce_user_limit
    BEFORE INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION check_user_limit();

-- Function to create organization with first admin user
CREATE OR REPLACE FUNCTION create_organization_with_admin(
    org_name TEXT,
    org_slug TEXT,
    admin_email TEXT,
    admin_password_hash TEXT,
    admin_first_name TEXT,
    admin_last_name TEXT,
    org_domain TEXT DEFAULT NULL
) RETURNS TABLE (
    organization_id UUID,
    user_id UUID
) AS $$
DECLARE
    new_org_id UUID;
    new_user_id UUID;
BEGIN
    -- Create organization
    INSERT INTO organizations (name, slug, domain)
    VALUES (org_name, org_slug, org_domain)
    RETURNING id INTO new_org_id;
    
    -- Temporarily disable RLS to create the first admin user
    SET LOCAL row_security = off;
    
    -- Create admin user
    INSERT INTO users (
        organization_id, 
        email, 
        password_hash, 
        first_name, 
        last_name, 
        role,
        email_verified,
        is_active
    )
    VALUES (
        new_org_id,
        admin_email,
        admin_password_hash,
        admin_first_name,
        admin_last_name,
        'admin',
        true,
        true
    )
    RETURNING id INTO new_user_id;
    
    -- Re-enable RLS
    SET LOCAL row_security = on;
    
    RETURN QUERY SELECT new_org_id, new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;