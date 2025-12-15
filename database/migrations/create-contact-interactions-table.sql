-- Migration: Create contact_interactions table
-- Date: 2025-12-14
-- Description: Create table for tracking contact interactions (emails, calls, meetings, notes, support tickets)

-- Create contact_interactions table
CREATE TABLE IF NOT EXISTS contact_interactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Interaction details
  interaction_type VARCHAR(50) NOT NULL CHECK (interaction_type IN ('email', 'call', 'meeting', 'note', 'support_ticket')),
  direction VARCHAR(20) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject VARCHAR(500),
  content TEXT,
  duration_minutes INTEGER CHECK (duration_minutes >= 0),
  email_message_id VARCHAR(500),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_interactions_contact_id
  ON contact_interactions(contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_organization_id
  ON contact_interactions(organization_id);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_user_id
  ON contact_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_created_at
  ON contact_interactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_contact_interactions_type
  ON contact_interactions(interaction_type);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_contact_interactions_org_contact_created
  ON contact_interactions(organization_id, contact_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see interactions from their organization
CREATE POLICY contact_interactions_org_isolation ON contact_interactions
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::uuid);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_contact_interactions_updated_at ON contact_interactions;
CREATE TRIGGER update_contact_interactions_updated_at
  BEFORE UPDATE ON contact_interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE contact_interactions IS 'Stores all interactions with contacts including emails, calls, meetings, notes, and support tickets';
COMMENT ON COLUMN contact_interactions.interaction_type IS 'Type of interaction: email, call, meeting, note, support_ticket';
COMMENT ON COLUMN contact_interactions.direction IS 'Direction of interaction: inbound or outbound';
COMMENT ON COLUMN contact_interactions.duration_minutes IS 'Duration in minutes (for calls and meetings)';
COMMENT ON COLUMN contact_interactions.email_message_id IS 'Email message ID for tracking email threads';

-- Verification queries (run these to verify the migration)
-- SELECT COUNT(*) FROM contact_interactions;
-- SELECT * FROM pg_indexes WHERE tablename = 'contact_interactions';
-- SELECT * FROM pg_policies WHERE tablename = 'contact_interactions';
