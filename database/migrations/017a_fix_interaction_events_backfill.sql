-- Migration 017a: Fix missing organization_id and backfill interaction events
-- Purpose: Fix interactions that don't have organization_id set and backfill their events
-- This fixes the issue where activities don't show up in the timeline

-- Step 1: Update all interactions to set organization_id from their lead
-- This is safe to run multiple times
UPDATE lead_interactions li
SET organization_id = l.organization_id
FROM leads l
WHERE li.lead_id = l.id
  AND li.organization_id IS NULL;

-- Step 2: Backfill 'created' events for interactions that don't have them
-- This is safe to run multiple times (uses NOT EXISTS)
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
    WHEN li.interaction_type = 'sms' THEN 'SMS sent'
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

-- Step 3: Backfill 'completed' events for completed interactions
-- This is safe to run multiple times (uses NOT EXISTS)
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
    WHEN li.interaction_type = 'sms' THEN 'SMS delivered'
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

-- Verification query (this will be output in the migration logs)
DO $$
DECLARE
  v_interactions_count INTEGER;
  v_events_count INTEGER;
  v_interactions_without_events INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_interactions_count FROM lead_interactions;
  SELECT COUNT(DISTINCT interaction_id) INTO v_events_count FROM interaction_events;
  SELECT COUNT(*) INTO v_interactions_without_events
  FROM lead_interactions li
  WHERE NOT EXISTS (
    SELECT 1 FROM interaction_events ie WHERE ie.interaction_id = li.id
  );

  RAISE NOTICE '=== Migration 017a Complete ===';
  RAISE NOTICE 'Total interactions: %', v_interactions_count;
  RAISE NOTICE 'Interactions with events: %', v_events_count;
  RAISE NOTICE 'Interactions without events: %', v_interactions_without_events;

  IF v_interactions_without_events = 0 THEN
    RAISE NOTICE '✅ All interactions have events!';
  ELSE
    RAISE WARNING '⚠️  % interactions still missing events', v_interactions_without_events;
  END IF;
END $$;
