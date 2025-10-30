-- Migration: Organization AI Settings for Multi-tenant Sentiment Analysis
-- Date: 2025-01-15
-- Description: Creates table for organization-specific AI configuration including
--              sentiment analysis thresholds, alerting preferences, and custom weights

BEGIN;

-- =============================================================================
-- 1. ORGANIZATION AI SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Feature Toggles
    sentiment_enabled BOOLEAN NOT NULL DEFAULT true,
    churn_detection_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_analyze_emails BOOLEAN NOT NULL DEFAULT false,
    auto_analyze_tickets BOOLEAN NOT NULL DEFAULT false,

    -- Churn Risk Thresholds (as percentages: 0-100)
    -- These map sentiment scores to risk levels
    churn_threshold_critical INTEGER NOT NULL DEFAULT 30,  -- Below 30% sentiment = critical
    churn_threshold_high INTEGER NOT NULL DEFAULT 50,      -- 30-49% sentiment = high risk
    churn_threshold_medium INTEGER NOT NULL DEFAULT 70,    -- 50-69% sentiment = medium risk
    -- Above 70% sentiment = low risk (no threshold needed)

    -- Alert Configuration
    alert_on_critical BOOLEAN NOT NULL DEFAULT true,
    alert_on_high BOOLEAN NOT NULL DEFAULT false,
    alert_on_medium BOOLEAN NOT NULL DEFAULT false,

    -- Notification Recipients
    alert_emails TEXT[] DEFAULT ARRAY[]::TEXT[],  -- Array of email addresses
    alert_slack_webhook TEXT DEFAULT NULL,         -- Slack webhook URL
    alert_teams_webhook TEXT DEFAULT NULL,         -- Microsoft Teams webhook URL
    alert_custom_webhook TEXT DEFAULT NULL,        -- Custom webhook URL

    -- Advanced Settings
    custom_sentiment_weights JSONB DEFAULT NULL,   -- For future custom AI model weights
    min_confidence_threshold DECIMAL(3,2) DEFAULT 0.60,  -- Minimum confidence (0.0-1.0)
    analysis_language VARCHAR(10) DEFAULT 'en',    -- ISO language code

    -- Usage Tracking
    total_analyses INTEGER DEFAULT 0,
    analyses_this_month INTEGER DEFAULT 0,
    last_analysis_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,

    -- Constraints
    CONSTRAINT organization_ai_settings_org_unique UNIQUE(organization_id),
    CONSTRAINT threshold_critical_valid CHECK (churn_threshold_critical >= 0 AND churn_threshold_critical <= 100),
    CONSTRAINT threshold_high_valid CHECK (churn_threshold_high >= 0 AND churn_threshold_high <= 100),
    CONSTRAINT threshold_medium_valid CHECK (churn_threshold_medium >= 0 AND churn_threshold_medium <= 100),
    CONSTRAINT thresholds_ordered CHECK (
        churn_threshold_critical < churn_threshold_high AND
        churn_threshold_high < churn_threshold_medium
    ),
    CONSTRAINT min_confidence_valid CHECK (min_confidence_threshold >= 0.0 AND min_confidence_threshold <= 1.0),
    CONSTRAINT alert_emails_valid CHECK (
        array_length(alert_emails, 1) IS NULL OR
        array_length(alert_emails, 1) <= 10
    ),
    CONSTRAINT custom_weights_valid CHECK (
        custom_sentiment_weights IS NULL OR
        jsonb_typeof(custom_sentiment_weights) = 'object'
    )
);

-- Row Level Security for Organization AI Settings
ALTER TABLE organization_ai_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see/manage AI settings for their own organization
CREATE POLICY organization_ai_settings_isolation ON organization_ai_settings
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Policy: Super admins can see all AI settings
CREATE POLICY organization_ai_settings_super_admin_access ON organization_ai_settings
    FOR ALL
    USING (current_setting('app.user_role', true) = 'super_admin');

