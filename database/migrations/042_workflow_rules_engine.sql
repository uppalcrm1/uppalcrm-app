-- ============================================================================
-- Migration 042: Workflow Rules Engine (Tier 2 - Organization Feature)
-- ============================================================================
-- Creates tables for organizations to define automated rules that create tasks
-- based on triggers (e.g., renewal within X days) and conditions.
--
-- Multi-tenant: Each organization manages their own rules
-- Extensible: Conditions and actions stored as JSONB for flexibility
-- ============================================================================

-- ============================================================================
-- TABLE 1: workflow_rules
-- ============================================================================
-- Stores rule definitions that organization admins create and configure.
-- Each rule watches for a trigger condition and executes an action.
--
-- Example Rule:
-- - Name: "Renewal Reminder"
-- - Entity: account
-- - Trigger: renewal_within_days (14 days)
-- - Action: create_task (with subject/description templates)
--
CREATE TABLE IF NOT EXISTS workflow_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- ========================================================================
  -- Rule Identity
  -- ========================================================================
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- ========================================================================
  -- Entity Type (Multi-Entity Support)
  -- ========================================================================
  -- What entity does this rule watch?
  -- V1: 'account' only
  -- Future: 'lead', 'contact', 'custom_entity'
  entity_type VARCHAR(50) NOT NULL DEFAULT 'account',
  CHECK (entity_type IN ('account', 'lead', 'contact')),

  -- ========================================================================
  -- Trigger Type & Conditions (Extensible via JSONB)
  -- ========================================================================
  -- What condition triggers the rule?
  --
  -- V1 Trigger Types for Accounts:
  --   'renewal_within_days'
  --     Conditions: {"days": 14}
  --     → Trigger when renewal_date <= NOW() + X days
  --
  -- Future Trigger Types:
  --   'status_unchanged_days' (lead/contact in same status for X days)
  --     Conditions: {"status": "new", "days": 3}
  --
  --   'no_interaction_days' (no communication for X days)
  --     Conditions: {"days": 30, "interaction_types": ["email", "call"]}
  --
  --   'license_usage_threshold' (license usage exceeds threshold)
  --     Conditions: {"threshold_percent": 80}
  --
  trigger_type VARCHAR(100) NOT NULL,
  trigger_conditions JSONB NOT NULL DEFAULT '{}',

  -- ========================================================================
  -- Action Type & Configuration (Extensible via JSONB)
  -- ========================================================================
  -- What action does this rule take when triggered?
  --
  -- V1 Action Types:
  --   'create_task'
  --     Config: {
  --       "subject_template": "Renewal: {{contact_name}} - {{account_name}}",
  --       "description_template": "Account renewal due on {{renewal_date}}.",
  --       "priority": "high",
  --       "days_before_due": 7,
  --       "assignee_strategy": "account_owner" | "account_team" | "specific_user"
  --       "assignee_user_id": "uuid" (if assignee_strategy = "specific_user")
  --     }
  --
  -- Future Action Types:
  --   'send_email'
  --     Config: {
  --       "template_id": "uuid",
  --       "to_strategy": "account_owner" | "all_contacts",
  --       "delay_days": 0
  --     }
  --
  --   'update_field'
  --     Config: {
  --       "field": "status",
  --       "value": "at_risk"
  --     }
  --
  --   'send_notification'
  --     Config: {
  --       "target_users": ["uuid1", "uuid2"],
  --       "message": "Account renewal coming up"
  --     }
  --
  action_type VARCHAR(100) NOT NULL DEFAULT 'create_task',
  action_config JSONB NOT NULL DEFAULT '{}',

  -- ========================================================================
  -- Control Flags
  -- ========================================================================
  -- is_enabled: Turn rule on/off without deleting
  is_enabled BOOLEAN NOT NULL DEFAULT true,

  -- prevent_duplicates: Don't create duplicate tasks for same record
  -- If TRUE:
  --   - Check for existing task created by this rule for this account
  --   - Skip if similar task already exists
  prevent_duplicates BOOLEAN NOT NULL DEFAULT true,

  -- ========================================================================
  -- Execution Schedule
  -- ========================================================================
  -- When should this rule run?
  -- 'manual_and_auto': Admin can click "Run" button + automatic daily cron
  -- 'manual_only': Only when admin explicitly clicks "Run"
  -- 'auto_only': Only on daily cron (no manual trigger)
  run_mode VARCHAR(50) NOT NULL DEFAULT 'manual_and_auto',
  CHECK (run_mode IN ('manual_and_auto', 'manual_only', 'auto_only')),

  -- sort_order: Process multiple rules in defined order
  -- (lower numbers run first)
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- ========================================================================
  -- Audit & Metadata
  -- ========================================================================
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE (organization_id, name)
);

-- Note: Trigger for updated_at will be added in a separate follow-up migration
-- to avoid parsing issues with nested dollar-quoted strings

