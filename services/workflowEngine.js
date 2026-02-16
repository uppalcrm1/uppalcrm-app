const db = require('../database/connection');

/**
 * Workflow Rules Engine
 * Evaluates rules and creates tasks based on triggers and conditions
 */

/**
 * Replace template variables in a string
 * @param {string} template - Template string with {{variable}} placeholders
 * @param {object} data - Object with replacement values
 * @returns {string} Template with variables replaced
 */
function replaceTemplateVars(template, data = {}) {
  if (!template) return '';

  let result = template;

  // Find all {{variable}} patterns and replace them
  const matches = result.match(/\{\{([^}]+)\}\}/g) || [];

  matches.forEach(match => {
    const varName = match.replace(/[{}]/g, '');
    const value = data[varName] || '';
    result = result.replace(new RegExp(`\\{\\{${varName}\\}\\}`, 'g'), value);
  });

  return result;
}

/**
 * Format date for display in templates
 * @param {Date|string} date
 * @returns {string} Formatted date
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Calculate days remaining until a date, using the org's local timezone.
 * Uses Intl.DateTimeFormat (Node.js built-in) which handles DST automatically.
 * @param {Date|string} date - Target date
 * @param {string} orgTimezone - IANA timezone string (e.g. 'America/New_York')
 * @returns {number} Days remaining (can be negative)
 */
function daysUntil(date, orgTimezone = 'America/New_York') {
  if (!date) return 0;
  // Get "today" as a date string in the org's local timezone (handles DST)
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: orgTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()); // returns "YYYY-MM-DD"
  const today = new Date(todayStr + 'T00:00:00');
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  return Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24));
}

/**
 * Determine priority based on days remaining
 * @param {string} priorityConfig - 'auto' or fixed priority
 * @param {number} daysRemaining
 * @returns {string} Priority level
 */
function determinePriority(priorityConfig, daysRemaining) {
  if (priorityConfig !== 'auto') {
    return priorityConfig;
  }

  if (daysRemaining <= 7) return 'high';
  if (daysRemaining <= 14) return 'medium';
  return 'low';
}

/**
 * Execute a single workflow rule
 * @param {string} ruleId - UUID of the rule
 * @param {string} organizationId - UUID of the organization
 * @param {string} triggeredBy - UUID of the user who triggered this (optional)
 * @returns {object} Execution summary with counts and details
 */
