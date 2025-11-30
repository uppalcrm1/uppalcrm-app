-- Migration: Create interaction_events table for tracking task/interaction lifecycle events
-- Purpose: Enable separate timeline entries for task created, updated, and completed actions

-- Create interaction_events table
CREATE TABLE IF NOT EXISTS interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES lead_interactions(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- 'created', 'assigned', 'reassigned', 'priority_changed', 'date_changed', 'completed', 'updated', 'cancelled'
  event_description TEXT, -- Human-readable description of the event

  -- Change tracking (for update events)
  field_changed VARCHAR(100), -- e.g., 'assignee', 'priority', 'scheduled_at', 'subject'
  old_value TEXT,
  new_value TEXT,

  -- User who triggered the event
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Additional metadata (outcome, notes, etc.)
  event_metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_interaction_events_interaction ON interaction_events(interaction_id);
CREATE INDEX idx_interaction_events_lead ON interaction_events(lead_id);
CREATE INDEX idx_interaction_events_organization ON interaction_events(organization_id);
CREATE INDEX idx_interaction_events_type ON interaction_events(event_type);
CREATE INDEX idx_interaction_events_created_at ON interaction_events(created_at DESC);
CREATE INDEX idx_interaction_events_lead_date ON interaction_events(lead_id, created_at DESC);

-- Add composite index for common queries
CREATE INDEX idx_interaction_events_org_lead_date ON interaction_events(organization_id, lead_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE interaction_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see events for their organization
CREATE POLICY interaction_events_org_isolation ON interaction_events
  FOR ALL
  USING (organization_id = current_setting('app.current_organization_id', TRUE)::UUID);

-- Grant permissions (only if authenticated role exists, e.g., in Supabase)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT ALL ON interaction_events TO authenticated;
  END IF;
END
$$;

-- Function to automatically create 'created' event when new interaction is inserted
CREATE OR REPLACE FUNCTION create_interaction_event()
RETURNS TRIGGER AS $$
DECLARE
  v_assigned_user_name TEXT;
  v_event_description TEXT;
BEGIN
  -- Get assigned user name if applicable
  IF NEW.user_id IS NOT NULL THEN
    SELECT CONCAT(first_name, ' ', last_name) INTO v_assigned_user_name
    FROM users WHERE id = NEW.user_id;
  END IF;

  -- Build event description
  IF NEW.interaction_type = 'task' THEN
    v_event_description := 'Task created';
    IF NEW.user_id IS NOT NULL AND v_assigned_user_name IS NOT NULL THEN
      v_event_description := v_event_description || ' and assigned to ' || v_assigned_user_name;
    END IF;
  ELSIF NEW.interaction_type = 'call' THEN
    v_event_description := 'Call logged';
  ELSIF NEW.interaction_type = 'email' THEN
    v_event_description := 'Email logged';
  ELSIF NEW.interaction_type = 'meeting' THEN
    v_event_description := 'Meeting logged';
  ELSIF NEW.interaction_type = 'note' THEN
    v_event_description := 'Note added';
  ELSE
    v_event_description := NEW.interaction_type || ' created';
  END IF;

  -- Create the event record
  INSERT INTO interaction_events (
    interaction_id,
    lead_id,
    organization_id,
    event_type,
    event_description,
    changed_by,
    event_metadata,
    created_at
  ) VALUES (
    NEW.id,
    NEW.lead_id,
    NEW.organization_id,
    'created',
    v_event_description,
    NEW.created_by,
    jsonb_build_object(
      'interaction_type', NEW.interaction_type,
      'subject', NEW.subject,
      'priority', NEW.priority,
      'scheduled_at', NEW.scheduled_at,
      'assigned_to', NEW.user_id
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to track interaction updates
CREATE OR REPLACE FUNCTION track_interaction_updates()
RETURNS TRIGGER AS $$
DECLARE
  v_old_user_name TEXT;
  v_new_user_name TEXT;
  v_event_description TEXT;
  v_event_type TEXT;
  v_field_changed TEXT;
BEGIN
  -- Handle completion
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    v_event_type := 'completed';

    IF NEW.interaction_type = 'task' THEN
      v_event_description := 'Task completed';
    ELSE
      v_event_description := NEW.interaction_type || ' completed';
    END IF;

    INSERT INTO interaction_events (
      interaction_id,
      lead_id,
      organization_id,
      event_type,
      event_description,
      changed_by,
      event_metadata,
      created_at
    ) VALUES (
      NEW.id,
      NEW.lead_id,
      NEW.organization_id,
      v_event_type,
      v_event_description,
      current_setting('app.current_user_id', TRUE)::UUID,
      jsonb_build_object(
        'outcome', NEW.outcome,
        'completed_at', NEW.completed_at
      ),
      NEW.completed_at
    );
  END IF;

  -- Handle reassignment
  IF OLD.user_id IS DISTINCT FROM NEW.user_id AND NEW.user_id IS NOT NULL THEN
    -- Get old and new user names
    IF OLD.user_id IS NOT NULL THEN
      SELECT CONCAT(first_name, ' ', last_name) INTO v_old_user_name
      FROM users WHERE id = OLD.user_id;
    END IF;

    SELECT CONCAT(first_name, ' ', last_name) INTO v_new_user_name
    FROM users WHERE id = NEW.user_id;

    v_event_type := 'reassigned';
    v_event_description := 'Task reassigned to ' || v_new_user_name;

    INSERT INTO interaction_events (
      interaction_id,
      lead_id,
      organization_id,
      event_type,
      event_description,
      field_changed,
      old_value,
      new_value,
      changed_by,
      created_at
    ) VALUES (
      NEW.id,
      NEW.lead_id,
      NEW.organization_id,
      v_event_type,
      v_event_description,
      'assignee',
      v_old_user_name,
      v_new_user_name,
      current_setting('app.current_user_id', TRUE)::UUID,
      NOW()
    );
  END IF;

  -- Handle priority change
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    v_event_type := 'priority_changed';
    v_event_description := 'Priority changed from ' || COALESCE(OLD.priority, 'none') || ' to ' || NEW.priority;

    INSERT INTO interaction_events (
      interaction_id,
      lead_id,
      organization_id,
      event_type,
      event_description,
      field_changed,
      old_value,
      new_value,
      changed_by,
      created_at
    ) VALUES (
      NEW.id,
      NEW.lead_id,
      NEW.organization_id,
      v_event_type,
      v_event_description,
      'priority',
      OLD.priority,
      NEW.priority,
      current_setting('app.current_user_id', TRUE)::UUID,
      NOW()
    );
  END IF;

  -- Handle scheduled date change
  IF OLD.scheduled_at IS DISTINCT FROM NEW.scheduled_at THEN
    v_event_type := 'date_changed';
    v_event_description := 'Due date changed';

    INSERT INTO interaction_events (
      interaction_id,
      lead_id,
      organization_id,
      event_type,
      event_description,
      field_changed,
      old_value,
      new_value,
      changed_by,
      created_at
    ) VALUES (
      NEW.id,
      NEW.lead_id,
      NEW.organization_id,
      v_event_type,
      v_event_description,
      'scheduled_at',
      OLD.scheduled_at::TEXT,
      NEW.scheduled_at::TEXT,
      current_setting('app.current_user_id', TRUE)::UUID,
      NOW()
    );
  END IF;

  -- Handle status change to cancelled
  IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' THEN
    v_event_type := 'cancelled';
    v_event_description := NEW.interaction_type || ' cancelled';

    INSERT INTO interaction_events (
      interaction_id,
      lead_id,
      organization_id,
      event_type,
      event_description,
      changed_by,
      created_at
    ) VALUES (
      NEW.id,
      NEW.lead_id,
      NEW.organization_id,
      v_event_type,
      v_event_description,
      current_setting('app.current_user_id', TRUE)::UUID,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new interactions
CREATE TRIGGER trigger_create_interaction_event
  AFTER INSERT ON lead_interactions
  FOR EACH ROW
  EXECUTE FUNCTION create_interaction_event();

-- Create trigger for interaction updates
CREATE TRIGGER trigger_track_interaction_updates
  AFTER UPDATE ON lead_interactions
  FOR EACH ROW
  EXECUTE FUNCTION track_interaction_updates();

-- Backfill existing interactions with creation events
-- This creates historical 'created' and 'completed' events for existing tasks
-- Only backfill for interactions that have organization_id set
INSERT INTO interaction_events (
  interaction_id,
  lead_id,
  organization_id,
  event_type,
  event_description,
  changed_by,
  event_metadata,
  created_at
)
SELECT
  li.id,
  li.lead_id,
  li.organization_id,
  'created',
  CASE
    WHEN li.interaction_type = 'task' THEN 'Task created'
    WHEN li.interaction_type = 'call' THEN 'Call logged'
    WHEN li.interaction_type = 'email' THEN 'Email logged'
    WHEN li.interaction_type = 'meeting' THEN 'Meeting logged'
    WHEN li.interaction_type = 'note' THEN 'Note added'
    ELSE li.interaction_type || ' created'
  END,
  li.created_by,
  jsonb_build_object(
    'interaction_type', li.interaction_type,
    'subject', li.subject,
    'priority', li.priority,
    'scheduled_at', li.scheduled_at,
    'assigned_to', li.user_id
  ),
  li.created_at
FROM lead_interactions li
WHERE li.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM interaction_events ie
    WHERE ie.interaction_id = li.id AND ie.event_type = 'created'
  );

-- Backfill completion events for completed interactions
-- Only backfill for interactions that have organization_id set
INSERT INTO interaction_events (
  interaction_id,
  lead_id,
  organization_id,
  event_type,
  event_description,
  changed_by,
  event_metadata,
  created_at
)
SELECT
  li.id,
  li.lead_id,
  li.organization_id,
  'completed',
  CASE
    WHEN li.interaction_type = 'task' THEN 'Task completed'
    ELSE li.interaction_type || ' completed'
  END,
  li.created_by, -- We don't have completion user, so using creator
  jsonb_build_object(
    'outcome', li.outcome,
    'completed_at', li.completed_at
  ),
  li.completed_at
FROM lead_interactions li
WHERE li.organization_id IS NOT NULL
  AND li.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM interaction_events ie
    WHERE ie.interaction_id = li.id AND ie.event_type = 'completed'
  );

-- Add comment
COMMENT ON TABLE interaction_events IS 'Tracks lifecycle events for interactions (tasks, calls, emails, etc.) to enable detailed activity timeline';
COMMENT ON COLUMN interaction_events.event_type IS 'Type of event: created, assigned, reassigned, priority_changed, date_changed, completed, updated, cancelled';
COMMENT ON COLUMN interaction_events.event_metadata IS 'Additional JSON data specific to the event type (outcome, notes, etc.)';
