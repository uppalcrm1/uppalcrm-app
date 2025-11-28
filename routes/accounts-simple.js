const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');

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
    const { status, limit = 100, offset = 0 } = req.query;

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

        -- Count total accounts for this contact
        (SELECT COUNT(*)
         FROM accounts a2
         WHERE a2.contact_id = a.contact_id
         AND a2.organization_id = a.organization_id
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

    if (status) {
      query += ` AND a.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY a.created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params, organization_id);

    res.json({
      success: true,
      accounts: result.rows,
      count: result.rows.length
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

    const result = await db.query(`
      SELECT
        COUNT(*) as total_accounts,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_accounts,
        COUNT(CASE WHEN status = 'trial' THEN 1 END) as trial_accounts,
        COUNT(CASE WHEN is_trial = true THEN 1 END) as trial_count,
        SUM(CASE WHEN status = 'active' THEN price ELSE 0 END) as total_revenue
      FROM accounts
      WHERE organization_id = $1
    `, [organization_id], organization_id);

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

module.exports = router;