async function executeRule(ruleId, organizationId, triggeredBy = null) {
  const startTime = new Date();
  const summary = {
    ruleId,
    organizationId,
    ruleDetails: null,
    recordsEvaluated: 0,
    recordsMatched: 0,
    tasksCreated: 0,
    recordsSkippedDuplicate: 0,
    status: 'success',
    errorMessage: null,
    details: [],
    executionTimeMs: 0
  };

  try {
    // ========================================================================
    // STEP 1: Load the rule
    // ========================================================================
    const ruleResult = await db.query(
      `SELECT * FROM workflow_rules
       WHERE id = $1 AND organization_id = $2`,
      [ruleId, organizationId],
      organizationId
    );

    if (ruleResult.rows.length === 0) {
      summary.status = 'error';
      summary.errorMessage = `Rule not found: ${ruleId}`;
      return summary;
    }

    const rule = ruleResult.rows[0];
    summary.ruleDetails = {
      name: rule.name,
      entityType: rule.entity_type,
      triggerType: rule.trigger_type,
      actionType: rule.action_type
    };

    // ========================================================================
    // STEP 2: Check if rule is enabled
    // ========================================================================
    if (!rule.is_enabled) {
      summary.status = 'skipped';
      summary.errorMessage = `Rule is disabled: ${rule.name}`;
      return summary;
    }

    // ========================================================================
    // STEP 2b: Load org timezone for timezone-aware date calculations
    // Org timezone is the "business timezone" — renewal dates and due dates
    // should be evaluated relative to the business's local time, not UTC.
    // ========================================================================
    const orgTzResult = await db.query(
      `SELECT COALESCE(timezone, 'America/New_York') as timezone FROM organizations WHERE id = $1`,
      [organizationId],
      organizationId
    );
    const orgTimezone = orgTzResult.rows[0]?.timezone || 'America/New_York';

    // ========================================================================
    // STEP 3: Find matching records based on entity_type and trigger_type
    // ========================================================================
    let matchingRecords = [];

    if (rule.entity_type === 'account' && rule.trigger_type === 'renewal_within_days') {
      const days = rule.trigger_conditions.days || 14;

      // STEP 3a: Count total records matching trigger conditions (before duplicate prevention)
      // Uses org timezone via PostgreSQL AT TIME ZONE so "today" is the org's local date, not UTC.
      const countQuery = `
        SELECT COUNT(*) as count
        FROM accounts a
        WHERE a.organization_id = $1
          AND a.next_renewal_date IS NOT NULL
          AND a.next_renewal_date >= (CURRENT_TIMESTAMP AT TIME ZONE $3)::DATE
          AND a.next_renewal_date <= (CURRENT_TIMESTAMP AT TIME ZONE $3)::DATE + INTERVAL '1 day' * $2
      `;

      const countResult = await db.query(countQuery, [organizationId, days, orgTimezone], organizationId);
      summary.recordsEvaluated = parseInt(countResult.rows[0].count) || 0;

      // STEP 3b: Get matching records with duplicate prevention applied
      let matchQuery = `
        SELECT
          a.id as account_id,
          a.account_name,
          a.next_renewal_date,
          a.contact_id,
          a.created_by as assigned_to,
          c.first_name,
          c.last_name,
          c.phone,
          c.email
        FROM accounts a
        JOIN contacts c ON a.contact_id = c.id
        WHERE a.organization_id = $1
          AND a.next_renewal_date IS NOT NULL
          AND a.next_renewal_date >= (CURRENT_TIMESTAMP AT TIME ZONE $3)::DATE
          AND a.next_renewal_date <= (CURRENT_TIMESTAMP AT TIME ZONE $3)::DATE + INTERVAL '1 day' * $2
      `;

      // Add duplicate prevention if enabled
      // Check for ANY pending task on the account, regardless of which rule created it
      if (rule.prevent_duplicates) {
        matchQuery += `
          AND NOT EXISTS (
            SELECT 1 FROM lead_interactions
            WHERE account_id = a.id
            AND interaction_type = 'task'
            AND status NOT IN ('completed', 'cancelled')
          )
        `;
      }

      const matchResult = await db.query(matchQuery,
        [organizationId, days, orgTimezone],
        organizationId
      );

      matchingRecords = matchResult.rows;
    }

    summary.recordsMatched = matchingRecords.length;

    // Calculate records skipped due to duplicate prevention
    if (rule.prevent_duplicates && summary.recordsEvaluated > 0) {
      summary.recordsSkippedDuplicate = summary.recordsEvaluated - summary.recordsMatched;
    }

    // If no matching records, log and return
    if (matchingRecords.length === 0) {
      summary.tasksCreated = 0;

      // Log execution
      await logExecution(rule, summary, triggeredBy, 'manual');
      return summary;
    }

    // ========================================================================
    // STEP 4: Create tasks for each matching record
    // ========================================================================
    const actionConfig = rule.action_config || {};
    let taskCreationErrors = 0;

    for (const record of matchingRecords) {
      try {
        // Prepare template variables
        const daysRemaining = daysUntil(record.next_renewal_date, orgTimezone);
        const renewalDate = formatDate(record.next_renewal_date);
        const contactName = `${record.first_name || ''} ${record.last_name || ''}`.trim();

        const templateData = {
          contact_name: contactName,
          contact_first_name: record.first_name || '',
          contact_last_name: record.last_name || '',
          contact_phone: record.phone || '',
          contact_email: record.email || '',
          account_name: record.account_name || '',
          renewal_date: renewalDate,
          days_remaining: daysRemaining.toString()
        };

        // Replace template variables
        const subject = replaceTemplateVars(actionConfig.subject_template, templateData);
        const description = replaceTemplateVars(actionConfig.description_template, templateData);

        // Determine priority
        const priority = determinePriority(actionConfig.priority, daysRemaining);

        // Determine assigned user based on strategy.
        // Falls back to account owner (record.assigned_to) when no strategy resolves a user —
        // this covers cron runs (triggeredBy=null) and rules without assignee_strategy set.
        let assignedUserId = triggeredBy;
        if (actionConfig.assignee_strategy === 'account_owner' && record.assigned_to) {
          assignedUserId = record.assigned_to;
        } else if (actionConfig.assignee_strategy === 'specific_user' && actionConfig.assignee_user_id) {
          assignedUserId = actionConfig.assignee_user_id;
        } else if (actionConfig.assignee_strategy === 'triggering_user') {
          assignedUserId = triggeredBy;
        }
        // Final fallback: use account owner if still unresolved (required — user_id is NOT NULL)
        if (!assignedUserId && record.assigned_to) {
          assignedUserId = record.assigned_to;
        }

        // Calculate scheduled_at
        const daysBeforeDue = actionConfig.days_before_due || 0;
        const renewalDateObj = new Date(record.next_renewal_date);
        const scheduledAtDate = new Date(renewalDateObj);
        scheduledAtDate.setDate(scheduledAtDate.getDate() - daysBeforeDue);
        const scheduledAt = scheduledAtDate < new Date() ? new Date() : scheduledAtDate;

        // Create the task in lead_interactions
        const taskResult = await db.query(
          `INSERT INTO lead_interactions (
            organization_id,
            lead_id,
            contact_id,
            account_id,
            interaction_type,
            subject,
            description,
            priority,
            status,
            scheduled_at,
            user_id,
            activity_metadata,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
          RETURNING id, subject, priority`,
          [
            organizationId,
            null,
            record.contact_id,
            record.account_id,
            'task',
            subject,
            description,
            priority,
            'pending',
            scheduledAt,
            assignedUserId,
            JSON.stringify({
              rule_id: ruleId,
              trigger_type: rule.trigger_type,
              entity_type: rule.entity_type
            })
          ],
          organizationId
        );

        if (taskResult.rows.length > 0) {
          summary.tasksCreated++;
          summary.details.push({
            account_id: record.account_id,
            account_name: record.account_name,
            contact_id: record.contact_id,
            contact_name: contactName,
            task_id: taskResult.rows[0].id,
            task_subject: subject,
            priority: priority,
            scheduled_at: scheduledAt.toISOString(),
            assigned_to: assignedUserId,
            days_remaining: daysRemaining
          });
        }
      } catch (error) {
        // Log error but continue processing other records
        console.error(`Error creating task for account ${record.account_id}:`, error.message);
        summary.status = 'partial_failure';
        taskCreationErrors++;
        summary.details.push({
          account_id: record.account_id,
          error: error.message,
          status: 'failed'
        });
      }
    }

    // NOTE: recordsSkippedDuplicate was already calculated on line 196
    // DO NOT overwrite it with taskCreationErrors count
    // Task creation errors are tracked separately in summary.details

    // ========================================================================
    // STEP 5: Log the execution
    // ========================================================================
    await logExecution(rule, summary, triggeredBy, 'manual');

    summary.executionTimeMs = new Date() - startTime;
    return summary;

  } catch (error) {
    console.error('Error executing rule:', error.message);
    summary.status = 'error';
    summary.errorMessage = error.message;

    // Try to log the error
    try {
      await logExecution(null, summary, triggeredBy, 'manual');
    } catch (logError) {
      console.error('Error logging rule execution:', logError.message);
    }

    summary.executionTimeMs = new Date() - startTime;
    return summary;
  }
}

