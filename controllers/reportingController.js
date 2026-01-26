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

/**
 * GET /api/reporting/standard-reports/transactions-by-source
 * Get transactions grouped by source for a given month
 * Query params: year, month (defaults to current year/month)
 */
const getTransactionsBySource = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    // Validate year and month
    if (year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter. Must be between 2000 and 2100.'
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month parameter. Must be between 1 and 12.'
      });
    }

    const result = await reportingService.getTransactionsBySource(organizationId, year, month);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching transactions by source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions by source',
      message: error.message
    });
  }
};

/**
 * GET /api/reporting/standard-reports/transactions-revenue-by-source
 * Get transactions revenue grouped by source for a given month
 * Query params: year, month (defaults to current year/month)
 */
const getTransactionRevenueBySource = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    // Validate year and month
    if (year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter. Must be between 2000 and 2100.'
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month parameter. Must be between 1 and 12.'
      });
    }

    const result = await reportingService.getTransactionRevenueBySource(organizationId, year, month);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching transactions revenue by source:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions revenue by source',
      message: error.message
    });
  }
};

/**
 * GET /api/reporting/standard-reports/transactions-count-by-owner
 * Get transaction count grouped by lead owner at time of conversion
 * Query params: year, month (defaults to current year/month)
 */
const getTransactionCountByOwner = async (req, res) => {
  try {
    const organizationId = req.user.organization_id;
    const now = new Date();
    const year = parseInt(req.query.year) || now.getFullYear();
    const month = parseInt(req.query.month) || (now.getMonth() + 1);

    // Validate year and month
    if (year < 2000 || year > 2100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid year parameter. Must be between 2000 and 2100.'
      });
    }

    if (month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: 'Invalid month parameter. Must be between 1 and 12.'
      });
    }

    const result = await reportingService.getTransactionCountByOwner(organizationId, year, month);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error fetching transactions count by owner:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions count by owner',
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
  getAccountsByProduct,
  getTransactionsBySource,
  getTransactionRevenueBySource,
  getTransactionCountByOwner
};
