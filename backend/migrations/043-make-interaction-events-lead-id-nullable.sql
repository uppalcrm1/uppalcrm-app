-- Migration 043: Make interaction_events.lead_id nullable
--
-- Purpose: Allow account-based workflow tasks to be created without a lead_id
--
-- Issue: Workflow engine creates tasks linked only to accounts, not leads.
-- The interaction_events trigger was failing with:
--   "null value in column 'lead_id' violates not-null constraint"
--
-- Solution: Make lead_id nullable since not all interaction events have leads
--
-- Status: Applied to Staging manually, deploying via migration

ALTER TABLE interaction_events
ALTER COLUMN lead_id DROP NOT NULL;

-- Add comment for clarity
COMMENT ON COLUMN interaction_events.lead_id IS 'Foreign key to leads table. Nullable because some interactions (like account-only tasks) may not be linked to a specific lead.';
