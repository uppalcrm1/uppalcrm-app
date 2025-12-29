const reportingService = require('../services/reportingService');

/**
 * Reporting Controller
 * Handles HTTP requests for analytics and reporting endpoints
 */

/**
 * GET /api/reporting/dashboard/kpis
 * Get all dashboard KPIs in a single request
 */
const getDashboardKPIs = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const kpis = await reportingService.getDashboardKPIs(organizationId);

    res.json({
      success: true,
      data: kpis
    });

  } catch (error) {
    console.error('Error fetching dashboard KPIs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard KPIs',
      message: error.message
    });
  }
};

/**
 * GET /api/reporting/dashboard/revenue-trend
 * Get monthly revenue trend
 * Query params: months (default 12)
 */
const getRevenueTrend = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const months = parseInt(req.query.months) || 12;

    // Validate months parameter
    if (months < 1 || months > 24) {
      return res.status(400).json({
        success: false,
        error: 'Invalid months parameter. Must be between 1 and 24.'
      });
    }

    const trend = await reportingService.getMonthlyRevenueTrend(organizationId, months);

    res.json({
      success: true,
      data: trend
    });

  } catch (error) {
    console.error('Error fetching revenue trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue trend',
      message: error.message
    });
  }
};

/**
 * GET /api/reporting/dashboard/revenue-by-product
 * Get revenue breakdown by product
 * Query params: startDate, endDate (optional)
 */
const getRevenueByProduct = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const { startDate, endDate } = req.query;

    const revenueByProduct = await reportingService.getRevenueByProduct(
      organizationId,
      startDate || null,
      endDate || null
    );

    res.json({
      success: true,
      data: revenueByProduct
    });

  } catch (error) {
    console.error('Error fetching revenue by product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch revenue by product',
      message: error.message
    });
  }
};

/**
 * GET /api/reporting/dashboard/payment-methods
 * Get revenue breakdown by payment method
 */
const getPaymentMethods = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const paymentMethods = await reportingService.getRevenueByPaymentMethod(organizationId);

    res.json({
      success: true,
      data: paymentMethods
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment methods',
      message: error.message
    });
  }
};

/**
 * GET /api/reporting/dashboard/new-customers
 * Get new customers trend
 * Query params: months (default 6)
 */
const getNewCustomersTrend = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const months = parseInt(req.query.months) || 6;

    // Validate months parameter
    if (months < 1 || months > 24) {
      return res.status(400).json({
        success: false,
        error: 'Invalid months parameter. Must be between 1 and 24.'
      });
    }

    const trend = await reportingService.getNewCustomersTrend(organizationId, months);

    res.json({
      success: true,
      data: trend
    });

  } catch (error) {
    console.error('Error fetching new customers trend:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch new customers trend',
      message: error.message
    });
  }
};

/**
 * GET /api/reporting/dashboard/accounts-by-product
 * Get accounts breakdown by product
 */
const getAccountsByProduct = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;

    const accountsByProduct = await reportingService.getAccountsByProduct(organizationId);

    res.json({
      success: true,
      data: accountsByProduct
    });

  } catch (error) {
    console.error('Error fetching accounts by product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts by product',
      message: error.message
    });
  }
};

module.exports = {
  getDashboardKPIs,
  getRevenueTrend,
  getRevenueByProduct,
  getPaymentMethods,
  getNewCustomersTrend,
  getAccountsByProduct
};
