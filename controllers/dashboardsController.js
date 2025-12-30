const db = require('../database/connection');
const queryBuilderService = require('../services/queryBuilderService');

/**
 * Dashboards Controller
 * Handles all custom dashboards endpoints including CRUD and widget execution
 */

// ============================================
// SAVED DASHBOARDS CRUD
// ============================================

/**
 * Get all saved dashboards for the current user
 * GET /api/dashboards/saved
 */
const getSavedDashboards = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const query = `
      SELECT
        id,
        name,
        description,
        is_default,
        layout,
        created_at,
        updated_at
      FROM saved_dashboards
      WHERE user_id = $1 AND organization_id = $2
      ORDER BY is_default DESC, updated_at DESC
    `;

    const result = await db.query(query, [userId, organizationId], organizationId);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching saved dashboards:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved dashboards',
      message: error.message
    });
  }
};

/**
 * Get a single saved dashboard
 * GET /api/dashboards/saved/:id
 */
const getSavedDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const result = await db.query(
      `SELECT * FROM saved_dashboards
       WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, organizationId],
      organizationId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching saved dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved dashboard',
      message: error.message
    });
  }
};

/**
 * Create a new saved dashboard
 * POST /api/dashboards/saved
 */
const createSavedDashboard = async (req, res) => {
  try {
    const { name, description, layout, is_default = false } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required'
      });
    }

    // Validate layout structure
    if (layout && !layout.widgets) {
      return res.status(400).json({
        success: false,
        error: 'Layout must contain a widgets array'
      });
    }

    // If setting as default, unset other defaults first
    if (is_default) {
      await db.query(
        `UPDATE saved_dashboards
         SET is_default = false
         WHERE user_id = $1 AND organization_id = $2`,
        [userId, organizationId],
        organizationId
      );
    }

    // Insert dashboard
    const defaultLayout = { widgets: [] };
    const result = await db.query(
      `INSERT INTO saved_dashboards
       (organization_id, user_id, name, description, layout, is_default, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [organizationId, userId, name, description, JSON.stringify(layout || defaultLayout), is_default],
      organizationId
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Dashboard created successfully'
    });
  } catch (error) {
    console.error('Error creating saved dashboard:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A dashboard with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create saved dashboard',
      message: error.message
    });
  }
};

/**
 * Update a saved dashboard
 * PUT /api/dashboards/saved/:id
 */
const updateSavedDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, layout, is_default } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Validate layout if provided
    if (layout && !layout.widgets) {
      return res.status(400).json({
        success: false,
        error: 'Layout must contain a widgets array'
      });
    }

    // If setting as default, unset other defaults first
    if (is_default === true) {
      await db.query(
        `UPDATE saved_dashboards
         SET is_default = false
         WHERE user_id = $1 AND organization_id = $2 AND id != $3`,
        [userId, organizationId, id],
        organizationId
      );
    }

    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      params.push(description);
    }
    if (layout !== undefined) {
      updates.push(`layout = $${paramIndex++}`);
      params.push(JSON.stringify(layout));
    }
    if (is_default !== undefined) {
      updates.push(`is_default = $${paramIndex++}`);
      params.push(is_default);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    // Add WHERE clause parameters
    params.push(id, userId, organizationId);

    const query = `
      UPDATE saved_dashboards
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND organization_id = $${paramIndex + 2}
      RETURNING *
    `;

    const result = await db.query(query, params, organizationId);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Dashboard updated successfully'
    });
  } catch (error) {
    console.error('Error updating saved dashboard:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A dashboard with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update saved dashboard',
      message: error.message
    });
  }
};

/**
 * Delete a saved dashboard
 * DELETE /api/dashboards/saved/:id
 */
const deleteSavedDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const result = await db.query(
      `DELETE FROM saved_dashboards
       WHERE id = $1 AND user_id = $2 AND organization_id = $3
       RETURNING id, name`,
      [id, userId, organizationId],
      organizationId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    res.json({
      success: true,
      message: 'Dashboard deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting saved dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete saved dashboard',
      message: error.message
    });
  }
};

/**
 * Set a dashboard as default
 * POST /api/dashboards/saved/:id/set-default
 */
