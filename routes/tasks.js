const express = require('express');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validation');
const Joi = require('joi');
const db = require('../database/connection');

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

/**
 * GET /api/tasks
 * Get all tasks across the organization with filtering and sorting
 *
 * Query Parameters:
 * - assigned_to: UUID of assigned user (optional)
 * - lead_owner: UUID of lead owner (optional)
 * - status: Task status - scheduled, completed, cancelled, pending, overdue (optional)
 * - priority: Task priority - low, medium, high (optional)
 * - sort_by: Sort field - scheduled_at, priority, created_at (default: scheduled_at)
 * - sort_order: Sort order - asc, desc (default: asc)
 * - limit: Number of results (default: 100, max: 1000)
 * - offset: Pagination offset (default: 0)
 */

// Validation schema for query parameters
const getAllTasksSchema = Joi.object({
  assigned_to: Joi.string().uuid().optional(),
  lead_owner: Joi.string().uuid().optional(),
  status: Joi.string().valid('scheduled', 'completed', 'cancelled', 'pending', 'overdue').optional(),
  priority: Joi.string().valid('low', 'medium', 'high').optional(),
  sort_by: Joi.string().valid('scheduled_at', 'priority', 'created_at').default('scheduled_at'),
  sort_order: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('asc'),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  offset: Joi.number().integer().min(0).default(0)
});

router.get('/',
  validate(getAllTasksSchema, 'query'),
  async (req, res) => {
    try {
      const organizationId = req.organizationId;
      const {
        assigned_to,
        lead_owner,
        status,
        priority,
        sort_by = 'scheduled_at',
        sort_order = 'asc',
        limit = 100,
        offset = 0
      } = req.query;

      // Build WHERE conditions
      let whereConditions = [
        'li.interaction_type = $1',
        'li.organization_id = $2'
      ];
      let queryParams = ['task', organizationId];
      let paramIndex = 3;

      // Filter by assigned user
      if (assigned_to) {
        whereConditions.push(`li.user_id = $${paramIndex}`);
        queryParams.push(assigned_to);
        paramIndex++;
      }

      // Filter by lead owner
      if (lead_owner) {
        whereConditions.push(`l.assigned_to = $${paramIndex}`);
        queryParams.push(lead_owner);
        paramIndex++;
      }

      // Filter by status
      if (status) {
        if (status === 'pending') {
          // Pending includes both 'scheduled' and any tasks not completed/cancelled
          whereConditions.push(`li.status IN ('scheduled', 'pending')`);
        } else if (status === 'overdue') {
          // Overdue tasks are scheduled tasks past their scheduled date
          whereConditions.push(`li.status IN ('scheduled', 'pending')`);
          whereConditions.push(`li.scheduled_at < NOW()`);
        } else {
          whereConditions.push(`li.status = $${paramIndex}`);
          queryParams.push(status);
          paramIndex++;
        }
      }

      // Filter by priority
      if (priority) {
        whereConditions.push(`li.priority = $${paramIndex}`);
        queryParams.push(priority);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Build ORDER BY clause
      let orderByClause = '';
      const validSortColumns = {
        'scheduled_at': 'li.scheduled_at',
        'priority': `CASE li.priority
                      WHEN 'high' THEN 3
                      WHEN 'medium' THEN 2
                      WHEN 'low' THEN 1
                      ELSE 0 END`,
        'created_at': 'li.created_at'
      };

      const sortColumn = validSortColumns[sort_by] || validSortColumns['scheduled_at'];
      const sortDirection = (sort_order || 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

      // Always include secondary sorting for consistency
      orderByClause = `
        ORDER BY
          CASE WHEN li.status IN ('scheduled', 'pending') THEN 0 ELSE 1 END,
          ${sortColumn} ${sortDirection},
          li.created_at DESC
      `;

      // Main query to fetch tasks with lead and user information
      const query = `
        SELECT
          li.id,
          li.subject,
          li.description,
          li.lead_id,
          li.user_id as assigned_to,
          li.status,
          li.priority,
          li.scheduled_at,
          li.completed_at,
          li.created_at,
          li.updated_at,
          li.outcome,
          -- Lead information
          l.first_name || ' ' || l.last_name as lead_name,
          l.assigned_to as lead_owner_id,
          -- Lead owner information
          lead_owner.first_name || ' ' || lead_owner.last_name as lead_owner_name,
          -- Assigned user information
          assigned_user.first_name || ' ' || assigned_user.last_name as assigned_to_name
        FROM lead_interactions li
        LEFT JOIN leads l ON li.lead_id = l.id
        LEFT JOIN users lead_owner ON l.assigned_to = lead_owner.id
        LEFT JOIN users assigned_user ON li.user_id = assigned_user.id
        WHERE ${whereClause}
        ${orderByClause}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);

      console.log('📋 Fetching tasks with query:', { whereClause, orderByClause, params: queryParams });
      const result = await db.query(query, queryParams);

      // Calculate statistics from ALL tasks (without filters except organization)
      const statsQuery = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'pending')) as pending,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status IN ('scheduled', 'pending') AND scheduled_at < NOW()) as overdue
        FROM lead_interactions
        WHERE interaction_type = 'task' AND organization_id = $1
      `;

      const statsResult = await db.query(statsQuery, [organizationId]);
      const stats = {
        total: parseInt(statsResult.rows[0].total) || 0,
        pending: parseInt(statsResult.rows[0].pending) || 0,
        completed: parseInt(statsResult.rows[0].completed) || 0,
        overdue: parseInt(statsResult.rows[0].overdue) || 0
      };

      console.log('✅ Tasks fetched successfully:', { count: result.rows.length, stats });

      res.json({
        tasks: result.rows,
        stats,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: stats.total
        }
      });

    } catch (error) {
      console.error('❌ Error fetching all tasks:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        organizationId: req.organizationId,
        query: req.query
      });

      res.status(500).json({
        error: 'Failed to fetch tasks',
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  }
);

/**
 * GET /api/tasks/stats
 * Get task statistics for the organization
 */
router.get('/stats', async (req, res) => {
  try {
    const organizationId = req.organizationId;

    const statsQuery = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('scheduled', 'pending')) as pending,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE status IN ('scheduled', 'pending') AND scheduled_at < NOW()) as overdue,
        COUNT(*) FILTER (WHERE priority = 'high') as high_priority,
        COUNT(*) FILTER (WHERE priority = 'medium') as medium_priority,
        COUNT(*) FILTER (WHERE priority = 'low') as low_priority,
        COUNT(*) FILTER (WHERE scheduled_at >= CURRENT_DATE AND scheduled_at < CURRENT_DATE + INTERVAL '7 days') as due_this_week,
        COUNT(*) FILTER (WHERE scheduled_at >= CURRENT_DATE AND scheduled_at < CURRENT_DATE + INTERVAL '1 day') as due_today
      FROM lead_interactions
      WHERE interaction_type = 'task' AND organization_id = $1
    `;

    const result = await db.query(statsQuery, [organizationId]);
    const stats = result.rows[0];

    // Convert all values to integers
    Object.keys(stats).forEach(key => {
      stats[key] = parseInt(stats[key]) || 0;
    });

    res.json({ stats });

  } catch (error) {
    console.error('❌ Error fetching task statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch task statistics',
      message: error.message
    });
  }
});

module.exports = router;
