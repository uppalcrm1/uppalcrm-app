const express = require('express');
const router = express.Router();
const reportingController = require('../controllers/reportingController');

/**
 * Reporting Routes
 * All routes require authentication (handled by middleware in server.js)
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

module.exports = router;