const setDefaultDashboard = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // First, verify the dashboard exists and belongs to the user
    const checkResult = await db.query(
      `SELECT id FROM saved_dashboards
       WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, organizationId],
      organizationId
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Dashboard not found'
      });
    }

    // Unset all other defaults for this user
    await db.query(
      `UPDATE saved_dashboards
       SET is_default = false
       WHERE user_id = $1 AND organization_id = $2`,
      [userId, organizationId],
      organizationId
    );

    // Set this dashboard as default
    const result = await db.query(
      `UPDATE saved_dashboards
       SET is_default = true, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND organization_id = $3
       RETURNING *`,
      [id, userId, organizationId],
      organizationId
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Dashboard set as default'
    });
  } catch (error) {
    console.error('Error setting default dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set default dashboard',
      message: error.message
    });
  }
};

// ============================================
// WIDGET EXECUTION
// ============================================

/**
 * Execute a widget (run the widget's data query)
 * POST /api/dashboards/widgets/execute
 */
const executeWidget = async (req, res) => {
  try {
    const { widgetConfig } = req.body;
    const organizationId = req.user.organization_id;

    if (!widgetConfig || !widgetConfig.type) {
      return res.status(400).json({
        success: false,
        error: 'Widget configuration with type is required'
      });
    }

    let data = null;

    switch (widgetConfig.type) {
      case 'kpi':
        // Execute KPI calculation
        data = await executeKPIWidget(widgetConfig, organizationId);
        break;

      case 'chart':
        // Execute chart query (uses saved report config)
        if (widgetConfig.reportId) {
          // Load saved report and execute
          const reportResult = await db.query(
            `SELECT config FROM saved_reports
             WHERE id = $1 AND organization_id = $2`,
            [widgetConfig.reportId, organizationId],
            organizationId
          );

          if (reportResult.rows.length > 0) {
            const reportConfig = reportResult.rows[0].config;
            data = await queryBuilderService.executeReport(reportConfig, organizationId);
          }
        } else if (widgetConfig.reportConfig) {
          // Execute ad-hoc report config
          data = await queryBuilderService.executeReport(widgetConfig.reportConfig, organizationId);
        }
        break;

      case 'recent_items':
        // Execute recent items query
        data = await executeRecentItemsWidget(widgetConfig, organizationId);
        break;

      case 'report':
        // Execute embedded report
        if (widgetConfig.reportId) {
          const reportResult = await db.query(
            `SELECT config FROM saved_reports
             WHERE id = $1 AND organization_id = $2`,
            [widgetConfig.reportId, organizationId],
            organizationId
          );

          if (reportResult.rows.length > 0) {
            const reportConfig = reportResult.rows[0].config;
            data = await queryBuilderService.executeReport(reportConfig, organizationId);
          }
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: `Unsupported widget type: ${widgetConfig.type}`
        });
    }

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('Error executing widget:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute widget',
      message: error.message
    });
  }
};

/**
 * Execute KPI widget
 * Calculates a single metric based on config
 */
const executeKPIWidget = async (widgetConfig, organizationId) => {
  const { dataSource, metric, filters = [] } = widgetConfig;

  // Build a simple aggregation query
  const config = {
    dataSource: dataSource || 'leads',
    fields: [metric || 'COUNT(*)'],
    filters: filters,
    limit: 1
  };

  const result = await queryBuilderService.executeReport(config, organizationId);

  if (result && result.length > 0) {
    const firstKey = Object.keys(result[0])[0];
    return {
      value: result[0][firstKey],
      label: widgetConfig.label || metric
    };
  }

  return { value: 0, label: widgetConfig.label || metric };
};

/**
 * Execute Recent Items widget
 * Returns recent records from a data source
 */
const executeRecentItemsWidget = async (widgetConfig, organizationId) => {
  const { dataSource, limit = 5, filters = [] } = widgetConfig;

  const config = {
    dataSource: dataSource || 'leads',
    fields: ['*'],
    filters: filters,
    orderBy: [{ field: 'created_at', direction: 'desc' }],
    limit: limit
  };

  return await queryBuilderService.executeReport(config, organizationId);
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // CRUD
  getSavedDashboards,
  getSavedDashboard,
  createSavedDashboard,
  updateSavedDashboard,
  deleteSavedDashboard,
  setDefaultDashboard,

  // Widget execution
  executeWidget
};