-- =============================================================================
-- 2. SENTIMENT ANALYSIS HISTORY TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS sentiment_analysis_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Related Entity
    entity_type VARCHAR(50) NOT NULL, -- 'contact', 'lead', 'ticket', 'email'
    entity_id UUID NOT NULL,

    -- Analysis Results
    sentiment_score DECIMAL(4,3) NOT NULL, -- 0.000 to 1.000
    sentiment_label VARCHAR(20) NOT NULL,  -- 'positive', 'negative', 'neutral', 'mixed'
    confidence_scores JSONB NOT NULL,      -- { positive: 0.9, neutral: 0.05, negative: 0.05 }

    -- Churn Risk Assessment
    churn_risk_level VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    churn_risk_score DECIMAL(4,3) NOT NULL,

    -- Source Information
    source_type VARCHAR(50) NOT NULL,      -- 'email', 'support_ticket', 'chat', 'feedback_form'
    source_text TEXT NOT NULL,             -- The analyzed text (first 1000 chars)
    source_full_text TEXT DEFAULT NULL,    -- Full text if needed for review

    -- Alert Generated
    alert_generated BOOLEAN DEFAULT false,
    alert_sent_to TEXT[] DEFAULT NULL,

    -- Azure API Details
    azure_request_id VARCHAR(255) DEFAULT NULL,
    azure_model_version VARCHAR(50) DEFAULT NULL,
    processing_time_ms INTEGER DEFAULT NULL,

    -- Metadata
    analyzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    analyzed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL if automatic

    -- Constraints
    CONSTRAINT sentiment_score_valid CHECK (sentiment_score >= 0.0 AND sentiment_score <= 1.0),
    CONSTRAINT churn_risk_score_valid CHECK (churn_risk_score >= 0.0 AND churn_risk_score <= 1.0),
    CONSTRAINT entity_type_valid CHECK (entity_type IN ('contact', 'lead', 'ticket', 'email', 'other')),
    CONSTRAINT source_type_valid CHECK (source_type IN ('email', 'support_ticket', 'chat', 'feedback_form', 'manual', 'other')),
    CONSTRAINT sentiment_label_valid CHECK (sentiment_label IN ('positive', 'negative', 'neutral', 'mixed')),
    CONSTRAINT churn_risk_level_valid CHECK (churn_risk_level IN ('low', 'medium', 'high', 'critical'))
);

-- Row Level Security for Sentiment Analysis History
ALTER TABLE sentiment_analysis_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see analysis history for their own organization
CREATE POLICY sentiment_history_organization_isolation ON sentiment_analysis_history
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Policy: Super admins can see all analysis history
CREATE POLICY sentiment_history_super_admin_access ON sentiment_analysis_history
    FOR ALL
    USING (current_setting('app.user_role', true) = 'super_admin');

-- =============================================================================
-- 3. CHURN ALERTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS churn_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sentiment_analysis_id UUID NOT NULL REFERENCES sentiment_analysis_history(id) ON DELETE CASCADE,

    -- Related Entity
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,

    -- Alert Details
    alert_type VARCHAR(50) DEFAULT 'churn_risk',
    priority VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    sentiment_score DECIMAL(4,3) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,

    -- Message
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    recommended_action TEXT DEFAULT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'acknowledged', 'resolved', 'dismissed'
    resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    resolution_notes TEXT DEFAULT NULL,

    -- Notifications
    notifications_sent INTEGER DEFAULT 0,
    last_notification_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    notification_channels TEXT[] DEFAULT ARRAY[]::TEXT[], -- ['email', 'slack', 'teams']

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT churn_alerts_priority_valid CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT churn_alerts_status_valid CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
    CONSTRAINT churn_alerts_sentiment_valid CHECK (sentiment_score >= 0.0 AND sentiment_score <= 1.0),
    CONSTRAINT churn_alerts_risk_valid CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);

-- Row Level Security for Churn Alerts
ALTER TABLE churn_alerts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see alerts for their own organization
CREATE POLICY churn_alerts_organization_isolation ON churn_alerts
    FOR ALL
    USING (organization_id = current_setting('app.current_organization_id')::uuid);

-- Policy: Super admins can see all alerts
CREATE POLICY churn_alerts_super_admin_access ON churn_alerts
    FOR ALL
    USING (current_setting('app.user_role', true) = 'super_admin');

-- =============================================================================
-- 4. INDEXES FOR PERFORMANCE
-- =============================================================================

-- Organization AI Settings indexes
CREATE INDEX IF NOT EXISTS idx_org_ai_settings_organization_id ON organization_ai_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_ai_settings_sentiment_enabled ON organization_ai_settings(sentiment_enabled) WHERE sentiment_enabled = true;

