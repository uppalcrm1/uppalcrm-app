const db = require('../../database/connection');

/**
 * Transaction Controller
 * Handles transaction management operations including void (soft delete) functionality
 */

/**
 * Void a transaction (soft delete)
 * POST /api/transactions/:id/void
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.voidTransaction = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  try {
    // Verify transaction belongs to this organization and is not already voided
    const transactionCheck = await db.query(
      `SELECT
        t.id,
        t.amount,
        t.payment_method,
        t.transaction_date,
        t.status,
        a.account_name,
        c.first_name || ' ' || c.last_name as contact_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       LEFT JOIN contacts c ON t.contact_id = c.id
       WHERE t.id = $1
       AND t.organization_id = $2
       AND t.deleted_at IS NULL
       AND t.is_void = FALSE`,
      [id, organizationId],
      organizationId
    );

    if (transactionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found or already voided'
      });
    }

    const transaction = transactionCheck.rows[0];

    // Mark transaction as void (soft delete)
    await db.query(
      `UPDATE transactions
       SET
         is_void = TRUE,
         deleted_at = NOW(),
         deleted_by = $1,
         deletion_reason = $2,
         status = 'voided',
         updated_at = NOW()
       WHERE id = $3`,
      [userId, reason || 'No reason provided', id],
      organizationId
    );

    // The trigger will automatically log this in audit_log table

    res.json({
      success: true,
      message: 'Transaction voided successfully',
      data: {
        transactionId: id,
        amount: transaction.amount,
        accountName: transaction.account_name,
        contactName: transaction.contact_name,
        voidedAt: new Date().toISOString(),
        reason: reason || 'No reason provided'
      }
    });

  } catch (error) {
    console.error('Error voiding transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to void transaction',
      message: error.message
    });
  }
};

/**
 * Restore a voided transaction (unvoid)
 * POST /api/transactions/:id/restore
 *
 * WARNING: Use with extreme caution. Restoring voided transactions
 * can affect financial reports and revenue calculations.
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.restoreTransaction = async (req, res) => {
  const { id } = req.params;
  const { justification } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  try {
    // Verify transaction was voided and belongs to this organization
    const transactionCheck = await db.query(
      `SELECT
        t.id,
        t.amount,
        t.deleted_at,
        t.deletion_reason,
        a.account_name
       FROM transactions t
       LEFT JOIN accounts a ON t.account_id = a.id
       WHERE t.id = $1
       AND t.organization_id = $2
       AND (t.deleted_at IS NOT NULL OR t.is_void = TRUE)`,
      [id, organizationId],
      organizationId
    );

    if (transactionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Voided transaction not found'
      });
    }

    const transaction = transactionCheck.rows[0];

    // Restore the transaction (unvoid)
    await db.query(
      `UPDATE transactions
       SET
         is_void = FALSE,
         deleted_at = NULL,
         deleted_by = NULL,
         deletion_reason = NULL,
         status = 'completed',
         updated_at = NOW(),
         updated_by = $1
       WHERE id = $2`,
      [userId, id],
      organizationId
    );

    // Log the restore operation
    await db.query(
      `INSERT INTO audit_log (
        organization_id,
        action,
        entity_type,
        entity_id,
        performed_by,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        organizationId,
        'restore_transaction',
        'transaction',
        id,
        userId,
        JSON.stringify({
          amount: transaction.amount,
          account_name: transaction.account_name,
          was_voided_at: transaction.deleted_at,
          original_void_reason: transaction.deletion_reason,
          restore_justification: justification,
          restored_at: new Date().toISOString()
        })
      ],
      organizationId
    );

    res.json({
      success: true,
      message: 'Transaction restored successfully',
      data: {
        transactionId: id,
        amount: transaction.amount,
        accountName: transaction.account_name,
        restoredAt: new Date().toISOString(),
        wasVoidedAt: transaction.deleted_at
      }
    });

  } catch (error) {
    console.error('Error restoring transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore transaction',
      message: error.message
    });
  }
};

/**
 * Get all transactions (with optional voided filter)
 * GET /api/transactions
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTransactions = async (req, res) => {
  const organizationId = req.user.organization_id;
  const {
    includeVoided,
    accountId,
    contactId,
    status,
    limit = 100,
    offset = 0
  } = req.query;

  try {
    let query = `
      SELECT
        t.*,
        a.account_name,
        c.first_name || ' ' || c.last_name as contact_name,
        c.email as contact_email,
        p.name as product_name,
        t.is_void,
        t.deleted_at,
        t.deletion_reason,
        CASE WHEN t.deleted_by IS NOT NULL THEN
          (SELECT email FROM users WHERE id = t.deleted_by)
        ELSE NULL END as voided_by_email
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.organization_id = $1
    `;

    const params = [organizationId];

    // Filter voided/deleted unless admin explicitly includes them
    if (!includeVoided || includeVoided !== 'true') {
      query += ` AND t.deleted_at IS NULL AND t.is_void = FALSE`;
    }

    if (accountId) {
      query += ` AND t.account_id = $${params.length + 1}`;
      params.push(accountId);
    }

    if (contactId) {
      query += ` AND t.contact_id = $${params.length + 1}`;
      params.push(contactId);
    }

    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY t.transaction_date DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params, organizationId);

    // Calculate total revenue (excluding voided)
    const revenueQuery = `
      SELECT SUM(amount) as total_revenue
      FROM transactions
      WHERE organization_id = $1
      AND deleted_at IS NULL
      AND is_void = FALSE
      AND status = 'completed'
    `;

    const revenueResult = await db.query(
      revenueQuery,
      [organizationId],
      organizationId
    );

    res.json({
      success: true,
      transactions: result.rows,
      count: result.rows.length,
      totalRevenue: revenueResult.rows[0]?.total_revenue || 0,
      includesVoided: includeVoided === 'true'
    });

  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
};

/**
 * Get single transaction by ID
 * GET /api/transactions/:id
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTransaction = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user.organization_id;
  const { includeVoided } = req.query;

  try {
    let query = `
      SELECT
        t.*,
        a.account_name,
        c.first_name || ' ' || c.last_name as contact_name,
        p.name as product_name,
        t.is_void,
        t.deleted_at,
        t.deletion_reason,
        CASE WHEN t.deleted_by IS NOT NULL THEN
          (SELECT email FROM users WHERE id = t.deleted_by)
        ELSE NULL END as voided_by_email
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.id = $1 AND t.organization_id = $2
    `;

    const params = [id, organizationId];

    // Filter voided unless explicitly requested
    if (!includeVoided || includeVoided !== 'true') {
      query += ` AND t.deleted_at IS NULL AND t.is_void = FALSE`;
    }

    const result = await db.query(query, params, organizationId);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      transaction: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction',
      message: error.message
    });
  }
};

/**
 * Get voided transactions (admin only)
 * GET /api/transactions/voided/list
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getVoidedTransactions = async (req, res) => {
  const organizationId = req.user.organization_id;
  const { limit = 100, offset = 0 } = req.query;

  try {
    const query = `
      SELECT
        t.*,
        a.account_name,
        c.first_name || ' ' || c.last_name as contact_name,
        p.name as product_name,
        u.email as voided_by_email,
        u.first_name || ' ' || u.last_name as voided_by_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN products p ON t.product_id = p.id
      LEFT JOIN users u ON t.deleted_by = u.id
      WHERE t.organization_id = $1
      AND (t.deleted_at IS NOT NULL OR t.is_void = TRUE)
      ORDER BY t.deleted_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(
      query,
      [organizationId, limit, offset],
      organizationId
    );

    // Calculate total voided amount
    const voidedAmountQuery = `
      SELECT SUM(amount) as total_voided_amount
      FROM transactions
      WHERE organization_id = $1
      AND (deleted_at IS NOT NULL OR is_void = TRUE)
    `;

    const voidedAmountResult = await db.query(
      voidedAmountQuery,
      [organizationId],
      organizationId
    );

    res.json({
      success: true,
      voidedTransactions: result.rows,
      count: result.rows.length,
      totalVoidedAmount: voidedAmountResult.rows[0]?.total_voided_amount || 0
    });

  } catch (error) {
    console.error('Error fetching voided transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch voided transactions',
      message: error.message
    });
  }
};

/**
 * Get transaction statistics
 * GET /api/transactions/stats
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getTransactionStats = async (req, res) => {
  const organizationId = req.user.organization_id;

  try {
    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND is_void = FALSE) as active_transactions,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL OR is_void = TRUE) as voided_transactions,
        SUM(amount) FILTER (WHERE deleted_at IS NULL AND is_void = FALSE AND status = 'completed') as total_revenue,
        SUM(amount) FILTER (WHERE deleted_at IS NOT NULL OR is_void = TRUE) as total_voided_amount,
        AVG(amount) FILTER (WHERE deleted_at IS NULL AND is_void = FALSE AND status = 'completed') as average_transaction_amount
      FROM transactions
      WHERE organization_id = $1
    `;

    const result = await db.query(statsQuery, [organizationId], organizationId);
    const stats = result.rows[0];

    res.json({
      success: true,
      stats: {
        activeTransactions: parseInt(stats.active_transactions) || 0,
        voidedTransactions: parseInt(stats.voided_transactions) || 0,
        totalRevenue: parseFloat(stats.total_revenue) || 0,
        totalVoidedAmount: parseFloat(stats.total_voided_amount) || 0,
        averageTransactionAmount: parseFloat(stats.average_transaction_amount) || 0
      }
    });

  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch transaction stats',
      message: error.message
    });
  }
};

module.exports = exports;
