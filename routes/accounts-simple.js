const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');
const accountController = require('../backend/controllers/accountController');
const crypto = require('crypto');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

/**
 * Auto-expire accounts: set active accounts to 'expired' when next_renewal_date has passed.
 * Called at the start of list, stats, and export endpoints to keep status in sync.
 */
const autoExpireAccounts = async (organization_id) => {
  try {
    const result = await db.query(`
      UPDATE accounts
      SET account_status = 'expired', updated_at = NOW()
      WHERE organization_id = $1
        AND account_status = 'active'
        AND next_renewal_date IS NOT NULL
        AND next_renewal_date < CURRENT_DATE
        AND deleted_at IS NULL
    `, [organization_id], organization_id);
    if (result.rowCount > 0) {
      console.log(`⏰ Auto-expired ${result.rowCount} account(s) for org ${organization_id}`);
    }
  } catch (e) {
    // Non-fatal: log and continue (e.g. deleted_at column may not exist)
    console.warn('Auto-expire accounts failed:', e.message);
  }
};

/**
 * GET /api/accounts
 * Get all accounts for the organization
 */
router.get('/', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { status, expiring, limit = 100, offset = 0, includeDeleted = 'false', search, orderBy = 'created_date', orderDirection = 'desc' } = req.query;

    // Auto-expire active accounts with past renewal dates
    await autoExpireAccounts(organization_id);

    console.log('📥 [Accounts GET] Received query:', { status, expiring, limit, offset, search });

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
          WHEN a.billing_term_months IS NOT NULL AND a.billing_term_months > 0
            THEN a.price / a.billing_term_months
          ELSE a.price
        END as monthly_cost,

        -- Days until renewal (calculated from stored next_renewal_date)
        EXTRACT(DAY FROM (a.next_renewal_date - CURRENT_DATE)) as days_until_renewal,

        -- Count total accounts for this contact (excluding deleted)
        (SELECT COUNT(*)
         FROM accounts a2
         WHERE a2.contact_id = a.contact_id
         AND a2.organization_id = a.organization_id
         AND a2.deleted_at IS NULL
        ) as total_accounts_for_contact,

        -- Count transactions for this specific account
        (SELECT COUNT(*)
         FROM transactions t
         WHERE t.account_id = a.id
        ) as transaction_count

      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.organization_id = $1
    `;

    const params = [organization_id];

    // Filter deleted accounts unless explicitly requested
    if (includeDeleted === 'false' || includeDeleted === false) {
      query += ` AND a.deleted_at IS NULL`;
    }

    if (status) {
      if (status === 'expired') {
        // Backwards compatibility: match both 'expired' and legacy 'inactive'
        query += ` AND a.account_status IN ('expired', 'inactive')`;
      } else if (status === 'paused') {
        // Backwards compatibility: match both 'paused' and legacy 'on_hold'
        query += ` AND a.account_status IN ('paused', 'on_hold')`;
      } else {
        query += ` AND a.account_status = $${params.length + 1}`;
        params.push(status);
      }
    }

    // Expiring filter (calculated from next_renewal_date using calendar month boundaries)
    if (expiring === 'this_month') {
      query += ` AND a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE) AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`;
    } else if (expiring === 'next_month') {
      query += ` AND a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 months'`;
    } else if (expiring === 'past_due') {
      query += ` AND a.next_renewal_date < CURRENT_DATE`;
    }

    // Add search filter
    if (search && search.trim()) {
      query += ` AND (
        a.account_name ILIKE $${params.length + 1} OR
        a.mac_address ILIKE $${params.length + 1} OR
        c.first_name ILIKE $${params.length + 1} OR
        c.last_name ILIKE $${params.length + 1} OR
        c.email ILIKE $${params.length + 1} OR
        c.company ILIKE $${params.length + 1} OR
        a.edition ILIKE $${params.length + 1}
      )`;
      params.push(`%${search}%`);
    }

    // Build ORDER BY clause based on sort parameters
    let orderByClause = 'a.created_at'
    switch (orderBy) {
      case 'next_renewal':
        orderByClause = 'a.next_renewal_date'
        break
      case 'created_date':
        orderByClause = 'a.created_at'
        break
      case 'account_name':
        orderByClause = 'a.account_name'
        break
      default:
        orderByClause = 'a.created_at'
    }

    // Validate orderDirection
    const validDirection = orderDirection && orderDirection.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    query += ` ORDER BY ${orderByClause} ${validDirection}`;

    // Get total count for pagination (before LIMIT/OFFSET)
    let countQuery = `SELECT COUNT(*) as total FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.organization_id = $1`;

    const countParams = [organization_id];

    // Apply same filters to count query
    if (includeDeleted === 'false' || includeDeleted === false) {
      countQuery += ` AND a.deleted_at IS NULL`;
    }
    if (status) {
      if (status === 'expired') {
        countQuery += ` AND a.account_status IN ('expired', 'inactive')`;
      } else if (status === 'paused') {
        countQuery += ` AND a.account_status IN ('paused', 'on_hold')`;
      } else {
        countQuery += ` AND a.account_status = $${countParams.length + 1}`;
        countParams.push(status);
      }
    }

    // Expiring filter (count query)
    if (expiring === 'this_month') {
      countQuery += ` AND a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE) AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`;
    } else if (expiring === 'next_month') {
      countQuery += ` AND a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 months'`;
    } else if (expiring === 'past_due') {
      countQuery += ` AND a.next_renewal_date < CURRENT_DATE`;
    }

    if (search && search.trim()) {
      countQuery += ` AND (
        a.account_name ILIKE $${countParams.length + 1} OR
        a.mac_address ILIKE $${countParams.length + 1} OR
        c.first_name ILIKE $${countParams.length + 1} OR
        c.last_name ILIKE $${countParams.length + 1} OR
        c.email ILIKE $${countParams.length + 1} OR
        c.company ILIKE $${countParams.length + 1} OR
        a.edition ILIKE $${countParams.length + 1}
      )`;
      countParams.push(`%${search}%`);
    }

    // Add pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [result, countResult] = await Promise.all([
      db.query(query, params, organization_id),
      db.query(countQuery, countParams, organization_id)
    ]);

    const total = parseInt(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      accounts: result.rows,
      count: result.rows.length,
      total: total,
      totalPages: totalPages
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({
      error: 'Failed to fetch accounts',
      message: error.message
    });
  }
});

