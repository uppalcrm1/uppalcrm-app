/**
 * Workflow Rules API Routes
 * CRUD operations and rule execution endpoints
 */

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const workflowEngine = require('../services/workflowEngine');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// ============================================================================
// GET /api/workflow-rules
// ============================================================================
// Return all workflow rules for the organization with their last execution log
//
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        wr.id,
        wr.name,
        wr.description,
        wr.entity_type,
        wr.trigger_type,
        wr.trigger_conditions,
        wr.action_type,
        wr.action_config,
        wr.is_enabled,
        wr.prevent_duplicates,
        wr.run_mode,
        wr.sort_order,
        wr.created_by,
        wr.created_at,
        wr.updated_at,
        -- Latest log information
        wrl.id as last_log_id,
        wrl.run_at as last_run_at,
        wrl.trigger_source as last_trigger_source,
        wrl.records_matched as last_records_matched,
        wrl.tasks_created as last_tasks_created,
        wrl.status as last_status
      FROM workflow_rules wr
      LEFT JOIN LATERAL (
        SELECT id, run_at, trigger_source, records_matched, tasks_created, status
        FROM workflow_rule_logs
        WHERE rule_id = wr.id
        ORDER BY run_at DESC
        LIMIT 1
      ) wrl ON true
      WHERE wr.organization_id = $1
      ORDER BY wr.sort_order ASC, wr.created_at DESC`,
      [req.organizationId],
      req.organizationId
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        entityType: row.entity_type,
        triggerType: row.trigger_type,
        triggerConditions: row.trigger_conditions,
        actionType: row.action_type,
        actionConfig: row.action_config,
        isEnabled: row.is_enabled,
        preventDuplicates: row.prevent_duplicates,
        runMode: row.run_mode,
        sortOrder: row.sort_order,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastRun: row.last_run_at ? {
          id: row.last_log_id,
          runAt: row.last_run_at,
          triggerSource: row.last_trigger_source,
          recordsMatched: row.last_records_matched,
          tasksCreated: row.last_tasks_created,
          status: row.last_status
        } : null
      }))
    });
  } catch (error) {
    console.error('Error fetching workflow rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/workflow-rules/:id
// ============================================================================
// Return a single rule with its last 10 execution logs
//
router.get('/:id', async (req, res) => {
  try {
    // Get the rule
    const ruleResult = await db.query(
      `SELECT * FROM workflow_rules
       WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.organizationId],
      req.organizationId
    );

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    const rule = ruleResult.rows[0];

    // Get recent logs
    const logsResult = await db.query(
      `SELECT * FROM workflow_rule_logs
       WHERE rule_id = $1 AND organization_id = $2
       ORDER BY run_at DESC
       LIMIT 10`,
      [req.params.id, req.organizationId],
      req.organizationId
    );

    res.json({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        entityType: rule.entity_type,
        triggerType: rule.trigger_type,
        triggerConditions: rule.trigger_conditions,
        actionType: rule.action_type,
        actionConfig: rule.action_config,
        isEnabled: rule.is_enabled,
        preventDuplicates: rule.prevent_duplicates,
        runMode: rule.run_mode,
        sortOrder: rule.sort_order,
        createdBy: rule.created_by,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
        logs: logsResult.rows.map(log => ({
          id: log.id,
          runAt: log.run_at,
          triggeredBy: log.triggered_by,
          triggerSource: log.trigger_source,
          recordsEvaluated: log.records_evaluated,
          recordsMatched: log.records_matched,
          tasksCreated: log.tasks_created,
          recordsSkippedDuplicate: log.records_skipped_duplicate,
          status: log.status,
          errorMessage: log.error_message,
          details: log.details
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching workflow rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/workflow-rules
// ============================================================================
// Create a new workflow rule
//
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      entityType = 'account',
      triggerType,
      triggerConditions,
      actionType = 'create_task',
      actionConfig,
      isEnabled = true,
      preventDuplicates = true,
      runMode = 'manual_and_auto',
      sortOrder = 0
    } = req.body;

    // Validation
    if (!name || !triggerType || !triggerConditions || !actionConfig) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, triggerType, triggerConditions, actionConfig'
      });
    }

    const result = await db.query(
      `INSERT INTO workflow_rules (
        organization_id,
        name,
        description,
        entity_type,
        trigger_type,
        trigger_conditions,
        action_type,
        action_config,
        is_enabled,
        prevent_duplicates,
        run_mode,
        sort_order,
        created_by,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        req.organizationId,
        name,
        description || null,
        entityType,
        triggerType,
        JSON.stringify(triggerConditions),
        actionType,
        JSON.stringify(actionConfig),
        isEnabled,
        preventDuplicates,
        runMode,
        sortOrder,
        req.user?.id || null
      ],
      req.organizationId
    );

    const rule = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        entityType: rule.entity_type,
        triggerType: rule.trigger_type,
        triggerConditions: rule.trigger_conditions,
        actionType: rule.action_type,
        actionConfig: rule.action_config,
        isEnabled: rule.is_enabled,
        preventDuplicates: rule.prevent_duplicates,
        runMode: rule.run_mode,
        sortOrder: rule.sort_order,
        createdAt: rule.created_at
      }
    });
  } catch (error) {
    console.error('Error creating workflow rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// PUT /api/workflow-rules/:id
// ============================================================================
// Update a workflow rule
//
router.put('/:id', async (req, res) => {
  try {
    // Verify rule exists and belongs to this org
    const existingResult = await db.query(
      `SELECT id FROM workflow_rules
       WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.organizationId],
      req.organizationId
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    // Update the rule
    const {
      name,
      description,
      entityType,
      triggerType,
      triggerConditions,
      actionType,
      actionConfig,
      isEnabled,
      preventDuplicates,
      runMode,
      sortOrder
    } = req.body;

    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(description);
    }
    if (entityType !== undefined) {
      updateFields.push(`entity_type = $${paramIndex++}`);
      updateValues.push(entityType);
    }
    if (triggerType !== undefined) {
      updateFields.push(`trigger_type = $${paramIndex++}`);
      updateValues.push(triggerType);
    }
    if (triggerConditions !== undefined) {
      updateFields.push(`trigger_conditions = $${paramIndex++}`);
      updateValues.push(JSON.stringify(triggerConditions));
    }
    if (actionType !== undefined) {
      updateFields.push(`action_type = $${paramIndex++}`);
      updateValues.push(actionType);
    }
    if (actionConfig !== undefined) {
      updateFields.push(`action_config = $${paramIndex++}`);
      updateValues.push(JSON.stringify(actionConfig));
    }
    if (isEnabled !== undefined) {
      updateFields.push(`is_enabled = $${paramIndex++}`);
      updateValues.push(isEnabled);
    }
    if (preventDuplicates !== undefined) {
      updateFields.push(`prevent_duplicates = $${paramIndex++}`);
      updateValues.push(preventDuplicates);
    }
    if (runMode !== undefined) {
      updateFields.push(`run_mode = $${paramIndex++}`);
      updateValues.push(runMode);
    }
    if (sortOrder !== undefined) {
      updateFields.push(`sort_order = $${paramIndex++}`);
      updateValues.push(sortOrder);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    updateValues.push(req.params.id);
    updateValues.push(req.organizationId);

    const query = `
      UPDATE workflow_rules
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex + 1} AND organization_id = $${paramIndex + 2}
      RETURNING *
    `;

    const result = await db.query(query, updateValues, req.organizationId);

    const rule = result.rows[0];

    res.json({
      success: true,
      data: {
        id: rule.id,
        name: rule.name,
        description: rule.description,
        entityType: rule.entity_type,
        triggerType: rule.trigger_type,
        triggerConditions: rule.trigger_conditions,
        actionType: rule.action_type,
        actionConfig: rule.action_config,
        isEnabled: rule.is_enabled,
        preventDuplicates: rule.prevent_duplicates,
        runMode: rule.run_mode,
        sortOrder: rule.sort_order,
        updatedAt: rule.updated_at
      }
    });
  } catch (error) {
    console.error('Error updating workflow rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// DELETE /api/workflow-rules/:id
// ============================================================================
// Delete a workflow rule (cascades to logs)
//
router.delete('/:id', async (req, res) => {
  try {
    // Verify rule exists and belongs to this org
    const existingResult = await db.query(
      `SELECT id FROM workflow_rules
       WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.organizationId],
      req.organizationId
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    // Delete the rule (logs cascade delete)
    await db.query(
      `DELETE FROM workflow_rules
       WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.organizationId],
      req.organizationId
    );

    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting workflow rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/workflow-rules/:id/execute
// ============================================================================
// Execute a single workflow rule manually
//
router.post('/:id/execute', async (req, res) => {
  try {
    const summary = await workflowEngine.executeRule(
      req.params.id,
      req.organizationId,
      req.user?.id || null
    );

    res.json({
      success: summary.status !== 'error',
      data: {
        ruleId: summary.ruleId,
        ruleDetails: summary.ruleDetails,
        recordsEvaluated: summary.recordsEvaluated,
        recordsMatched: summary.recordsMatched,
        tasksCreated: summary.tasksCreated,
        recordsSkippedDuplicate: summary.recordsSkippedDuplicate,
        status: summary.status,
        errorMessage: summary.errorMessage,
        details: summary.details,
        executionTimeMs: summary.executionTimeMs
      }
    });
  } catch (error) {
    console.error('Error executing workflow rule:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// POST /api/workflow-rules/execute-all
// ============================================================================
// Execute all enabled workflow rules
//
router.post('/execute-all', async (req, res) => {
  try {
    const summary = await workflowEngine.executeAllRules(
      req.organizationId,
      req.user?.id || null,
      'manual'
    );

    res.json({
      success: summary.overallStatus !== 'error',
      data: {
        organizationId: summary.organizationId,
        triggerSource: summary.triggerSource,
        rulesExecuted: summary.rulesExecuted,
        totalRecordsEvaluated: summary.totalRecordsEvaluated,
        totalRecordsMatched: summary.totalRecordsMatched,
        totalTasksCreated: summary.totalTasksCreated,
        totalRecordsSkipped: summary.totalRecordsSkipped,
        overallStatus: summary.overallStatus,
        executionsByRule: summary.executionsByRule,
        executionTimeMs: summary.executionTimeMs
      }
    });
  } catch (error) {
    console.error('Error executing all workflow rules:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================================
// GET /api/workflow-rules/:id/logs
// ============================================================================
// Get paginated execution logs for a rule
//
router.get('/:id/logs', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Verify rule exists
    const ruleCheck = await db.query(
      `SELECT id FROM workflow_rules
       WHERE id = $1 AND organization_id = $2`,
      [req.params.id, req.organizationId],
      req.organizationId
    );

    if (ruleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rule not found'
      });
    }

    // Get total count
    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM workflow_rule_logs
       WHERE rule_id = $1 AND organization_id = $2`,
      [req.params.id, req.organizationId],
      req.organizationId
    );

    const total = countResult.rows[0].total;

    // Get paginated logs
    const logsResult = await db.query(
      `SELECT * FROM workflow_rule_logs
       WHERE rule_id = $1 AND organization_id = $2
       ORDER BY run_at DESC
       LIMIT $3 OFFSET $4`,
      [req.params.id, req.organizationId, limit, offset],
      req.organizationId
    );

    res.json({
      success: true,
      data: {
        logs: logsResult.rows.map(log => ({
          id: log.id,
          runAt: log.run_at,
          triggeredBy: log.triggered_by,
          triggerSource: log.trigger_source,
          recordsEvaluated: log.records_evaluated,
          recordsMatched: log.records_matched,
          tasksCreated: log.tasks_created,
          recordsSkippedDuplicate: log.records_skipped_duplicate,
          status: log.status,
          errorMessage: log.error_message,
          details: log.details
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching workflow rule logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