/**
 * Execute all enabled rules for an organization
 * @param {string} organizationId - UUID of the organization
 * @param {string} triggeredBy - UUID of the user who triggered this
 * @param {string} triggerSource - 'manual' or 'cron'
 * @returns {object} Combined summary of all rule executions
 */
async function executeAllRules(organizationId, triggeredBy, triggerSource = 'manual') {
  const startTime = new Date();

  const combinedSummary = {
    organizationId,
    triggerSource,
    rulesExecuted: 0,
    totalRecordsEvaluated: 0,
    totalRecordsMatched: 0,
    totalTasksCreated: 0,
    totalRecordsSkipped: 0,
    executionsByRule: [],
    overallStatus: 'success',
    executionTimeMs: 0
  };

  try {
    // Load all enabled rules ordered by sort_order
    const rulesResult = await db.query(
      `SELECT * FROM workflow_rules
       WHERE organization_id = $1 AND is_enabled = true
       ORDER BY sort_order ASC`,
      [organizationId],
      organizationId
    );

    if (rulesResult.rows.length === 0) {
      combinedSummary.overallStatus = 'no_rules';
      return combinedSummary;
    }

    // Execute each rule
    for (const rule of rulesResult.rows) {
      try {
        const result = await executeRule(rule.id, organizationId, triggeredBy);

        combinedSummary.rulesExecuted++;
        combinedSummary.totalRecordsEvaluated += result.recordsEvaluated || 0;
        combinedSummary.totalRecordsMatched += result.recordsMatched || 0;
        combinedSummary.totalTasksCreated += result.tasksCreated || 0;
        combinedSummary.totalRecordsSkipped += result.recordsSkippedDuplicate || 0;

        combinedSummary.executionsByRule.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: result.status,
          tasksCreated: result.tasksCreated,
          recordsMatched: result.recordsMatched
        });

        if (result.status === 'error' || result.status === 'partial_failure') {
          combinedSummary.overallStatus = 'partial_failure';
        }
      } catch (error) {
        console.error(`Error executing rule ${rule.id}:`, error.message);
        combinedSummary.overallStatus = 'partial_failure';

        combinedSummary.executionsByRule.push({
          ruleId: rule.id,
          ruleName: rule.name,
          status: 'error',
          tasksCreated: 0,
          recordsMatched: 0,
          error: error.message
        });
      }
    }

  } catch (error) {
    console.error('Error executing all rules:', error.message);
    combinedSummary.overallStatus = 'error';
  }

  combinedSummary.executionTimeMs = new Date() - startTime;
  return combinedSummary;
}

/**
 * Log rule execution to workflow_rule_logs
 * @private
 */
async function logExecution(rule, summary, triggeredBy, triggerSource) {
  if (!rule) return; // Can't log if rule not loaded

  try {
    await db.query(
      `INSERT INTO workflow_rule_logs (
        organization_id,
        rule_id,
        run_at,
        triggered_by,
        trigger_source,
        records_evaluated,
        records_matched,
        tasks_created,
        records_skipped_duplicate,
        status,
        error_message,
        details
      ) VALUES ($1, $2, NOW(), $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        summary.organizationId,
        rule.id,
        triggeredBy,
        triggerSource,
        summary.recordsEvaluated || 0,
        summary.recordsMatched || 0,
        summary.tasksCreated || 0,
        summary.recordsSkippedDuplicate || 0,
        summary.status,
        summary.errorMessage || null,
        JSON.stringify(summary.details || [])
      ],
      summary.organizationId
    );
  } catch (error) {
    console.error('Error logging rule execution:', error.message);
  }
}

module.exports = {
  executeRule,
  executeAllRules,
  replaceTemplateVars,
  formatDate,
  daysUntil,
  determinePriority
};
