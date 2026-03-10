-- Migration 048: Add per-user conversation read/unread tracking
-- Creates conversation_read_status table for timestamp-based read tracking
-- Also adds call_status column to phone_calls table for missed call tracking

-- Enable uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create conversation_read_status table
CREATE TABLE IF NOT EXISTS conversation_read_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_phone VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL DEFAULT 'all',
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id, conversation_phone, channel)
);

-- Index for fast lookups: "get all read statuses for this user in this org for this channel"
CREATE INDEX IF NOT EXISTS idx_conversation_read_status_lookup
  ON conversation_read_status(organization_id, user_id, channel);

-- Index for fast lookups by phone number
CREATE INDEX IF NOT EXISTS idx_conversation_read_status_phone
  ON conversation_read_status(organization_id, user_id, conversation_phone);

-- Add call_status column to phone_calls table for missed/voicemail tracking
ALTER TABLE phone_calls ADD COLUMN IF NOT EXISTS call_status VARCHAR(50) DEFAULT 'completed';
-- Values: completed, missed, voicemail, no-answer

-- Add voicemail_url column to phone_calls table
ALTER TABLE phone_calls ADD COLUMN IF NOT EXISTS voicemail_url TEXT;