/**
 * GET /api/accounts/stats
 * Get account statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const { organization_id } = req.user;

    // Auto-expire active accounts with past renewal dates
    await autoExpireAccounts(organization_id);

    // Account health stats: Total → Active → Expiring This Month → Past Due
    let result;
    try {
      result = await db.query(`
        SELECT
          COUNT(*) as total_accounts,
          COUNT(CASE WHEN account_status = 'active' THEN 1 END) as active_accounts,
          COUNT(CASE WHEN next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                THEN 1 END) as expiring_this_month,
          COUNT(CASE WHEN next_renewal_date < CURRENT_DATE THEN 1 END) as past_due_accounts
        FROM accounts
        WHERE organization_id = $1 AND deleted_at IS NULL
      `, [organization_id], organization_id);
    } catch (error) {
      // Fallback if deleted_at column doesn't exist
      console.warn('Stats query with deleted_at failed, trying without it:', error.message);
      result = await db.query(`
        SELECT
          COUNT(*) as total_accounts,
          COUNT(CASE WHEN account_status = 'active' THEN 1 END) as active_accounts,
          COUNT(CASE WHEN next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE)
                      AND next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
                THEN 1 END) as expiring_this_month,
          COUNT(CASE WHEN next_renewal_date < CURRENT_DATE THEN 1 END) as past_due_accounts
        FROM accounts
        WHERE organization_id = $1
      `, [organization_id], organization_id);
    }

    res.json({
      success: true,
      stats: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching account stats:', error);
    res.status(500).json({
      error: 'Failed to fetch account stats',
      message: error.message
    });
  }
});

/**
 * GET /api/accounts/export
 * Export accounts as CSV
 */
