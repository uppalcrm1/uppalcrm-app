-- Enhance lead_interactions table for comprehensive activity tracking
-- This migration adds missing columns needed by the lead interactions system

-- Add missing columns to lead_interactions
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS organization_id UUID;
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS participants JSONB;
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS activity_metadata JSONB;
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS duration INTEGER; -- in minutes (rename from duration_minutes)
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE lead_interactions ADD COLUMN IF NOT EXISTS created_by UUID;

-- Add foreign key constraint for organization_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'lead_interactions_organization_id_fkey'
    ) THEN
        ALTER TABLE lead_interactions
        ADD CONSTRAINT lead_interactions_organization_id_fkey
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for created_by if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'lead_interactions_created_by_fkey'
    ) THEN
        ALTER TABLE lead_interactions
        ADD CONSTRAINT lead_interactions_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;

-- Populate organization_id from the lead's organization
UPDATE lead_interactions li
SET organization_id = l.organization_id
FROM leads l
WHERE li.lead_id = l.id
AND li.organization_id IS NULL;

-- Populate created_by from user_id if not set
UPDATE lead_interactions
SET created_by = user_id
WHERE created_by IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_lead_interactions_organization ON lead_interactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_lead_date ON lead_interactions(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_type ON lead_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_lead_interactions_created_by ON lead_interactions(created_by);

-- Update existing rows to have default priority if NULL
UPDATE lead_interactions
SET priority = 'medium'
WHERE priority IS NULL;

-- Copy duration_minutes to duration if duration is null
UPDATE lead_interactions
SET duration = duration_minutes
WHERE duration IS NULL AND duration_minutes IS NOT NULL;

COMMENT ON COLUMN lead_interactions.organization_id IS 'Organization this interaction belongs to';
COMMENT ON COLUMN lead_interactions.participants IS 'JSON array of participant names/emails for meetings';
COMMENT ON COLUMN lead_interactions.activity_metadata IS 'Flexible JSON metadata storage for activity-specific data';
COMMENT ON COLUMN lead_interactions.duration IS 'Duration of call/meeting in minutes';
COMMENT ON COLUMN lead_interactions.priority IS 'Priority level: low, medium, high';
COMMENT ON COLUMN lead_interactions.created_by IS 'User who created this interaction';
