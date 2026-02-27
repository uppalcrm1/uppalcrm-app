-- Migration: Add agent_call_sids column for tracking agent call mapping
-- Stores array of objects: [{"callSid": "CA...", "userId": "uuid"}, ...]
-- Used to map which agent answered and cancel other agent calls

ALTER TABLE incoming_calls
ADD COLUMN IF NOT EXISTS agent_call_sids TEXT;

-- Index for faster queries if needed
CREATE INDEX IF NOT EXISTS idx_incoming_calls_agent_sids
ON incoming_calls(call_sid)
WHERE agent_call_sids IS NOT NULL;
