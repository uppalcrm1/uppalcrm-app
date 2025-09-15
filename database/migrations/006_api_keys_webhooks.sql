-- Migration: API Keys and Webhook Endpoints for Multi-tenant Zapier Integration
-- Date: 2025-09-15
-- Description: Creates tables for API key management and webhook endpoints with RLS

BEGIN;

-- =============================================================================
-- 1. API KEYS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- bcrypt hash of the full API key
    key_prefix VARCHAR(20) NOT NULL, -- First few characters for display (e.g., "ak_live_1234...")
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of permissions like ["contacts:read", "leads:write"]
    allowed_sources TEXT[] DEFAULT NULL, -- Array of allowed IP addresses/CIDR blocks (NULL = allow all)
    rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL = never expires
    total_requests BIGINT NOT NULL DEFAULT 0,
    last_request_ip INET DEFAULT NULL,
    
    -- Constraints
    CONSTRAINT api_keys_name_org_unique UNIQUE(organization_id, name),
    CONSTRAINT api_keys_rate_limit_positive CHECK (rate_limit_per_hour > 0),
    CONSTRAINT api_keys_permissions_valid CHECK (jsonb_typeof(permissions) = 'array')
);

-- Row Level Security for API Keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/manage API keys for their own organization
CREATE POLICY api_keys_organization_isolation ON api_keys
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Policy: Super admins can see all API keys
CREATE POLICY api_keys_super_admin_access ON api_keys
    FOR ALL
    USING (current_setting('app.user_role', true) = 'super_admin');

-- =============================================================================
-- 2. API KEY USAGE LOGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS api_key_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL, -- The API endpoint that was called
    method VARCHAR(10) NOT NULL, -- HTTP method (GET, POST, PUT, DELETE)
    status_code INTEGER NOT NULL,
    request_size_bytes INTEGER DEFAULT NULL,
    response_size_bytes INTEGER DEFAULT NULL,
    response_time_ms INTEGER DEFAULT NULL,
    source_ip INET NOT NULL,
    user_agent TEXT DEFAULT NULL,
    request_id VARCHAR(100) DEFAULT NULL, -- For tracing requests
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT api_usage_logs_method_valid CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS')),
    CONSTRAINT api_usage_logs_status_valid CHECK (status_code >= 100 AND status_code < 600)
);

-- Row Level Security for API Key Usage Logs
ALTER TABLE api_key_usage_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see usage logs for their own organization
CREATE POLICY api_usage_logs_organization_isolation ON api_key_usage_logs
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Policy: Super admins can see all usage logs
CREATE POLICY api_usage_logs_super_admin_access ON api_key_usage_logs
    FOR ALL
    USING (current_setting('app.user_role', true) = 'super_admin');

-- =============================================================================
-- 3. WEBHOOK ENDPOINTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL, -- Array of events like ["contact.created", "lead.updated"]
    secret_key VARCHAR(255) NOT NULL, -- For signing webhook payloads
    is_active BOOLEAN NOT NULL DEFAULT true,
    retry_attempts INTEGER NOT NULL DEFAULT 3,
    timeout_seconds INTEGER NOT NULL DEFAULT 30,
    headers JSONB DEFAULT '{}'::jsonb, -- Custom headers to send with webhook
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    last_success_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    last_failure_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    total_deliveries BIGINT NOT NULL DEFAULT 0,
    successful_deliveries BIGINT NOT NULL DEFAULT 0,
    failed_deliveries BIGINT NOT NULL DEFAULT 0,
    
    -- Constraints
    CONSTRAINT webhook_endpoints_name_org_unique UNIQUE(organization_id, name),
    CONSTRAINT webhook_endpoints_url_valid CHECK (url ~ '^https?://'),
    CONSTRAINT webhook_endpoints_retry_positive CHECK (retry_attempts >= 0 AND retry_attempts <= 10),
    CONSTRAINT webhook_endpoints_timeout_valid CHECK (timeout_seconds > 0 AND timeout_seconds <= 300),
    CONSTRAINT webhook_endpoints_events_not_empty CHECK (array_length(events, 1) > 0),
    CONSTRAINT webhook_endpoints_headers_valid CHECK (jsonb_typeof(headers) = 'object')
);