-- Sentiment Analysis History indexes
CREATE INDEX IF NOT EXISTS idx_sentiment_history_organization_id ON sentiment_analysis_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_entity ON sentiment_analysis_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_analyzed_at ON sentiment_analysis_history(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_risk_level ON sentiment_analysis_history(churn_risk_level);
CREATE INDEX IF NOT EXISTS idx_sentiment_history_alert_generated ON sentiment_analysis_history(alert_generated) WHERE alert_generated = true;
CREATE INDEX IF NOT EXISTS idx_sentiment_history_sentiment_score ON sentiment_analysis_history(sentiment_score);

-- Churn Alerts indexes
CREATE INDEX IF NOT EXISTS idx_churn_alerts_organization_id ON churn_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_churn_alerts_entity ON churn_alerts(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_churn_alerts_status ON churn_alerts(status);
CREATE INDEX IF NOT EXISTS idx_churn_alerts_priority ON churn_alerts(priority);
CREATE INDEX IF NOT EXISTS idx_churn_alerts_resolved ON churn_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_churn_alerts_created_at ON churn_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_churn_alerts_unresolved ON churn_alerts(organization_id, status) WHERE resolved = false;

-- =============================================================================
-- 5. TRIGGERS
-- =============================================================================

-- Trigger to update updated_at on organization_ai_settings
CREATE TRIGGER trigger_org_ai_settings_updated_at
    BEFORE UPDATE ON organization_ai_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update updated_at on churn_alerts
CREATE TRIGGER trigger_churn_alerts_updated_at
    BEFORE UPDATE ON churn_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to increment analysis counter
CREATE OR REPLACE FUNCTION increment_analysis_counter()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE organization_ai_settings
    SET
        total_analyses = total_analyses + 1,
        analyses_this_month = analyses_this_month + 1,
        last_analysis_at = NOW()
    WHERE organization_id = NEW.organization_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment counter when analysis is created
CREATE TRIGGER trigger_increment_analysis_counter
    AFTER INSERT ON sentiment_analysis_history
    FOR EACH ROW
    EXECUTE FUNCTION increment_analysis_counter();

-- Function to create alert from high-risk analysis
CREATE OR REPLACE FUNCTION auto_create_churn_alert()
RETURNS TRIGGER AS $$
DECLARE
    settings RECORD;
    should_alert BOOLEAN := false;
    alert_priority VARCHAR(20);
BEGIN
    -- Get organization's AI settings
    SELECT * INTO settings
    FROM organization_ai_settings
    WHERE organization_id = NEW.organization_id;

    -- Determine if alert should be created based on risk level and settings
    IF NEW.churn_risk_level = 'critical' AND settings.alert_on_critical THEN
        should_alert := true;
        alert_priority := 'critical';
    ELSIF NEW.churn_risk_level = 'high' AND settings.alert_on_high THEN
        should_alert := true;
        alert_priority := 'high';
    ELSIF NEW.churn_risk_level = 'medium' AND settings.alert_on_medium THEN
        should_alert := true;
        alert_priority := 'medium';
    END IF;

    -- Create alert if needed
    IF should_alert THEN
        INSERT INTO churn_alerts (
            organization_id,
            sentiment_analysis_id,
            entity_type,
            entity_id,
            alert_type,
            priority,
            sentiment_score,
            risk_level,
            title,
            message,
            recommended_action
        ) VALUES (
            NEW.organization_id,
            NEW.id,
            NEW.entity_type,
            NEW.entity_id,
            'churn_risk',
            alert_priority,
            NEW.sentiment_score,
            NEW.churn_risk_level,
            'Customer Churn Risk Detected',
            format('A %s has been detected with %s sentiment (%s%%). Immediate attention may be required.',
                NEW.entity_type,
                NEW.sentiment_label,
                ROUND(NEW.sentiment_score * 100)
            ),
            CASE
                WHEN NEW.churn_risk_level = 'critical' THEN 'Contact customer immediately to address concerns'
                WHEN NEW.churn_risk_level = 'high' THEN 'Reach out to customer within 24 hours'
                ELSE 'Monitor customer sentiment and engagement'
            END
        );

        -- Update analysis to mark alert as generated
        UPDATE sentiment_analysis_history
        SET alert_generated = true
        WHERE id = NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create alerts for high-risk customers
CREATE TRIGGER trigger_auto_create_churn_alert
    AFTER INSERT ON sentiment_analysis_history
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_churn_alert();

-- =============================================================================
-- 6. HELPER FUNCTIONS
-- =============================================================================

-- Function to get or create default AI settings for an organization
CREATE OR REPLACE FUNCTION get_organization_ai_settings(org_id UUID)
RETURNS organization_ai_settings AS $$
DECLARE
    settings organization_ai_settings;
BEGIN
    -- Try to get existing settings
    SELECT * INTO settings
    FROM organization_ai_settings
    WHERE organization_id = org_id;

    -- If not found, create default settings
    IF NOT FOUND THEN
        INSERT INTO organization_ai_settings (organization_id)
        VALUES (org_id)
        RETURNING * INTO settings;
    END IF;

    RETURN settings;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly analysis counter (run via cron)
CREATE OR REPLACE FUNCTION reset_monthly_analysis_counters()
RETURNS void AS $$
BEGIN
    UPDATE organization_ai_settings
    SET analyses_this_month = 0;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 7. INITIALIZE DEFAULT SETTINGS FOR EXISTING ORGANIZATIONS
-- =============================================================================

-- Create default AI settings for all existing organizations
INSERT INTO organization_ai_settings (organization_id, created_at)
SELECT
    id,
    NOW()
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;

COMMIT;

-- =============================================================================
-- MIGRATION NOTES
-- =============================================================================

-- This migration creates a comprehensive multi-tenant AI configuration system with:
-- 1. Organization-specific AI settings (thresholds, alerts, notifications)
-- 2. Complete sentiment analysis history tracking
-- 3. Automated churn alert generation based on risk levels
-- 4. Multi-tenant security using Row Level Security (RLS)
-- 5. Proper indexing for performance
-- 6. Automatic counters and statistics
-- 7. Default settings for all existing organizations
--
-- To apply this migration:
-- psql $DATABASE_URL -f database/migrations/007_organization_ai_settings.sql
--
-- To test:
-- SELECT * FROM get_organization_ai_settings('your-org-uuid');
