const db = require('../database/connection');
const ConfigService = require('./ConfigService');
const CurrencyHelper = require('../utils/currency');

/**
 * Reporting Service
 * Handles all analytics and reporting calculations for the B2C CRM
 *
 * Business Model: Lead → Contact → Account → Transaction
 * - Leads: Prospects
 * - Contacts: Customers
 * - Accounts: Software licenses (one per device/MAC address)
 * - Transactions: Payment records
 * 
 * NOTE: All revenue values are converted to CAD for consistency
 */

/**
 * Get total revenue (all time) - converted to CAD
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Total revenue in CAD
 */
const getTotalRevenue = async (organizationId) => {
  const result = await db.query(
    `SELECT amount, currency
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'`,
    [organizationId],
    organizationId
  );

  const exchangeRate = await ConfigService.getExchangeRate(organizationId);
  let totalInCAD = 0;

  result.rows.forEach(row => {
    const amount = parseFloat(row.amount);
    const currency = row.currency || 'CAD';
    
    if (currency === 'CAD') {
      totalInCAD += amount;
    } else if (currency === 'USD') {
      totalInCAD += CurrencyHelper.toCAD(amount, 'USD', exchangeRate);
    }
  });

  return parseFloat(totalInCAD.toFixed(2));
};

/**
 * Get revenue for current month - converted to CAD
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Revenue this month in CAD
 */
const getRevenueThisMonth = async (organizationId) => {
  const result = await db.query(
    `SELECT amount, currency
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
       AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE)`,
    [organizationId],
    organizationId
  );

  const exchangeRate = await ConfigService.getExchangeRate(organizationId);
  let totalInCAD = 0;

  result.rows.forEach(row => {
    const amount = parseFloat(row.amount);
    const currency = row.currency || 'CAD';
    
    if (currency === 'CAD') {
      totalInCAD += amount;
    } else if (currency === 'USD') {
      totalInCAD += CurrencyHelper.toCAD(amount, 'USD', exchangeRate);
    }
  });

  return parseFloat(totalInCAD.toFixed(2));
};

/**
 * Get revenue for last month - converted to CAD
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Revenue last month in CAD
 */
