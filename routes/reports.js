const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// ============================================
// METADATA ENDPOINTS
// ============================================

/**
 * Get all available data sources
 * @route GET /api/reports/metadata/sources
 * @access Private
 */
router.get('/metadata/sources', reportsController.getDataSources);

/**
 * Get fields for a specific data source
 * @route GET /api/reports/metadata/fields/:dataSource
 * @access Private
 */
router.get('/metadata/fields/:dataSource', reportsController.getFieldsForDataSource);

/**
 * Get operators for a field type
 * @route GET /api/reports/metadata/operators/:fieldType
 * @access Private
 */
router.get('/metadata/operators/:fieldType', reportsController.getOperatorsForFieldType);

// ============================================
// REPORT EXECUTION
// ============================================

/**
 * Execute a report (dynamic query)
 * @route POST /api/reports/execute
 * @access Private
 * @body { dataSource, fields, filters, groupBy, orderBy, limit, chartType }
 */
router.post('/execute', reportsController.executeReport);

// ============================================
// SAVED REPORTS CRUD
// ============================================

/**
 * Get all saved reports for current user
 * @route GET /api/reports/saved
 * @query ?favorite=true - Filter by favorites
 * @access Private
 */
router.get('/saved', reportsController.getSavedReports);

/**
 * Get a single saved report
 * @route GET /api/reports/saved/:id
 * @access Private
 */
router.get('/saved/:id', reportsController.getSavedReport);

/**
 * Create a new saved report
 * @route POST /api/reports/saved
 * @access Private
 * @body { name, description, config, is_favorite }
 */
router.post('/saved', reportsController.createSavedReport);

/**
 * Update a saved report
 * @route PUT /api/reports/saved/:id
 * @access Private
 * @body { name, description, config, is_favorite }
 */
router.put('/saved/:id', reportsController.updateSavedReport);

/**
 * Delete a saved report
 * @route DELETE /api/reports/saved/:id
 * @access Private
 */
router.delete('/saved/:id', reportsController.deleteSavedReport);

/**
 * Toggle favorite status of a report
 * @route POST /api/reports/saved/:id/favorite
 * @access Private
 */
router.post('/saved/:id/favorite', reportsController.toggleFavorite);

// ============================================
// EXPORT
// ============================================

/**
 * Export report to CSV
 * @route POST /api/reports/export/csv
 * @access Private
 * @body { dataSource, fields, filters, groupBy, orderBy, limit, reportName }
 */
router.post('/export/csv', reportsController.exportReportCSV);

module.exports = router;
