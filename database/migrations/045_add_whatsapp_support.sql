-- Migration: 045 - Add WhatsApp support to SMS and Twilio configuration
--
-- Adds channel column to sms_messages to support both SMS and WhatsApp messages
-- Adds whatsapp_enabled and whatsapp_number to twilio_config for WhatsApp configuration

-- Add channel column to sms_messages table (idempotent)
-- Allows the same table to store both SMS and WhatsApp messages
ALTER TABLE sms_messages
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'sms' NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_messages_channel ON sms_messages(channel);

-- Add whatsapp_enabled flag to twilio_config table (idempotent)
-- Feature flag to enable/disable WhatsApp per organization
ALTER TABLE twilio_config
  ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false;

-- Add whatsapp_number to twilio_config table (idempotent)
-- Stores the organization's WhatsApp-enabled Twilio number (sandbox or production)
ALTER TABLE twilio_config
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(50);