router.get('/export', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { ids, status, expiring, includeDeleted = 'false', search } = req.query;

    // Auto-expire active accounts with past renewal dates
    await autoExpireAccounts(organization_id);

    let query = `
      SELECT
        a.id,
        a.account_name,
        a.mac_address,
        a.device,
        p.name as product_name,
        a.edition as edition_name,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        c.email as contact_email,
        a.account_status,
        a.price,
        a.billing_term_months,
        CASE
          WHEN a.billing_term_months IS NOT NULL AND a.billing_term_months > 0
            THEN a.price / a.billing_term_months
          ELSE a.price
        END as monthly_cost,
        a.created_at,
        a.next_renewal_date,
        EXTRACT(DAY FROM (a.next_renewal_date - CURRENT_DATE)) as days_until_renewal,
        CASE
          WHEN a.next_renewal_date IS NULL THEN ''
          WHEN a.next_renewal_date < CURRENT_DATE THEN 'Past Due'
          WHEN a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE)
               AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
               THEN 'Expiring This Month'
          WHEN a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
               AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 months'
               THEN 'Expiring Next Month'
          ELSE 'Current'
        END as renewal_state
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.organization_id = $1
    `;

    const params = [organization_id];

    // Filter by specific IDs (for bulk export of selected)
    if (ids) {
      const idList = Array.isArray(ids) ? ids : ids.split(',');
      query += ` AND a.id = ANY($${params.length + 1})`;
      params.push(idList);
    }

    if (includeDeleted === 'false' || includeDeleted === false) {
      query += ` AND a.deleted_at IS NULL`;
    }

    if (status) {
      if (status === 'expired') {
        query += ` AND a.account_status IN ('expired', 'inactive')`;
      } else if (status === 'paused') {
        query += ` AND a.account_status IN ('paused', 'on_hold')`;
      } else {
        query += ` AND a.account_status = $${params.length + 1}`;
        params.push(status);
      }
    }

    // Expiring filter
    if (expiring === 'this_month') {
      query += ` AND a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE) AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'`;
    } else if (expiring === 'next_month') {
      query += ` AND a.next_renewal_date >= DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' AND a.next_renewal_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '2 months'`;
    } else if (expiring === 'past_due') {
      query += ` AND a.next_renewal_date < CURRENT_DATE`;
    }

    if (search && search.trim()) {
      query += ` AND (
        a.account_name ILIKE $${params.length + 1} OR
        a.mac_address ILIKE $${params.length + 1} OR
        c.first_name ILIKE $${params.length + 1} OR
        c.last_name ILIKE $${params.length + 1} OR
        c.email ILIKE $${params.length + 1} OR
        c.company ILIKE $${params.length + 1} OR
        a.edition ILIKE $${params.length + 1}
      )`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY a.created_at DESC`;

    const result = await db.query(query, params, organization_id);

    const csvHeaders = [
      'ID', 'Account Name', 'MAC Address', 'Device', 'Product', 'Edition',
      'Contact Name', 'Contact Email', 'Status', 'Price', 'Billing Term (Months)',
      'Monthly Cost', 'Created Date', 'Next Renewal Date', 'Days Until Renewal', 'Renewal State'
    ];

    const csvRows = result.rows.map(row => [
      row.id,
      row.account_name || '',
      row.mac_address || '',
      row.device || '',
      row.product_name || '',
      row.edition_name || '',
      row.contact_name || '',
      row.contact_email || '',
      row.account_status || '',
      row.price || '',
      row.billing_term_months || '',
      row.monthly_cost != null ? parseFloat(row.monthly_cost).toFixed(2) : '',
      row.created_at || '',
      row.next_renewal_date || '',
      row.days_until_renewal != null ? Math.round(row.days_until_renewal) : '',
      row.renewal_state || ''
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="accounts_export_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Export accounts error:', error);
    res.status(500).json({ error: 'Export failed', message: 'Unable to export accounts' });
  }
});

/**
 * GET /api/accounts/:id/detail
 * Get detailed account information for the detail page
 */
router.get('/:id/detail', async (req, res) => {
  try {
    const { id } = req.params;
    const { organization_id } = req.user;

    // Query account with joined contact and product info
    const accountQuery = `
      SELECT
        a.*,
        c.id as contact_id,
        c.first_name,
        c.last_name,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.company as contact_company,
        p.name as product_name,
        p.price as product_price,
        p.description as product_description,
        a.edition as edition_name,
        -- Use stored next_renewal_date (set by transactions, not calculated here)
        EXTRACT(DAY FROM (a.next_renewal_date - NOW())) as days_until_renewal,
        (SELECT COUNT(*) FROM accounts WHERE contact_id = a.contact_id AND organization_id = $2 AND deleted_at IS NULL) as total_accounts_for_contact
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.id = $1 AND a.organization_id = $2
    `;

    const accountResult = await db.query(accountQuery, [id, organization_id], organization_id);

    if (accountResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const account = accountResult.rows[0];

    // Get transactions for this account
    const transactionsQuery = `
      SELECT * FROM transactions
      WHERE account_id = $1 AND organization_id = $2
      ORDER BY created_at DESC
    `;
    const transactionsResult = await db.query(transactionsQuery, [id, organization_id], organization_id);

    // Get other accounts for the same contact
    const relatedAccountsQuery = `
      SELECT
        a.id,
        a.account_name,
        a.edition,
        a.account_status,
        a.next_renewal_date
      FROM accounts a
      WHERE a.contact_id = $1 AND a.id != $2 AND a.organization_id = $3
      ORDER BY a.created_at DESC
      LIMIT 5
    `;
    const relatedAccountsResult = await db.query(relatedAccountsQuery, [
      account.contact_id,
      id,
      organization_id
    ], organization_id);

    res.json({
      success: true,
      account,
      transactions: transactionsResult.rows,
      relatedAccounts: relatedAccountsResult.rows
    });

  } catch (error) {
    console.error('Error fetching account detail:', error);
    res.status(500).json({
      error: 'Failed to fetch account details',
      message: error.message
    });
  }
});

/**
 * GET /api/accounts/:id
 * Get a single account
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { organization_id } = req.user;

    const result = await db.query(`
      SELECT
        a.*,
        c.first_name,
        c.last_name,
        c.email,
        c.phone,
        c.company,
        p.name as product_name,
        p.price as product_price,
        p.description as product_description
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      LEFT JOIN products p ON a.product_id = p.id
      WHERE a.id = $1 AND a.organization_id = $2
    `, [id, organization_id], organization_id);

    if (result.rows.length === 0) {
      return res.status(404).json({
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
      error: 'Failed to fetch account',
      message: error.message
    });
  }
});

/**
 * POST /api/accounts
 * Create a new account manually
 */
router.post('/', async (req, res) => {
  try {
    const { organization_id, id: user_id } = req.user;
    const {
      contact_id,
      account_name,
      edition,
      device_name,
      mac_address,
      term = 1, // New standardized field (numeric months: 1, 3, 6, 12, 24)
      price = 0,
      account_status = 'active',
      notes
    } = req.body;

    // Convert term to numeric months
    const billingTermMonths = parseInt(term) || 1;

    // Validate required fields
    if (!contact_id || !account_name) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'contact_id and account_name are required'
      });
    }

    // Verify contact exists and belongs to organization
    const contactCheck = await db.query(
      'SELECT id FROM contacts WHERE id = $1 AND organization_id = $2',
      [contact_id, organization_id],
      organization_id
    );

    if (contactCheck.rows.length === 0) {
      return res.status(400).json({
        error: 'Invalid contact',
        message: 'Contact not found or does not belong to your organization'
      });
    }

    // Generate unique license key
    const licenseKey = crypto.randomBytes(16).toString('hex').toUpperCase();

    // Create account
    const accountQuery = `
      INSERT INTO accounts (
        organization_id, contact_id, account_name,
        edition, device_name, mac_address,
        license_key, account_status, billing_term_months, price, currency,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const accountResult = await db.query(accountQuery, [
      organization_id,
      contact_id,
      account_name,
      edition || null,
      device_name || null,
      mac_address || null,
      licenseKey,
      account_status,
      billingTermMonths,
      price,
      'USD',
      notes || null,
      user_id
    ], organization_id);

    const account = accountResult.rows[0];

    // Fetch complete account data with contact info
    const completeQuery = `
      SELECT
        a.*,
        c.first_name,
        c.last_name,
        c.email,
        CONCAT(c.first_name, ' ', c.last_name) as contact_name,
        (SELECT COUNT(*) FROM accounts WHERE contact_id = a.contact_id AND deleted_at IS NULL) as total_accounts_for_contact
      FROM accounts a
      JOIN contacts c ON a.contact_id = c.id
      WHERE a.id = $1
    `;

    const completeResult = await db.query(completeQuery, [account.id], organization_id);

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      account: completeResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({
      error: 'Failed to create account',
      message: error.message
    });
  }
});

