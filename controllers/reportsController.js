const db = require('../database/connection');
const queryBuilderService = require('../services/queryBuilderService');
const csvExportService = require('../services/csvExportService');

/**
 * Reports Controller
 * Handles all custom reports endpoints including execution, CRUD, and metadata
 */

// ============================================
// METADATA ENDPOINTS
// ============================================

/**
 * Get all available data sources
 * GET /api/reports/metadata/sources
 */
const getDataSources = async (req, res) => {
  try {
    const dataSources = queryBuilderService.getDataSources();

    res.json({
      success: true,
      data: dataSources
    });
  } catch (error) {
    console.error('Error fetching data sources:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch data sources',
      message: error.message
    });
  }
};

/**
 * Get fields for a specific data source
 * GET /api/reports/metadata/fields/:dataSource
 */
const getFieldsForDataSource = async (req, res) => {
  try {
    const { dataSource } = req.params;

    const fields = queryBuilderService.getFieldsForDataSource(dataSource);

    // Group fields by category for better UX
    const categorized = {
      identification: [],
      demographic: [],
      activity: [],
      financial: [],
      dates: []
    };

    fields.forEach(field => {
      if (field.name.includes('id')) {
        categorized.identification.push(field);
      } else if (field.type === 'date') {
        categorized.dates.push(field);
      } else if (field.type === 'number' || field.name.includes('amount') || field.name.includes('value')) {
        categorized.financial.push(field);
      } else if (field.name.includes('status') || field.name.includes('priority') || field.name.includes('source')) {
        categorized.activity.push(field);
      } else {
        categorized.demographic.push(field);
      }
    });

    res.json({
      success: true,
      data: {
        all: fields,
        categorized
      }
    });
  } catch (error) {
    console.error('Error fetching fields:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to fetch fields',
      message: error.message
    });
  }
};

/**
 * Get operators for a field type
 * GET /api/reports/metadata/operators/:fieldType
 */
const getOperatorsForFieldType = async (req, res) => {
  try {
    const { fieldType } = req.params;

    const operators = queryBuilderService.getOperatorsForFieldType(fieldType);

    res.json({
      success: true,
      data: operators
    });
  } catch (error) {
    console.error('Error fetching operators:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to fetch operators',
      message: error.message
    });
  }
};

// ============================================
// REPORT EXECUTION
// ============================================

/**
 * Execute a report (with or without saving)
 * POST /api/reports/execute
 */
const executeReport = async (req, res) => {
  try {
    const config = req.body;
    const organizationId = req.user.organization_id;

    // Validate config
    const validation = queryBuilderService.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report configuration',
        details: validation.errors
      });
    }

    // Execute report
    const results = await queryBuilderService.executeReport(config, organizationId);

    res.json({
      success: true,
      data: results,
      rowCount: results.length,
      config: config
    });
  } catch (error) {
    console.error('Error executing report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to execute report',
      message: error.message
    });
  }
};

// ============================================
// SAVED REPORTS CRUD
// ============================================

/**
 * Get all saved reports for the current user
 * GET /api/reports/saved
 */
const getSavedReports = async (req, res) => {
  try {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;
    const { favorite } = req.query;

    let query = `
      SELECT
        id,
        name,
        description,
        config,
        is_favorite,
        last_run_at,
        run_count,
        created_at,
        updated_at
      FROM saved_reports
      WHERE user_id = $1 AND organization_id = $2
    `;

    const params = [userId, organizationId];

    // Filter by favorite if requested
    if (favorite === 'true') {
      query += ` AND is_favorite = true`;
    }

    query += ` ORDER BY updated_at DESC`;

    const result = await db.query(query, params, organizationId);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching saved reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved reports',
      message: error.message
    });
  }
};

/**
 * Get a single saved report
 * GET /api/reports/saved/:id
 */
const getSavedReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const result = await db.query(
      `SELECT * FROM saved_reports
       WHERE id = $1 AND user_id = $2 AND organization_id = $3`,
      [id, userId, organizationId],
      organizationId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching saved report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch saved report',
      message: error.message
    });
  }
};

/**
 * Create a new saved report
 * POST /api/reports/saved
 */
