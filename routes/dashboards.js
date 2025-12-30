const express = require('express');
const router = express.Router();
const dashboardsController = require('../controllers/dashboardsController');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// ============================================
// SAVED DASHBOARDS CRUD
// ============================================

/**
 * Get all saved dashboards for current user
 * @route GET /api/dashboards/saved
 * @access Private
 */
router.get('/saved', dashboardsController.getSavedDashboards);

/**
 * Get a single saved dashboard
 * @route GET /api/dashboards/saved/:id
 * @access Private
 */
router.get('/saved/:id', dashboardsController.getSavedDashboard);

/**
 * Create a new saved dashboard
 * @route POST /api/dashboards/saved
 * @access Private
 * @body { name, description, layout, is_default }
 */
router.post('/saved', dashboardsController.createSavedDashboard);

/**
 * Update a saved dashboard
 * @route PUT /api/dashboards/saved/:id
 * @access Private
 * @body { name, description, layout, is_default }
 */
router.put('/saved/:id', dashboardsController.updateSavedDashboard);

/**
 * Delete a saved dashboard
 * @route DELETE /api/dashboards/saved/:id
 * @access Private
 */
router.delete('/saved/:id', dashboardsController.deleteSavedDashboard);

/**
 * Set a dashboard as default
 * @route POST /api/dashboards/saved/:id/set-default
 * @access Private
 */
router.post('/saved/:id/set-default', dashboardsController.setDefaultDashboard);

// ============================================
// WIDGET EXECUTION
// ============================================

/**
 * Execute a widget (run the widget's data query)
 * @route POST /api/dashboards/widgets/execute
 * @access Private
 * @body { widgetConfig }
 */
router.post('/widgets/execute', dashboardsController.executeWidget);

module.exports = router;
