const db = require('../database/connection');

/**
 * Reporting Service
 * Handles all analytics and reporting calculations for the B2C CRM
 *
 * Business Model: Lead → Contact → Account → Transaction
 * - Leads: Prospects
 * - Contacts: Customers
 * - Accounts: Software licenses (one per device/MAC address)
 * - Transactions: Payment records
 */

/**
 * Get total revenue (all time)
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Total revenue
 */
const getTotalRevenue = async (organizationId) => {
  const result = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as total_revenue
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'`,
    [organizationId],
    organizationId
  );

  return parseFloat(result.rows[0].total_revenue) || 0;
};

/**
 * Get revenue for current month
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Revenue this month
 */
const getRevenueThisMonth = async (organizationId) => {
  const result = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as monthly_revenue
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
       AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)`,
    [organizationId],
    organizationId
  );

  return parseFloat(result.rows[0].monthly_revenue) || 0;
};

/**
 * Get revenue for last month
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Revenue last month
 */
const getRevenueLastMonth = async (organizationId) => {
  const result = await db.query(
    `SELECT COALESCE(SUM(amount), 0) as monthly_revenue
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
       AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
    [organizationId],
    organizationId
  );

  return parseFloat(result.rows[0].monthly_revenue) || 0;
};

/**
 * Get revenue by product
 * @param {string} organizationId - Organization ID
 * @param {Date} startDate - Optional start date filter
 * @param {Date} endDate - Optional end date filter
 * @returns {Promise<Array>} Revenue breakdown by product
 */
const getRevenueByProduct = async (organizationId, startDate = null, endDate = null) => {
  let query = `
    SELECT
      COALESCE(p.name, se.name, 'Unknown') as product_name,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(t.amount), 0) as total_revenue
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN products p ON a.product_id = p.id
    LEFT JOIN software_editions se ON a.product_id = se.id
    WHERE t.organization_id = $1
      AND t.deleted_at IS NULL
      AND t.is_void = FALSE
      AND t.status = 'completed'
  `;

  const params = [organizationId];

  if (startDate) {
    params.push(startDate);
    query += ` AND t.transaction_date >= $${params.length}`;
  }

  if (endDate) {
    params.push(endDate);
    query += ` AND t.transaction_date <= $${params.length}`;
  }

  query += `
    GROUP BY COALESCE(p.name, se.name, 'Unknown')
    ORDER BY total_revenue DESC
  `;

  const result = await db.query(query, params, organizationId);

  return result.rows.map(row => ({
    name: row.product_name,
    transactionCount: parseInt(row.transaction_count),
    revenue: parseFloat(row.total_revenue)
  }));
};

/**
 * Get revenue by payment method
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Revenue breakdown by payment method
 */
const getRevenueByPaymentMethod = async (organizationId) => {
  const result = await db.query(
    `SELECT
      COALESCE(payment_method, 'Not Specified') as payment_method,
      COUNT(id) as transaction_count,
      SUM(amount) as total_revenue
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
     GROUP BY payment_method
     ORDER BY total_revenue DESC`,
    [organizationId],
    organizationId
  );

  return result.rows.map(row => ({
    name: row.payment_method,
    transactionCount: parseInt(row.transaction_count),
    revenue: parseFloat(row.total_revenue)
  }));
};

/**
 * Get monthly revenue trend
 * @param {string} organizationId - Organization ID
 * @param {number} months - Number of months to include (default 12)
 * @returns {Promise<Array>} Monthly revenue data
 */
const getMonthlyRevenueTrend = async (organizationId, months = 12) => {
  const result = await db.query(
    `SELECT
      DATE_TRUNC('month', transaction_date) as month,
      COUNT(*) as transaction_count,
      SUM(amount) as revenue
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
       AND transaction_date >= CURRENT_DATE - INTERVAL '${months} months'
     GROUP BY DATE_TRUNC('month', transaction_date)
     ORDER BY month ASC`,
    [organizationId],
    organizationId
  );

  return result.rows.map(row => ({
    month: row.month,
    transactionCount: parseInt(row.transaction_count),
    revenue: parseFloat(row.revenue)
  }));
};

/**
 * Get active accounts count
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Active accounts count
 */
const getActiveAccountsCount = async (organizationId) => {
  const result = await db.query(
    `SELECT COUNT(*) as active_accounts
     FROM accounts
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND license_status = 'active'`,
    [organizationId],
    organizationId
  );

  return parseInt(result.rows[0].active_accounts) || 0;
};