const createSavedReport = async (req, res) => {
  try {
    const { name, description, config, is_favorite = false } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Validate required fields
    if (!name || !config) {
      return res.status(400).json({
        success: false,
        error: 'Name and config are required'
      });
    }

    // Validate config
    const validation = queryBuilderService.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report configuration',
        details: validation.errors
      });
    }

    // Insert report
    const result = await db.query(
      `INSERT INTO saved_reports
       (organization_id, user_id, name, description, config, is_favorite, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [organizationId, userId, name, description, JSON.stringify(config), is_favorite],
      organizationId
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Report created successfully'
    });
  } catch (error) {
    console.error('Error creating saved report:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A report with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create saved report',
      message: error.message
    });
  }
};

/**
 * Update a saved report
 * PUT /api/reports/saved/:id
 */
const updateSavedReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, config, is_favorite } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Validate config if provided
    if (config) {
      const validation = queryBuilderService.validateConfig(config);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid report configuration',
          details: validation.errors
        });
      }
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
    if (config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      params.push(JSON.stringify(config));
    }
    if (is_favorite !== undefined) {
      updates.push(`is_favorite = $${paramIndex++}`);
      params.push(is_favorite);
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
      UPDATE saved_reports
      SET ${updates.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND organization_id = $${paramIndex + 2}
      RETURNING *
    `;

    const result = await db.query(query, params, organizationId);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Report updated successfully'
    });
  } catch (error) {
    console.error('Error updating saved report:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'A report with this name already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to update saved report',
      message: error.message
    });
  }
};

/**
 * Delete a saved report
 * DELETE /api/reports/saved/:id
 */
const deleteSavedReport = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const result = await db.query(
      `DELETE FROM saved_reports
       WHERE id = $1 AND user_id = $2 AND organization_id = $3
       RETURNING id, name`,
      [id, userId, organizationId],
      organizationId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      message: 'Report deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting saved report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete saved report',
      message: error.message
    });
  }
};

/**
 * Toggle favorite status
 * POST /api/reports/saved/:id/favorite
 */
const toggleFavorite = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const result = await db.query(
      `UPDATE saved_reports
       SET is_favorite = NOT is_favorite, updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND organization_id = $3
       RETURNING *`,
      [id, userId, organizationId],
      organizationId
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: `Report ${result.rows[0].is_favorite ? 'added to' : 'removed from'} favorites`
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle favorite',
      message: error.message
    });
  }
};

/**
 * Update last run timestamp and increment run count
 */
const updateReportRunStats = async (reportId, organizationId) => {
  try {
    await db.query(
      `UPDATE saved_reports
       SET last_run_at = NOW(), run_count = run_count + 1
       WHERE id = $1`,
      [reportId],
      organizationId
    );
  } catch (error) {
    console.error('Error updating report run stats:', error);
    // Don't fail the request if this fails
  }
};

// ============================================
// CSV EXPORT
// ============================================

/**
 * Export report to CSV
 * POST /api/reports/export/csv
 */
const exportReportCSV = async (req, res) => {
  try {
    const config = req.body;
    const organizationId = req.user.organization_id;

    // Validate config
    const validation = queryBuilderService.validateConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid report configuration',
        details: validation.errors
      });
    }

    // Execute report to get data
    const results = await queryBuilderService.executeReport(config, organizationId);

    if (!results || results.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No data to export',
        message: 'The report returned no results'
      });
    }

    // Get field metadata for proper column headers
    const fieldNames = config.fields || Object.keys(results[0]);
    const fields = fieldNames.map(fieldName => {
      const dataSource = queryBuilderService.DATA_SOURCES[config.dataSource];
      const fieldMeta = dataSource?.fields?.[fieldName];

      return {
        name: fieldName,
        label: fieldMeta?.label || fieldName
      };
    });

    // Format data for export
    const formattedData = csvExportService.formatDataForExport(results);

    // Convert to CSV
    const csv = csvExportService.exportToCSV(formattedData, fields);

    // Generate filename
    const filename = csvExportService.generateFilename(config.reportName || 'report');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', Buffer.byteLength(csv, 'utf8'));

    // Send CSV
    res.send(csv);

    // Update run stats if this is a saved report
    if (config.reportId) {
      updateReportRunStats(config.reportId, organizationId);
    }
  } catch (error) {
    console.error('Error exporting report to CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export report',
      message: error.message
    });
  }
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Metadata
  getDataSources,
  getFieldsForDataSource,
  getOperatorsForFieldType,

  // Execution
  executeReport,

  // CRUD
  getSavedReports,
  getSavedReport,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport,
  toggleFavorite,

  // Export
  exportReportCSV
};
