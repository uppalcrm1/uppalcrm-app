-- Migration: Create incoming_calls table for persistent call tracking
-- Replaces global.incomingCalls in-memory cache with database storage
-- Tracks incoming calls with status, timestamps, and participant info
-- Adds indexes for fast lookups by organization and call status

CREATE TABLE IF NOT EXISTS incoming_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  call_sid VARCHAR(34) NOT NULL UNIQUE,
  from_number VARCHAR(20) NOT NULL,
  to_number VARCHAR(20),
  status VARCHAR(20) DEFAULT 'ringing' NOT NULL,
  accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  conference_id VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_incoming_calls_org_status
ON incoming_calls(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_incoming_calls_call_sid
ON incoming_calls(call_sid);

-- Create trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_incoming_calls_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS incoming_calls_update_timestamp ON incoming_calls;
CREATE TRIGGER incoming_calls_update_timestamp
BEFORE UPDATE ON incoming_calls
FOR EACH ROW
EXECUTE FUNCTION update_incoming_calls_timestamp();