/**
 * Get upcoming renewals count
 * @param {string} organizationId - Organization ID
 * @param {number} days - Number of days to look ahead (default 30)
 * @returns {Promise<number>} Upcoming renewals count
 */
const getUpcomingRenewals = async (organizationId, days = 30) => {
  const result = await db.query(
    `SELECT COUNT(*) as upcoming_renewals
     FROM accounts
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND license_status = 'active'
       AND next_renewal_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '${days} days'`,
    [organizationId],
    organizationId
  );

  return parseInt(result.rows[0].upcoming_renewals) || 0;
};

/**
 * Get average transaction value
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Average transaction value
 */
const getAverageTransactionValue = async (organizationId) => {
  const result = await db.query(
    `SELECT ROUND(AVG(amount), 2) as avg_transaction_value
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'`,
    [organizationId],
    organizationId
  );

  return parseFloat(result.rows[0].avg_transaction_value) || 0;
};

/**
 * Get new customers count for current month
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} New customers this month
 */
const getNewCustomersThisMonth = async (organizationId) => {
  const result = await db.query(
    `SELECT COUNT(*) as new_customers
     FROM contacts
     WHERE organization_id = $1
       AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
    [organizationId],
    organizationId
  );

  return parseInt(result.rows[0].new_customers) || 0;
};

/**
 * Get new customers trend by month
 * @param {string} organizationId - Organization ID
 * @param {number} months - Number of months to include (default 6)
 * @returns {Promise<Array>} Monthly new customers data
 */
const getNewCustomersTrend = async (organizationId, months = 6) => {
  const result = await db.query(
    `SELECT
      DATE_TRUNC('month', created_at) as month,
      COUNT(*) as new_customers
     FROM contacts
     WHERE organization_id = $1
       AND created_at >= CURRENT_DATE - INTERVAL '${months} months'
     GROUP BY DATE_TRUNC('month', created_at)
     ORDER BY month ASC`,
    [organizationId],
    organizationId
  );

  return result.rows.map(row => ({
    month: row.month,
    newCustomers: parseInt(row.new_customers)
  }));
};

/**
 * Get comprehensive dashboard KPIs
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} All dashboard KPIs
 */
const getDashboardKPIs = async (organizationId) => {
  // Execute all queries in parallel for better performance
  const [
    totalRevenue,
    revenueThisMonth,
    revenueLastMonth,
    activeAccounts,
    upcomingRenewals,
    avgTransactionValue,
    newCustomersThisMonth
  ] = await Promise.all([
    getTotalRevenue(organizationId),
    getRevenueThisMonth(organizationId),
    getRevenueLastMonth(organizationId),
    getActiveAccountsCount(organizationId),
    getUpcomingRenewals(organizationId, 30),
    getAverageTransactionValue(organizationId),
    getNewCustomersThisMonth(organizationId)
  ]);

  // Calculate month-over-month growth
  const revenueGrowth = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100).toFixed(1)
    : revenueThisMonth > 0 ? 100 : 0;

  return {
    totalRevenue,
    revenueThisMonth,
    revenueLastMonth,
    revenueGrowth: parseFloat(revenueGrowth),
    activeAccounts,
    upcomingRenewals,
    avgTransactionValue,
    newCustomersThisMonth
  };
};

/**
 * Get accounts breakdown by product
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} Accounts by product
 */
const getAccountsByProduct = async (organizationId) => {
  const result = await db.query(
    `SELECT
      COALESCE(p.name, se.name, 'Unknown') as product_name,
      COUNT(a.id) as account_count
     FROM accounts a
     LEFT JOIN products p ON a.product_id = p.id
     LEFT JOIN software_editions se ON a.product_id = se.id
     WHERE a.organization_id = $1
       AND a.deleted_at IS NULL
       AND a.license_status = 'active'
     GROUP BY COALESCE(p.name, se.name, 'Unknown')
     ORDER BY account_count DESC`,
    [organizationId],
    organizationId
  );

  return result.rows.map(row => ({
    name: row.product_name,
    count: parseInt(row.account_count)
  }));
};

module.exports = {
  getTotalRevenue,
  getRevenueThisMonth,
  getRevenueLastMonth,
  getRevenueByProduct,
  getRevenueByPaymentMethod,
  getMonthlyRevenueTrend,
  getActiveAccountsCount,
  getUpcomingRenewals,
  getAverageTransactionValue,
  getNewCustomersThisMonth,
  getNewCustomersTrend,
  getDashboardKPIs,
  getAccountsByProduct
};
