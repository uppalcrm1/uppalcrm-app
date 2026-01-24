-- Add missing contact fields: priority, assigned_to, next_follow_up
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS priority VARCHAR(50),
ADD COLUMN IF NOT EXISTS assigned_to UUID,
ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMP WITH TIME ZONE;

-- Create index for assigned_to foreign key
CREATE INDEX IF NOT EXISTS idx_contacts_assigned_to ON contacts(assigned_to);
