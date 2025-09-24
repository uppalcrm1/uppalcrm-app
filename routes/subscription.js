const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { authenticateToken } = require('../middleware/auth');
const {
  requireActiveSubscription,
  addSubscriptionContext,
  trackApiUsage
} = require('../middleware/subscriptionMiddleware');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Add subscription context to all requests
router.use(addSubscriptionContext);

// Track API usage for rate limiting
router.use(trackApiUsage);

// Subscription Management Routes

// GET /api/subscription - Get organization's subscription details
router.get('/', subscriptionController.getOrganizationSubscription);

// GET /api/subscription/plans - Get available subscription plans
router.get('/plans', subscriptionController.getSubscriptionPlans);

// POST /api/subscription - Create or update subscription
router.post('/', subscriptionController.createOrUpdateSubscription);

// DELETE /api/subscription - Cancel subscription
router.delete('/', requireActiveSubscription, subscriptionController.cancelSubscription);

// Usage and Limits Routes

// POST /api/subscription/check-limits - Check if organization can add more resources
router.post('/check-limits', requireActiveSubscription, subscriptionController.checkUsageLimits);

// GET /api/subscription/feature/:feature_key - Check feature access
router.get('/feature/:feature_key', requireActiveSubscription, subscriptionController.checkFeatureAccess);

// Usage Tracking Routes

// POST /api/subscription/usage - Record usage for billing period
router.post('/usage', requireActiveSubscription, subscriptionController.recordUsage);

// GET /api/subscription/usage/history - Get usage history
router.get('/usage/history', requireActiveSubscription, subscriptionController.getUsageHistory);

// Billing Routes

// GET /api/subscription/billing/preview - Preview next billing cycle
router.get('/billing/preview', requireActiveSubscription, subscriptionController.previewBilling);

// Audit and Events Routes

// GET /api/subscription/events - Get subscription events/audit trail
router.get('/events', requireActiveSubscription, subscriptionController.getSubscriptionEvents);

module.exports = router;