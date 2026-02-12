-- Migration: Fix interaction_events to support contact and account tasks
-- Purpose: Allow interaction_events to track events for tasks linked to contacts/accounts without leads
-- Date: 2026-02-12
--
-- Changes:
-- 1. Make lead_id nullable in interaction_events (tasks can exist without leads)
-- 2. Update the create_interaction_event trigger to handle NULL lead_id
-- 3. Update the track_interaction_updates trigger to handle NULL lead_id

-- ============================================================================
-- STEP 1: Make lead_id nullable in interaction_events
-- ============================================================================
DO $$
BEGIN
  -- Check if lead_id has a NOT NULL constraint
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'interaction_events'
    AND column_name = 'lead_id'
    AND is_nullable = 'NO'
  ) THEN
    -- Drop the constraint by recreating without NOT NULL
    ALTER TABLE interaction_events
    ALTER COLUMN lead_id DROP NOT NULL;

    RAISE NOTICE '✅ Made lead_id nullable in interaction_events table';
  ELSE
    RAISE NOTICE 'ℹ️  lead_id column in interaction_events already nullable';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Update create_interaction_event trigger to handle NULL lead_id
-- ============================================================================
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

  -- Create the event record (lead_id can be NULL for contact/account tasks)
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
    NEW.lead_id,  -- Can be NULL for contact/account tasks
    NEW.organization_id,
    'created',
    v_event_description,
    NEW.created_by,
    jsonb_build_object(
      'interaction_type', NEW.interaction_type,
      'subject', NEW.subject,
      'priority', NEW.priority,
      'scheduled_at', NEW.scheduled_at,
      'assigned_to', NEW.user_id,
      'contact_id', NEW.contact_id,
      'account_id', NEW.account_id
    ),
    NEW.created_at
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 3: Update track_interaction_updates trigger to handle NULL lead_id
-- ============================================================================
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
      NEW.lead_id,  -- Can be NULL for contact/account tasks
      NEW.organization_id,
      v_event_type,
      v_event_description,
      current_setting('app.current_user_id', TRUE)::UUID,
      jsonb_build_object(
        'outcome', NEW.outcome,
        'completed_at', NEW.completed_at,
        'contact_id', NEW.contact_id,
        'account_id', NEW.account_id
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
      NEW.lead_id,  -- Can be NULL for contact/account tasks
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
      NEW.lead_id,  -- Can be NULL for contact/account tasks
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
      NEW.lead_id,  -- Can be NULL for contact/account tasks
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
      NEW.lead_id,  -- Can be NULL for contact/account tasks
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

-- ============================================================================
-- STEP 4: Validation
-- ============================================================================
DO $$
DECLARE
  v_lead_id_nullable BOOLEAN;
BEGIN
  -- Check if lead_id is nullable
  SELECT is_nullable = 'YES' INTO v_lead_id_nullable
  FROM information_schema.columns
  WHERE table_name = 'interaction_events' AND column_name = 'lead_id';

  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║         MIGRATION VALIDATION REPORT                            ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';

  IF v_lead_id_nullable THEN
    RAISE NOTICE '✅ lead_id column in interaction_events: NULLABLE';
    RAISE NOTICE '✅ Trigger functions updated to handle NULL lead_id';
    RAISE NOTICE '🎉 MIGRATION COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '';
    RAISE NOTICE 'Tasks can now be created without a lead and events will be tracked.';
  ELSE
    RAISE WARNING '❌ lead_id column in interaction_events: STILL NOT NULL';
  END IF;
  RAISE NOTICE '';
END $$;
