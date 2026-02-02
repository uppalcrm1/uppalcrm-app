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
 * GET /api/accounts
 * Get all accounts for the organization
 */
router.get('/', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { status, limit = 100, offset = 0, includeDeleted = 'false', search, orderBy = 'created_date', orderDirection = 'desc' } = req.query;

    console.log('📥 [Accounts GET] Received query:', { status, limit, offset, search });

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

        -- Calculate monthly cost based on billing cycle
        CASE
          WHEN a.billing_cycle = 'monthly' THEN a.price
          WHEN a.billing_cycle = 'quarterly' THEN a.price / 3
          WHEN a.billing_cycle = 'semi_annual' OR a.billing_cycle = 'semi-annual' THEN a.price / 6
          WHEN a.billing_cycle = 'annual' THEN a.price / 12
          ELSE a.price
        END as monthly_cost,

        -- Calculate days until renewal
        CASE
          WHEN a.next_renewal_date IS NOT NULL THEN
            EXTRACT(DAY FROM (a.next_renewal_date - CURRENT_DATE))
          ELSE NULL
        END as days_until_renewal,

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
      query += ` AND a.status = $${params.length + 1}`;
      params.push(status);
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
      countQuery += ` AND a.status = $${countParams.length + 1}`;
      countParams.push(status);
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

    // Try with deleted_at column first (newer schema)
    let result;
    try {
      result = await db.query(`
        SELECT
          COUNT(*) as total_accounts,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_accounts,
          COUNT(CASE WHEN status = 'trial' THEN 1 END) as trial_accounts,
          COUNT(CASE WHEN is_trial = true THEN 1 END) as trial_count,
          SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as total_revenue
        FROM accounts
        WHERE organization_id = $1 AND deleted_at IS NULL
      `, [organization_id], organization_id);
    } catch (error) {
      // Fallback for older schema without deleted_at column
      console.warn('Stats query with deleted_at failed, trying without it:', error.message);
      result = await db.query(`
        SELECT
          COUNT(*) as total_accounts,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_accounts,
          COUNT(CASE WHEN status = 'trial' THEN 1 END) as trial_accounts,
          COALESCE(COUNT(CASE WHEN is_trial = true THEN 1 END), 0) as trial_count,
          SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as total_revenue
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
    // Return default stats instead of 500 error to prevent page crashes
    res.json({
      success: true,
      stats: {
        total_accounts: 0,
        active_accounts: 0,
        trial_accounts: 0,
        trial_count: 0,
        total_revenue: 0
      }
    });
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
        -- Calculate next renewal date
        CASE
          WHEN a.is_trial = true THEN a.trial_end_date
          WHEN a.next_renewal_date IS NOT NULL THEN a.next_renewal_date
          WHEN a.billing_cycle = 'monthly' THEN a.created_at + INTERVAL '1 month'
          WHEN a.billing_cycle = 'quarterly' THEN a.created_at + INTERVAL '3 months'
          WHEN a.billing_cycle = 'semi-annual' OR a.billing_cycle = 'semi_annual' THEN a.created_at + INTERVAL '6 months'
          WHEN a.billing_cycle = 'annual' THEN a.created_at + INTERVAL '12 months'
        END as next_renewal_date,
        -- Calculate days until renewal
        CASE
          WHEN a.is_trial = true THEN EXTRACT(DAY FROM (a.trial_end_date - NOW()))
          WHEN a.next_renewal_date IS NOT NULL THEN EXTRACT(DAY FROM (a.next_renewal_date - NOW()))
          WHEN a.billing_cycle = 'monthly' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '1 month') - NOW()))
          WHEN a.billing_cycle = 'quarterly' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '3 months') - NOW()))
          WHEN a.billing_cycle = 'semi-annual' OR a.billing_cycle = 'semi_annual' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '6 months') - NOW()))
          WHEN a.billing_cycle = 'annual' THEN EXTRACT(DAY FROM ((a.created_at + INTERVAL '12 months') - NOW()))
        END as days_until_renewal,
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
        a.license_status,
        a.next_renewal_date,
        CASE
          WHEN a.next_renewal_date IS NOT NULL THEN a.next_renewal_date
          WHEN a.billing_cycle = 'monthly' THEN a.created_at + INTERVAL '1 month'
          WHEN a.billing_cycle = 'quarterly' THEN a.created_at + INTERVAL '3 months'
          WHEN a.billing_cycle = 'semi-annual' OR a.billing_cycle = 'semi_annual' THEN a.created_at + INTERVAL '6 months'
          WHEN a.billing_cycle = 'annual' THEN a.created_at + INTERVAL '12 months'
        END as calculated_next_renewal
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
      billing_cycle, // Legacy field (string: 'monthly', 'quarterly', etc.)
      term, // New standardized field (numeric months: 1, 3, 6, 12, 24)
      price = 0,
      license_status = 'pending',
      account_type = 'trial',
      is_trial = false,
      notes
    } = req.body;

    // Convert term (numeric) to billing_cycle (string) if term is provided
    let finalBillingCycle = billing_cycle;
    let billingTermMonths = null;

    if (term) {
      // Term provided as numeric months - convert to billing_cycle string
      const termMap = {
        '1': 'monthly',
        '3': 'quarterly',
        '6': 'semi-annual',
        '12': 'annual',
        '24': 'biennial'
      };
      finalBillingCycle = termMap[term.toString()] || 'monthly';
      billingTermMonths = parseInt(term);
    } else if (billing_cycle) {
      // Legacy billing_cycle provided - convert to months
      const cycleToMonths = {
        'monthly': 1,
        'quarterly': 3,
        'semi-annual': 6,
        'semi_annual': 6,
        'annual': 12,
        'biennial': 24
      };
      billingTermMonths = cycleToMonths[billing_cycle] || 1;
    }

    // Validate required fields
    if (!contact_id || !account_name || (!billing_cycle && !term)) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'contact_id, account_name, and either term or billing_cycle are required'
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
        organization_id, contact_id, account_name, account_type,
        edition, device_name, mac_address,
        license_key, license_status, billing_cycle, price, currency,
        is_trial, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `;

    const accountResult = await db.query(accountQuery, [
      organization_id,
      contact_id,
      account_name,
      account_type,
      edition || null,
      device_name || null,
      mac_address || null,
      licenseKey,
      license_status,
      finalBillingCycle, // Use converted billing_cycle
      price,
      'USD',
      is_trial,
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
    const allowedFields = [
      'account_name', 'edition', 'device_name', 'mac_address',
      'billing_cycle', 'price', 'license_status', 'account_type',
      'is_trial', 'notes'
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