-- ============================================================================
-- TABLE 2: workflow_rule_logs
-- ============================================================================
-- Audit trail of rule executions. Tracks:
-- - When the rule ran (manual or cron)
-- - How many records matched
-- - How many tasks were created
-- - Any errors that occurred
-- - Details of what was created (for review)
--
-- Retention: Keep logs indefinitely for audit trail
-- (Organizations can manually delete old logs if needed)
--
CREATE TABLE IF NOT EXISTS workflow_rule_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES workflow_rules(id) ON DELETE CASCADE,

  -- ========================================================================
  -- Execution Details
  -- ========================================================================
  run_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Who triggered this execution?
  -- NULL if triggered by cron job
  -- user_id if triggered by admin clicking "Run"
  triggered_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- How was this rule triggered?
  -- 'manual': Admin clicked "Run" button
  -- 'cron': Automatic daily execution
  -- 'api': External API trigger (future)
  trigger_source VARCHAR(50) NOT NULL DEFAULT 'manual',
  CHECK (trigger_source IN ('manual', 'cron', 'api')),

  -- ========================================================================
  -- Execution Results
  -- ========================================================================
  -- records_evaluated: How many records matched the entity type
  records_evaluated INTEGER NOT NULL DEFAULT 0,

  -- records_matched: How many records matched the trigger condition
  records_matched INTEGER NOT NULL DEFAULT 0,

  -- tasks_created: How many tasks were actually created
  tasks_created INTEGER NOT NULL DEFAULT 0,

  -- records_skipped_duplicate: How many were skipped due to prevent_duplicates
  records_skipped_duplicate INTEGER NOT NULL DEFAULT 0,

  -- ========================================================================
  -- Status & Error Handling
  -- ========================================================================
  status VARCHAR(50) NOT NULL DEFAULT 'success',
  CHECK (status IN ('success', 'partial_failure', 'error')),

  error_message TEXT,

  -- ========================================================================
  -- Execution Details (for Admin Review)
  -- ========================================================================
  -- JSON array of objects, each representing a created task
  -- Example:
  -- [
  --   {
  --     "account_id": "uuid",
  --     "account_name": "Acme Corp",
  --     "contact_name": "John Smith",
  --     "task_subject": "Renewal: John Smith - Acme Corp",
  --     "task_id": "uuid",
  --     "priority": "high",
  --     "due_date": "2024-02-14",
  --     "assigned_to": "uuid",
  --     "reason": "Account renewal in 14 days"
  --   },
  --   ...
  -- ]
  details JSONB DEFAULT '[]',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- workflow_rules indexes
CREATE INDEX IF NOT EXISTS idx_workflow_rules_org
  ON workflow_rules(organization_id);

CREATE INDEX IF NOT EXISTS idx_workflow_rules_enabled
  ON workflow_rules(organization_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_workflow_rules_entity_type
  ON workflow_rules(organization_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_workflow_rules_sort_order
  ON workflow_rules(organization_id, sort_order);

-- workflow_rule_logs indexes
CREATE INDEX IF NOT EXISTS idx_workflow_rule_logs_org
  ON workflow_rule_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_workflow_rule_logs_rule
  ON workflow_rule_logs(rule_id);

CREATE INDEX IF NOT EXISTS idx_workflow_rule_logs_run_at
  ON workflow_rule_logs(run_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_rule_logs_org_run_at
  ON workflow_rule_logs(organization_id, run_at DESC);

-- ============================================================================
-- ROW-LEVEL SECURITY (RLS)
-- ============================================================================
-- Enforce organization isolation: users can only see their org's rules

ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rule_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- workflow_rules RLS Policies
-- ============================================================================

-- Policy: Users can view rules for their organization
CREATE POLICY workflow_rules_view ON workflow_rules
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_organization_id')::uuid
  );

-- Policy: Users can create rules for their organization
CREATE POLICY workflow_rules_create ON workflow_rules
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id')::uuid
  );

-- Policy: Users can update rules for their organization
CREATE POLICY workflow_rules_update ON workflow_rules
  FOR UPDATE
  USING (
    organization_id = current_setting('app.current_organization_id')::uuid
  );

-- Policy: Users can delete rules for their organization
CREATE POLICY workflow_rules_delete ON workflow_rules
  FOR DELETE
  USING (
    organization_id = current_setting('app.current_organization_id')::uuid
  );

-- ============================================================================
-- workflow_rule_logs RLS Policies
-- ============================================================================

-- Policy: Users can view logs for their organization
CREATE POLICY workflow_rule_logs_view ON workflow_rule_logs
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_organization_id')::uuid
  );

-- Policy: Users can create logs for their organization
CREATE POLICY workflow_rule_logs_create ON workflow_rule_logs
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.current_organization_id')::uuid
  );

-- ============================================================================
-- COMMENTS (for future reference)
-- ============================================================================

COMMENT ON TABLE workflow_rules IS
  'Stores rule definitions for automated task creation based on entity triggers and conditions';

COMMENT ON TABLE workflow_rule_logs IS
  'Audit trail of all workflow rule executions, including counts and details of created tasks';

COMMENT ON COLUMN workflow_rules.trigger_conditions IS
  'JSONB object storing trigger-specific parameters (e.g., {"days": 14})';

COMMENT ON COLUMN workflow_rules.action_config IS
  'JSONB object storing action-specific configuration (e.g., task templates, priorities)';

COMMENT ON COLUMN workflow_rules.prevent_duplicates IS
  'If TRUE, prevent creating duplicate tasks for the same record within a time period';

COMMENT ON COLUMN workflow_rule_logs.details IS
  'JSONB array of created task details for admin review and audit purposes';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
