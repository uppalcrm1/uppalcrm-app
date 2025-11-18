-- Twilio Integration Migration
-- Creates tables for SMS, Voice calls, templates, and configuration

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Twilio Configuration per Organization (multi-tenant)
CREATE TABLE twilio_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Twilio Credentials (encrypted in production)
    account_sid VARCHAR(255) NOT NULL,
    auth_token VARCHAR(255) NOT NULL,
    phone_number VARCHAR(50) NOT NULL, -- Organization's Twilio number

    -- Features enabled
    sms_enabled BOOLEAN DEFAULT true,
    voice_enabled BOOLEAN DEFAULT true,

    -- Status
    is_active BOOLEAN DEFAULT true,
    verified_at TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    -- Each org can only have one Twilio config
    UNIQUE(organization_id)
);

-- SMS Messages (sent and received)
CREATE TABLE sms_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Related Records
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id), -- User who sent (null for incoming)

    -- Message Details
    direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50) NOT NULL,
    body TEXT NOT NULL,

    -- Twilio Data
    twilio_sid VARCHAR(255) UNIQUE, -- Twilio message SID
    twilio_status VARCHAR(50), -- queued, sent, delivered, failed, etc.
    error_code INTEGER,
    error_message TEXT,

    -- Media attachments
    media_urls JSONB, -- Array of media URLs
    num_media INTEGER DEFAULT 0,

    -- Analytics
    segment_count INTEGER DEFAULT 1, -- Number of SMS segments
    cost DECIMAL(10,4), -- Cost in USD

    -- Auto-response flags
    is_auto_reply BOOLEAN DEFAULT false,
    template_id UUID,

    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Phone Calls
CREATE TABLE phone_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Related Records
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id), -- User who made/received call

    -- Call Details
    direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
    from_number VARCHAR(50) NOT NULL,
    to_number VARCHAR(50) NOT NULL,

    -- Twilio Data
    twilio_call_sid VARCHAR(255) UNIQUE,
    twilio_status VARCHAR(50), -- queued, ringing, in-progress, completed, failed, etc.

    -- Call Metrics
    duration_seconds INTEGER, -- Total call duration
    talk_time_seconds INTEGER, -- Actual talk time (excluding ringing)
    recording_url TEXT, -- Call recording URL
    has_recording BOOLEAN DEFAULT false,

    -- Call outcome
    outcome VARCHAR(100), -- answered, no_answer, busy, voicemail, failed
    notes TEXT, -- User's notes about the call

    -- Cost tracking
    cost DECIMAL(10,4),

    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE,
    answered_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SMS Templates (pre-written messages)
CREATE TABLE sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Template Details
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50), -- welcome, follow_up, renewal, trial_expiring, etc.
    body TEXT NOT NULL, -- Template with {{variables}}

    -- Usage tracking
    use_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES users(id),

    UNIQUE(organization_id, name)
);

-- Auto-Response Rules
CREATE TABLE sms_auto_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Trigger conditions
    keyword VARCHAR(100), -- If message contains this keyword
    trigger_type VARCHAR(50), -- 'keyword', 'business_hours', 'new_lead'

    -- Response
    template_id UUID REFERENCES sms_templates(id),
    response_message TEXT,

    -- Business hours (for after-hours auto-response)
    business_hours_start TIME,
    business_hours_end TIME,
    business_days INTEGER[], -- Array: [1,2,3,4,5] for Mon-Fri

    -- Status
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for template_id in sms_messages after sms_templates is created
ALTER TABLE sms_messages ADD CONSTRAINT fk_sms_messages_template
    FOREIGN KEY (template_id) REFERENCES sms_templates(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_sms_messages_org ON sms_messages(organization_id);
CREATE INDEX idx_sms_messages_lead ON sms_messages(lead_id);
CREATE INDEX idx_sms_messages_contact ON sms_messages(contact_id);
CREATE INDEX idx_sms_messages_created ON sms_messages(created_at DESC);
CREATE INDEX idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX idx_sms_messages_twilio_sid ON sms_messages(twilio_sid);

CREATE INDEX idx_phone_calls_org ON phone_calls(organization_id);
CREATE INDEX idx_phone_calls_lead ON phone_calls(lead_id);
CREATE INDEX idx_phone_calls_contact ON phone_calls(contact_id);
CREATE INDEX idx_phone_calls_created ON phone_calls(created_at DESC);
CREATE INDEX idx_phone_calls_twilio_sid ON phone_calls(twilio_call_sid);

CREATE INDEX idx_sms_templates_org ON sms_templates(organization_id);
CREATE INDEX idx_sms_templates_category ON sms_templates(category);

-- Row Level Security
ALTER TABLE twilio_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_auto_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY twilio_config_isolation ON twilio_config
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY sms_messages_isolation ON sms_messages
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY phone_calls_isolation ON phone_calls
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY sms_templates_isolation ON sms_templates
    USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY sms_auto_responses_isolation ON sms_auto_responses
    USING (organization_id = current_setting('app.current_organization_id')::UUID);
