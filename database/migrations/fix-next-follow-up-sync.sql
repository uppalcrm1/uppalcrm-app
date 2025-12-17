-- Migration: Sync next_follow_up with actual pending tasks
-- This ensures the next_follow_up field in leads table always matches the earliest pending task

-- Function to update lead's next_follow_up based on pending tasks
CREATE OR REPLACE FUNCTION update_lead_next_follow_up()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is a task interaction
    IF (TG_OP = 'DELETE' AND OLD.interaction_type = 'task') OR
       (TG_OP IN ('INSERT', 'UPDATE') AND NEW.interaction_type = 'task') THEN

        -- Update the lead's next_follow_up to the earliest pending task
        -- This handles both NEW and OLD lead_id (for INSERT, UPDATE, DELETE)
        UPDATE leads
        SET next_follow_up = (
            SELECT MIN(scheduled_at)
            FROM lead_interactions
            WHERE lead_id = COALESCE(NEW.lead_id, OLD.lead_id)
              AND interaction_type = 'task'
              AND status IN ('scheduled', 'pending')
              AND scheduled_at IS NOT NULL
        ),
        updated_at = NOW()
        WHERE id = COALESCE(NEW.lead_id, OLD.lead_id);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS sync_lead_next_follow_up ON lead_interactions;

-- Create trigger that fires after INSERT, UPDATE, or DELETE on lead_interactions
CREATE TRIGGER sync_lead_next_follow_up
AFTER INSERT OR UPDATE OR DELETE ON lead_interactions
FOR EACH ROW
EXECUTE FUNCTION update_lead_next_follow_up();

-- Backfill: Update all existing leads to have correct next_follow_up
UPDATE leads l
SET next_follow_up = (
    SELECT MIN(li.scheduled_at)
    FROM lead_interactions li
    WHERE li.lead_id = l.id
      AND li.interaction_type = 'task'
      AND li.status IN ('scheduled', 'pending')
      AND li.scheduled_at IS NOT NULL
),
updated_at = NOW()
WHERE EXISTS (
    SELECT 1
    FROM lead_interactions li
    WHERE li.lead_id = l.id
      AND li.interaction_type = 'task'
);

-- Report on changes
SELECT
    COUNT(*) as total_leads_updated,
    COUNT(*) FILTER (WHERE next_follow_up IS NOT NULL) as leads_with_follow_up,
    COUNT(*) FILTER (WHERE next_follow_up IS NULL) as leads_without_follow_up
FROM leads
WHERE id IN (
    SELECT DISTINCT lead_id
    FROM lead_interactions
    WHERE interaction_type = 'task'
);