/**
 * PUT /api/accounts/:id
 * Update an account
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { organization_id, id: user_id } = req.user;
    const updates = req.body;

    // Build dynamic update query
    // NOTE: billing_term_months and price are READ-ONLY (Financial fields)
    // These fields are only updated via transaction endpoints when payments are made
    // This ensures data integrity and prevents accidental changes
    // Users must create/edit transactions to change billing term or price
    const allowedFields = [
      'account_name', 'edition', 'device_name', 'mac_address',
      'account_status', 'notes'
    ];

    const setClause = [];
    const values = [id, organization_id];
    let paramCount = 2;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        paramCount++;
        setClause.push(`${key} = $${paramCount}`);
        values.push(value);
      }
    }

    if (setClause.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    const query = `
      UPDATE accounts
      SET ${setClause.join(', ')}, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `;

    const result = await db.query(query, values, organization_id);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Account not found'
      });
    }

    res.json({
      success: true,
      account: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({
      error: 'Failed to update account',
      message: error.message
    });
  }
});

// =====================================================
// SOFT DELETE ENDPOINTS
// =====================================================

/**
 * POST /api/accounts/:id/delete
 * Soft delete an account
 * Marks account as deleted without permanently removing it
 */
router.post('/:id/delete', accountController.softDeleteAccount);

/**
 * POST /api/accounts/:id/restore
 * Restore a soft-deleted account
 */
router.post('/:id/restore', accountController.restoreAccount);

/**
 * GET /api/accounts/deleted/list
 * Get all deleted accounts (admin only)
 */
router.get('/deleted/list', accountController.getDeletedAccounts);

/**
 * DELETE /api/accounts/:id/permanent
 * Permanently delete an account (admin only - use with extreme caution)
 * Requires confirmation in request body: { "confirmation": "PERMANENTLY DELETE" }
 */
router.delete('/:id/permanent', accountController.permanentDeleteAccount);

module.exports = router;
