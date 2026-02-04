const db = require('../../database/connection');

/**
 * Account Controller
 * Handles account management operations including soft delete functionality
 */

/**
 * Soft delete an account
 * POST /api/accounts/:id/delete
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.softDeleteAccount = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  try {
    // Verify account belongs to this organization and is not already deleted
    const accountCheck = await db.query(
      `SELECT id, account_name, account_type FROM accounts
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, organizationId],
      organizationId
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or already deleted'
      });
    }

    const account = accountCheck.rows[0];

    // Soft delete the account
    await db.query(
      `UPDATE accounts
       SET
         deleted_at = NOW(),
         deleted_by = $1,
         deletion_reason = $2,
         account_type = 'cancelled',
         updated_at = NOW()
       WHERE id = $3`,
      [userId, reason || 'No reason provided', id],
      organizationId
    );

    // The trigger will automatically log this in audit_log table

    res.json({
      success: true,
      message: 'Account deleted successfully',
      data: {
        accountId: id,
        accountName: account.account_name,
        deletedAt: new Date().toISOString(),
        reason: reason || 'No reason provided'
      }
    });

  } catch (error) {
    console.error('Error soft deleting account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account',
      message: error.message
    });
  }
};

/**
 * Restore a soft-deleted account
 * POST /api/accounts/:id/restore
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.restoreAccount = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  try {
    // Verify account was deleted and belongs to this organization
    const accountCheck = await db.query(
      `SELECT id, account_name, deleted_at FROM accounts
       WHERE id = $1 AND organization_id = $2 AND deleted_at IS NOT NULL`,
      [id, organizationId],
      organizationId
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Deleted account not found'
      });
    }

    const account = accountCheck.rows[0];

    // Restore the account
    await db.query(
      `UPDATE accounts
       SET
         deleted_at = NULL,
         deleted_by = NULL,
         deletion_reason = NULL,
         account_type = 'active',
         updated_at = NOW(),
         updated_by = $1
       WHERE id = $2`,
      [userId, id],
      organizationId
    );

    // The trigger will automatically log the restore in audit_log table

    res.json({
      success: true,
      message: 'Account restored successfully',
      data: {
        accountId: id,
        accountName: account.account_name,
        restoredAt: new Date().toISOString(),
        wasDeletedAt: account.deleted_at
      }
    });

  } catch (error) {
    console.error('Error restoring account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to restore account',
      message: error.message
    });
  }
};

/**
 * Get all accounts (with optional deleted filter)
 * GET /api/accounts
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAccounts = async (req, res) => {
  const organizationId = req.user.organization_id;
  const {
    includeDeleted,
    status,
    limit = 100,
    offset = 0
  } = req.query;

  try {
    let query = `
      SELECT
        a.*,
        c.first_name,
        c.last_name,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        c.email as contact_email,
        c.phone,
        c.company,
        p.name as product_name,
        p.price as product_price,
        a.edition as edition_name,

        -- Calculate monthly cost based on billing term (months)
        CASE
          WHEN a.billing_term_months = 1 THEN a.price
          WHEN a.billing_term_months = 3 THEN a.price / 3
          WHEN a.billing_term_months = 6 THEN a.price / 6
          WHEN a.billing_term_months = 12 THEN a.price / 12
          ELSE a.price
        END as monthly_cost,

        -- Calculate days until renewal
        CASE
          WHEN a.next_renewal_date IS NOT NULL THEN
            EXTRACT(DAY FROM (a.next_renewal_date - CURRENT_DATE))
          ELSE NULL
        END as days_until_renewal,

        -- Count total accounts for this contact
        (SELECT COUNT(*)
         FROM accounts a2
         WHERE a2.contact_id = a.contact_id
         AND a2.organization_id = a.organization_id
         AND a2.deleted_at IS NULL
        ) as total_accounts_for_contact,

        -- Count transactions for this specific account (exclude voided)
        (SELECT COUNT(*)
         FROM transactions t
         WHERE t.account_id = a.id
         AND t.deleted_at IS NULL
         AND t.is_void = FALSE
        ) as transaction_count,

        -- Deleted info (if deleted)
        a.deleted_at,
        a.deletion_reason,
        CASE WHEN a.deleted_by IS NOT NULL THEN
          (SELECT email FROM users WHERE id = a.deleted_by)
        ELSE NULL END as deleted_by_email

      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.organization_id = $1
    `;

    const params = [organizationId];

    // Filter deleted unless admin explicitly includes them
    if (!includeDeleted || includeDeleted !== 'true') {
      query += ` AND a.deleted_at IS NULL`;
    }

    if (status) {
      query += ` AND a.account_type = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY a.created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params, organizationId);

    res.json({
      success: true,
      accounts: result.rows,
      count: result.rows.length,
      includesDeleted: includeDeleted === 'true'
    });

  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch accounts',
      message: error.message
    });
  }
};

/**
 * Get single account by ID
 * GET /api/accounts/:id
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getAccount = async (req, res) => {
  const { id } = req.params;
  const organizationId = req.user.organization_id;
  const { includeDeleted } = req.query;

  try {
    let query = `
      SELECT
        a.*,
        c.first_name,
        c.last_name,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        c.email as contact_email,
        p.name as product_name,
        a.deleted_at,
        a.deletion_reason,
        CASE WHEN a.deleted_by IS NOT NULL THEN
          (SELECT email FROM users WHERE id = a.deleted_by)
        ELSE NULL END as deleted_by_email
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.id = $1 AND a.organization_id = $2
    `;

    const params = [id, organizationId];

    // Filter deleted unless explicitly requested
    if (!includeDeleted || includeDeleted !== 'true') {
      query += ` AND a.deleted_at IS NULL`;
    }

    const result = await db.query(query, params, organizationId);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      account: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch account',
      message: error.message
    });
  }
};

/**
 * Get deleted accounts (admin only)
 * GET /api/accounts/deleted/list
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getDeletedAccounts = async (req, res) => {
  const organizationId = req.user.organization_id;
  const { limit = 100, offset = 0 } = req.query;

  try {
    const query = `
      SELECT
        a.*,
        c.first_name,
        c.last_name,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        p.name as product_name,
        u.email as deleted_by_email,
        u.first_name || ' ' || u.last_name as deleted_by_name
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      LEFT JOIN users u ON a.deleted_by = u.id
      WHERE a.organization_id = $1
      AND a.deleted_at IS NOT NULL
      ORDER BY a.deleted_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(
      query,
      [organizationId, limit, offset],
      organizationId
    );

    res.json({
      success: true,
      deletedAccounts: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching deleted accounts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deleted accounts',
      message: error.message
    });
  }
};

/**
 * Permanently delete an account (admin only - use with extreme caution)
 * DELETE /api/accounts/:id/permanent
 *
 * This should only be used for:
 * - GDPR/data removal requests
 * - Test data cleanup
 * - Legal compliance requirements
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.permanentDeleteAccount = async (req, res) => {
  const { id } = req.params;
  const { confirmation } = req.body;
  const userId = req.user.id;
  const organizationId = req.user.organization_id;

  try {
    // Require explicit confirmation
    if (confirmation !== 'PERMANENTLY DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation required',
        message: 'Please send { "confirmation": "PERMANENTLY DELETE" } to confirm'
      });
    }

    // Verify account exists and is already soft-deleted
    const accountCheck = await db.query(
      `SELECT id, account_name, deleted_at FROM accounts
       WHERE id = $1 AND organization_id = $2`,
      [id, organizationId],
      organizationId
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      });
    }

    const account = accountCheck.rows[0];

    // Recommend soft delete if not already deleted
    if (!account.deleted_at) {
      return res.status(400).json({
        success: false,
        error: 'Account must be soft-deleted first',
        message: 'Please soft-delete the account first before permanent deletion'
      });
    }

    // Log permanent deletion in audit log
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
        'permanent_delete',
        'account',
        id,
        userId,
        JSON.stringify({
          account_name: account.account_name,
          was_deleted_at: account.deleted_at,
          permanently_deleted_at: new Date().toISOString()
        })
      ],
      organizationId
    );

    // Permanently delete the account
    await db.query(
      `DELETE FROM accounts WHERE id = $1`,
      [id],
      organizationId
    );

    res.json({
      success: true,
      message: 'Account permanently deleted',
      data: {
        accountId: id,
        accountName: account.account_name
      }
    });

  } catch (error) {
    console.error('Error permanently deleting account:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to permanently delete account',
      message: error.message
    });
  }
};

module.exports = exports;
