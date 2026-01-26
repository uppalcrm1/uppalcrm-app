const express = require('express');
const router = express.Router();
const reportingController = require('../controllers/reportingController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Reporting Routes
 * All routes require authentication
 */

/**
 * Dashboard Endpoints
 */

// GET /api/reporting/dashboard/kpis - Get all dashboard KPIs
router.get('/dashboard/kpis', reportingController.getDashboardKPIs);

// GET /api/reporting/dashboard/revenue-trend - Get monthly revenue trend
router.get('/dashboard/revenue-trend', reportingController.getRevenueTrend);

// GET /api/reporting/dashboard/revenue-by-product - Get revenue by product
router.get('/dashboard/revenue-by-product', reportingController.getRevenueByProduct);

// GET /api/reporting/dashboard/payment-methods - Get payment methods breakdown
router.get('/dashboard/payment-methods', reportingController.getPaymentMethods);

// GET /api/reporting/dashboard/new-customers - Get new customers trend
router.get('/dashboard/new-customers', reportingController.getNewCustomersTrend);

// GET /api/reporting/dashboard/accounts-by-product - Get accounts by product
router.get('/dashboard/accounts-by-product', reportingController.getAccountsByProduct);

/**
 * Standard Reports Endpoints
 */

// GET /api/reporting/standard-reports/transactions-by-source - Get transactions grouped by source
router.get('/standard-reports/transactions-by-source', reportingController.getTransactionsBySource);

// GET /api/reporting/standard-reports/transactions-revenue-by-source - Get transactions revenue grouped by source
router.get('/standard-reports/transactions-revenue-by-source', reportingController.getTransactionRevenueBySource);

// GET /api/reporting/standard-reports/transactions-count-by-owner - Get transaction count grouped by lead owner
router.get('/standard-reports/transactions-count-by-owner', reportingController.getTransactionCountByOwner);

module.exports = router;