const getRevenueLastMonth = async (organizationId) => {
  const result = await db.query(
    `SELECT amount, currency
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
       AND DATE_TRUNC('month', transaction_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')`,
    [organizationId],
    organizationId
  );

  const exchangeRate = await ConfigService.getExchangeRate(organizationId);
  let totalInCAD = 0;

  result.rows.forEach(row => {
    const amount = parseFloat(row.amount);
    const currency = row.currency || 'CAD';
    
    if (currency === 'CAD') {
      totalInCAD += amount;
    } else if (currency === 'USD') {
      totalInCAD += CurrencyHelper.toCAD(amount, 'USD', exchangeRate);
    }
  });

  return parseFloat(totalInCAD.toFixed(2));
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
      COALESCE(p.name, a.edition, 'Unknown') as product_name,
      COUNT(t.id) as transaction_count,
      COALESCE(SUM(t.amount), 0) as total_revenue
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN products p ON a.product_id = p.id
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
    GROUP BY COALESCE(p.name, a.edition, 'Unknown')
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
 * Get average transaction value - converted to CAD
 * @param {string} organizationId - Organization ID
 * @returns {Promise<number>} Average transaction value in CAD
 */
const getAverageTransactionValue = async (organizationId) => {
  const result = await db.query(
    `SELECT amount, currency
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'`,
    [organizationId],
    organizationId
  );

  if (result.rows.length === 0) return 0;

  const exchangeRate = await ConfigService.getExchangeRate(organizationId);
  let totalInCAD = 0;

  result.rows.forEach(row => {
    const amount = parseFloat(row.amount);
    const currency = row.currency || 'CAD';
    
    if (currency === 'CAD') {
      totalInCAD += amount;
    } else if (currency === 'USD') {
      totalInCAD += CurrencyHelper.toCAD(amount, 'USD', exchangeRate);
    }
  });

  const average = totalInCAD / result.rows.length;
  return parseFloat(average.toFixed(2));
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
      COALESCE(p.name, a.edition, 'Unknown') as product_name,
      COUNT(a.id) as account_count
     FROM accounts a
     LEFT JOIN products p ON a.product_id = p.id
     WHERE a.organization_id = $1
       AND a.deleted_at IS NULL
       AND a.license_status = 'active'
     GROUP BY COALESCE(p.name, a.edition, 'Unknown')
     ORDER BY account_count DESC`,
    [organizationId],
    organizationId
  );

  return result.rows.map(row => ({
    name: row.product_name,
    count: parseInt(row.account_count)
  }));
};

/**
 * Get transactions grouped by source for a given month
 * @param {string} organizationId - Organization ID
 * @param {number} year - Year (e.g., 2024)
 * @param {number} month - Month (1-12)
 * @returns {Promise<Object>} Transactions by source with summary
 */
const getTransactionsBySource = async (organizationId, year, month) => {
  // Validate month
  if (month < 1 || month > 12) {
    throw new Error('Invalid month. Must be between 1 and 12.');
  }

  // Create date range for the given month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const result = await db.query(
    `SELECT
      COALESCE(source, 'Not Specified') as source,
      COUNT(id) as transaction_count,
      ROUND(SUM(amount)::numeric, 2) as total_amount
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
       AND transaction_date >= $2
       AND transaction_date <= $3
     GROUP BY source
     ORDER BY transaction_count DESC`,
    [organizationId, startDate, endDate],
    organizationId
  );

  // Calculate total and percentages
  const rows = result.rows.map(row => ({
    source: row.source,
    count: parseInt(row.transaction_count),
    amount: parseFloat(row.total_amount || 0)
  }));

  const totalTransactions = rows.reduce((sum, row) => sum + row.count, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  // Add percentage to each row
  const dataWithPercentage = rows.map(row => ({
    ...row,
    percentage: totalTransactions > 0
      ? parseFloat(((row.count / totalTransactions) * 100).toFixed(2))
      : 0
  }));

  // Find top source
  const topSource = dataWithPercentage.length > 0 ? dataWithPercentage[0] : null;

  return {
    data: dataWithPercentage,
    summary: {
      totalTransactions,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      topSource: topSource ? topSource.source : null,
      topSourceCount: topSource ? topSource.count : 0,
      month,
      year
    }
  };
};

/**
 * Get transactions revenue grouped by source for a given month
 * @param {string} organizationId - Organization ID
 * @param {number} year - Year (e.g., 2024)
 * @param {number} month - Month (1-12)
 * @returns {Promise<Object>} Transaction revenue by source with summary
 */
const getTransactionRevenueBySource = async (organizationId, year, month) => {
  // Validate month
  if (month < 1 || month > 12) {
    throw new Error('Invalid month. Must be between 1 and 12.');
  }

  // Create date range for the given month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const result = await db.query(
    `SELECT
      COALESCE(source, 'Not Specified') as source,
      COUNT(id) as transaction_count,
      ROUND(SUM(amount)::numeric, 2) as total_amount
     FROM transactions
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND is_void = FALSE
       AND status = 'completed'
       AND transaction_date >= $2
       AND transaction_date <= $3
     GROUP BY source
     ORDER BY total_amount DESC`,
    [organizationId, startDate, endDate],
    organizationId
  );

  // Calculate total revenue and percentages
  const rows = result.rows.map(row => ({
    source: row.source,
    count: parseInt(row.transaction_count),
    amount: parseFloat(row.total_amount || 0)
  }));

  const totalTransactions = rows.reduce((sum, row) => sum + row.count, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  // Add percentage to each row (based on revenue, not count)
  const dataWithPercentage = rows.map(row => ({
    ...row,
    percentage: totalAmount > 0
      ? parseFloat(((row.amount / totalAmount) * 100).toFixed(2))
      : 0
  }));

  // Find top source by revenue
  const topSource = dataWithPercentage.length > 0 ? dataWithPercentage[0] : null;

  return {
    data: dataWithPercentage,
    summary: {
      totalTransactions,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      topSource: topSource ? topSource.source : null,
      topSourceAmount: topSource ? topSource.amount : 0,
      month,
      year
    }
  };
};

/**
 * Get transaction count grouped by lead owner at time of conversion
 * @param {string} organizationId - Organization ID
 * @param {number} year - Year (e.g., 2024)
 * @param {number} month - Month (1-12)
 * @returns {Promise<Object>} Transaction count by owner with summary
 */
const getTransactionCountByOwner = async (organizationId, year, month) => {
  // Validate month
  if (month < 1 || month > 12) {
    throw new Error('Invalid month. Must be between 1 and 12.');
  }

  // Create date range for the given month
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59, 999);

  const result = await db.query(
    `SELECT
      COALESCE(u.id::text, 'unknown') as owner_id,
      COALESCE(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), 'Unassigned') as owner_name,
      COUNT(t.id) as transaction_count,
      ROUND(SUM(t.amount)::numeric, 2) as total_amount
     FROM transactions t
     LEFT JOIN accounts a ON t.account_id = a.id
     LEFT JOIN contacts c ON a.contact_id = c.id
     LEFT JOIN leads l ON c.converted_from_lead_id = l.id
     LEFT JOIN users u ON l.assigned_to = u.id
     WHERE t.organization_id = $1
       AND t.deleted_at IS NULL
       AND t.is_void = FALSE
       AND t.status = 'completed'
       AND t.transaction_date >= $2
       AND t.transaction_date <= $3
     GROUP BY COALESCE(u.id::text, 'unknown'), COALESCE(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), 'Unassigned')
     ORDER BY transaction_count DESC`,
    [organizationId, startDate, endDate],
    organizationId
  );

  // Calculate totals and percentages
  const rows = result.rows.map(row => ({
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    count: parseInt(row.transaction_count),
    amount: parseFloat(row.total_amount || 0)
  }));

  const totalTransactions = rows.reduce((sum, row) => sum + row.count, 0);
  const totalAmount = rows.reduce((sum, row) => sum + row.amount, 0);

  // Add percentage to each row
  const dataWithPercentage = rows.map(row => ({
    ...row,
    percentage: totalTransactions > 0
      ? parseFloat(((row.count / totalTransactions) * 100).toFixed(2))
      : 0
  }));

  // Find top owner by transaction count
  const topOwner = dataWithPercentage.length > 0 ? dataWithPercentage[0] : null;

  return {
    data: dataWithPercentage,
    summary: {
      totalTransactions,
      totalAmount: parseFloat(totalAmount.toFixed(2)),
      topOwner: topOwner ? topOwner.ownerName : null,
      topOwnerCount: topOwner ? topOwner.count : 0,
      topOwnerPercentage: topOwner && totalTransactions > 0
        ? parseFloat(((topOwner.count / totalTransactions) * 100).toFixed(2))
        : 0,
      month,
      year
    }
  };
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
  getAccountsByProduct,
  getTransactionsBySource,
  getTransactionRevenueBySource,
  getTransactionCountByOwner
};