-- Row Level Security for Webhook Endpoints
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/manage webhook endpoints for their own organization
CREATE POLICY webhook_endpoints_organization_isolation ON webhook_endpoints
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Policy: Super admins can see all webhook endpoints
CREATE POLICY webhook_endpoints_super_admin_access ON webhook_endpoints
    FOR ALL
    USING (current_setting('app.user_role', true) = 'super_admin');

-- =============================================================================
-- 4. WEBHOOK DELIVERY LOGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhook_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    delivery_attempt INTEGER NOT NULL DEFAULT 1,
    status_code INTEGER DEFAULT NULL,
    response_body TEXT DEFAULT NULL,
    response_time_ms INTEGER DEFAULT NULL,
    error_message TEXT DEFAULT NULL,
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    next_retry_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Constraints
    CONSTRAINT webhook_delivery_logs_attempt_positive CHECK (delivery_attempt > 0),
    CONSTRAINT webhook_delivery_logs_status_valid CHECK (status_code IS NULL OR (status_code >= 100 AND status_code < 600))
);

-- Row Level Security for Webhook Delivery Logs
ALTER TABLE webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see delivery logs for their own organization
CREATE POLICY webhook_delivery_logs_organization_isolation ON webhook_delivery_logs
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Policy: Super admins can see all delivery logs
CREATE POLICY webhook_delivery_logs_super_admin_access ON webhook_delivery_logs
    FOR ALL
    USING (current_setting('app.user_role', true) = 'super_admin');

-- =============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- =============================================================================

