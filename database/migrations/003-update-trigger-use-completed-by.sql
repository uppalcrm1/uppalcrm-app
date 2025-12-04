-- Migration: Update track_interaction_updates trigger to use last_modified_by column
-- Purpose: Replace current_setting('app.current_user_id') with NEW.last_modified_by
-- Date: 2025-01-XX

-- Update the track_interaction_updates function
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
      NEW.last_modified_by,  -- ← CHANGED: Use NEW.last_modified_by instead of current_setting()
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
      NEW.last_modified_by,  -- ← CHANGED: Use NEW.last_modified_by for consistency
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
      NEW.last_modified_by,  -- ← CHANGED: Use NEW.last_modified_by for consistency
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
      NEW.last_modified_by,  -- ← CHANGED: Use NEW.last_modified_by for consistency
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
      NEW.last_modified_by,  -- ← CHANGED: Use NEW.last_modified_by for consistency
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Verification
DO $$
BEGIN
  RAISE NOTICE '✅ Trigger function track_interaction_updates() updated successfully';
  RAISE NOTICE '   Now uses NEW.last_modified_by instead of current_setting()';
END $$;