-- API Keys indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_active ON api_keys(is_active, organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_created_by ON api_keys(created_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_keys_expires_at ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- API Key Usage Logs indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_logs_api_key_id ON api_key_usage_logs(api_key_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_logs_organization_id ON api_key_usage_logs(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_logs_created_at ON api_key_usage_logs(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_logs_endpoint ON api_key_usage_logs(endpoint);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_api_usage_logs_status_code ON api_key_usage_logs(status_code);

-- Webhook Endpoints indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_endpoints_organization_id ON webhook_endpoints(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_endpoints_active ON webhook_endpoints(is_active, organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_endpoints_events ON webhook_endpoints USING GIN(events);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_endpoints_created_by ON webhook_endpoints(created_by);

-- Webhook Delivery Logs indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_delivery_logs_endpoint_id ON webhook_delivery_logs(webhook_endpoint_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_delivery_logs_organization_id ON webhook_delivery_logs(organization_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_delivery_logs_created_at ON webhook_delivery_logs(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_delivery_logs_event_type ON webhook_delivery_logs(event_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_delivery_logs_next_retry ON webhook_delivery_logs(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_delivery_logs_status ON webhook_delivery_logs(status_code);

-- =============================================================================
-- 6. FUNCTIONS AND TRIGGERS
-- =============================================================================

-- Function to update webhook endpoint statistics
CREATE OR REPLACE FUNCTION update_webhook_endpoint_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE webhook_endpoints 
        SET 
            total_deliveries = total_deliveries + 1,
            successful_deliveries = CASE 
                WHEN NEW.status_code >= 200 AND NEW.status_code < 300 
                THEN successful_deliveries + 1 
                ELSE successful_deliveries 
            END,
            failed_deliveries = CASE 
                WHEN NEW.status_code IS NULL OR NEW.status_code >= 400 
                THEN failed_deliveries + 1 
                ELSE failed_deliveries 
            END,
            last_triggered_at = NOW(),
            last_success_at = CASE 
                WHEN NEW.status_code >= 200 AND NEW.status_code < 300 
                THEN NOW() 
                ELSE last_success_at 
            END,
            last_failure_at = CASE 
                WHEN NEW.status_code IS NULL OR NEW.status_code >= 400 
                THEN NOW() 
                ELSE last_failure_at 
            END,
            updated_at = NOW()
        WHERE id = NEW.webhook_endpoint_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to update webhook endpoint stats when delivery logs are inserted/updated
CREATE TRIGGER trigger_update_webhook_endpoint_stats
    AFTER INSERT OR UPDATE ON webhook_delivery_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_endpoint_stats();

-- Function to update API key usage statistics
CREATE OR REPLACE FUNCTION update_api_key_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE api_keys 
        SET 
            total_requests = total_requests + 1,
            last_used_at = NOW(),
            last_request_ip = NEW.source_ip
        WHERE id = NEW.api_key_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update API key stats when usage logs are inserted
CREATE TRIGGER trigger_update_api_key_stats
    AFTER INSERT ON api_key_usage_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_api_key_stats();

-- Function to automatically clean up old logs (optional, for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
    -- Delete API usage logs older than 90 days
    DELETE FROM api_key_usage_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Delete webhook delivery logs older than 30 days (keep recent for debugging)
    DELETE FROM webhook_delivery_logs 
    WHERE created_at < NOW() - INTERVAL '30 days'
    AND status_code >= 200 AND status_code < 300; -- Keep failed deliveries longer for debugging
    
    -- Delete very old failed webhook deliveries (older than 90 days)
    DELETE FROM webhook_delivery_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. HELPER FUNCTIONS FOR API KEY GENERATION
-- =============================================================================

-- Function to generate API key prefix based on environment
CREATE OR REPLACE FUNCTION generate_api_key_prefix()
RETURNS TEXT AS $$
BEGIN
    -- Generate prefix like "ak_live_" for production or "ak_test_" for development
    RETURN CASE 
        WHEN current_setting('app.environment', true) = 'production' 
        THEN 'ak_live_'
        ELSE 'ak_test_'
    END || substr(encode(gen_random_bytes(8), 'base64'), 1, 8);
END;
$$ LANGUAGE plpgsql;

-- Function to validate API key permissions
CREATE OR REPLACE FUNCTION validate_api_key_permissions(permissions_json JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    valid_permissions TEXT[] := ARRAY[
        'contacts:read', 'contacts:write', 'contacts:delete',
        'leads:read', 'leads:write', 'leads:delete',
        'users:read', 'users:write',
        'organizations:read',
        'webhooks:read', 'webhooks:write',
        'analytics:read'
    ];
    permission TEXT;
BEGIN
    -- Check if permissions is an array
    IF jsonb_typeof(permissions_json) != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- Check each permission
    FOR permission IN SELECT jsonb_array_elements_text(permissions_json)
    LOOP
        IF NOT (permission = ANY(valid_permissions)) THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to validate permissions using the function
ALTER TABLE api_keys 
ADD CONSTRAINT api_keys_permissions_valid_values 
CHECK (validate_api_key_permissions(permissions));

-- =============================================================================
-- 8. SAMPLE DATA (OPTIONAL - FOR DEVELOPMENT)
-- =============================================================================

-- Insert sample webhook events configuration
INSERT INTO webhook_endpoints (
    organization_id, 
    name, 
    url, 
    events, 
    secret_key,
    headers
) 
SELECT 
    o.id,
    'Default Zapier Webhook',
    'https://hooks.zapier.com/hooks/catch/example/',
    ARRAY['contact.created', 'contact.updated', 'lead.created', 'lead.updated'],
    encode(gen_random_bytes(32), 'hex'),
    '{"User-Agent": "UppalCRM-Webhook/1.0", "Content-Type": "application/json"}'::jsonb
FROM organizations o 
WHERE o.name = 'Uppal Solutions Ltd.'
ON CONFLICT (organization_id, name) DO NOTHING;

COMMIT;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================

-- This migration creates a comprehensive API key and webhook system with:
-- 1. Multi-tenant security using Row Level Security (RLS)
-- 2. Proper indexing for performance
-- 3. Automatic statistics tracking via triggers
-- 4. Validation functions for data integrity
-- 5. Cleanup functions for maintenance
-- 6. Sample data for development

-- To apply this migration:
-- psql -d your_database -f 006_api_keys_webhooks.sql

-- To test RLS policies:
-- SET app.current_organization_id = 'your-org-uuid';
-- SET app.user_role = 'admin'; -- or 'super_admin'