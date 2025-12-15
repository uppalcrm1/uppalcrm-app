const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../database/connection');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');
const transactionController = require('../backend/controllers/transactionController');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// Validation schemas
const transactionSchemas = {
  create: Joi.object({
    account_id: Joi.string().uuid().allow(null),
    contact_id: Joi.string().uuid().allow(null),
    product_id: Joi.string().uuid().allow(null),
    payment_method: Joi.string().max(50).default('Credit Card'),
    source: Joi.string().max(50).allow('', null), // Payment source (website, phone, referral, etc.)
    term: Joi.string().max(50).allow('', null),
    amount: Joi.number().min(0).required(),
    currency: Joi.string().max(10).default('USD'),
    status: Joi.string().valid('completed', 'pending', 'failed', 'refunded').default('completed'),
    transaction_reference: Joi.string().max(255).allow('', null),
    notes: Joi.string().allow('', null)
  }),

  update: Joi.object({
    payment_method: Joi.string().max(50),
    source: Joi.string().max(50).allow('', null),
    term: Joi.string().max(50).allow('', null),
    amount: Joi.number().min(0),
    currency: Joi.string().max(10),
    status: Joi.string().valid('completed', 'pending', 'failed', 'refunded'),
    transaction_reference: Joi.string().max(255).allow('', null),
    notes: Joi.string().allow('', null)
  })
};

// Validation middleware
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    req.body = value;
    next();
  };
};

/**
 * GET /api/transactions
 * Get all transactions for the organization with 8 required columns
 */
router.get('/', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { status, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT
        t.id,
        t.amount,
        t.currency,
        t.payment_method,
        t.source,
        t.term,
        t.status,
        t.transaction_reference,
        t.notes,
        -- Payment date in YYYY-MM-DD format
        CAST(t.transaction_date AS DATE) as payment_date,
        t.created_at,
        t.updated_at,

        -- Account information
        t.account_id,
        a.account_name,

        -- Contact information (2-step relationship through accounts)
        t.contact_id,
        COALESCE(c.name, c.first_name || ' ' || c.last_name) as contact_name,
        c.email as contact_email,

        -- Product information
        p.name as product_name,

        -- Generate Transaction ID: "Account Name - Term"
        CONCAT(
          COALESCE(a.account_name, 'Unknown'),
          ' - ',
          CASE
            WHEN LOWER(t.term) = 'monthly' OR t.term = '1' THEN '1 month'
            WHEN LOWER(t.term) = 'quarterly' OR t.term = '3' THEN '3 months'
            WHEN LOWER(t.term) = 'semi-annual' OR LOWER(t.term) = 'semi_annual' OR t.term = '6' THEN '6 months'
            WHEN LOWER(t.term) = 'annual' OR LOWER(t.term) = 'yearly' OR t.term = '12' THEN '1 year'
            ELSE COALESCE(t.term, 'Unknown')
          END
        ) as transaction_id
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.organization_id = $1
    `;

    const params = [organization_id];

    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      transactions: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      message: error.message
    });
  }
});

/**
 * GET /api/transactions/:id
 * Get a single transaction
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { organization_id } = req.user;

    const result = await db.query(`
      SELECT
        t.*,
        c.first_name || ' ' || c.last_name as contact_name,
        c.email as contact_email,
        a.account_name,
        p.name as product_name,
        p.price as product_price
      FROM transactions t
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.id = $1 AND t.organization_id = $2
    `, [id, organization_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
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
      error: 'Failed to fetch transaction',
      message: error.message
    });
  }
});

/**
 * POST /api/transactions
 * Create a new transaction
 */
router.post('/', validate(transactionSchemas.create), async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { organization_id, id: user_id } = req.user;
    const {
      account_id,
      contact_id,
      product_id,
      payment_method,
      source,
      term,
      amount,
      currency,
      status,
      transaction_reference,
      notes
    } = req.body;

    await client.query('BEGIN');

    // Set user context for RLS
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', user_id]);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', organization_id]);

    const result = await client.query(`
      INSERT INTO transactions (
        organization_id,
        account_id,
        contact_id,
        product_id,
        payment_method,
        source,
        term,
        amount,
        currency,
        status,
        transaction_reference,
        notes,
        transaction_date,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
      RETURNING *
    `, [
      organization_id,
      account_id,
      contact_id,
      product_id,
      payment_method,
      source,
      term,
      amount,
      currency,
      status,
      transaction_reference,
      notes,
      user_id
    ]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Transaction created successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating transaction:', error);
    res.status(500).json({
      error: 'Failed to create transaction',
      message: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/accounts/:accountId/transactions
 * Get all transactions for a specific account
 */
router.get('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { organization_id } = req.user;

    const result = await db.query(`
      SELECT
        t.*,
        p.name as product_name
      FROM transactions t
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.account_id = $1
        AND t.organization_id = $2
      ORDER BY t.transaction_date DESC, t.created_at DESC
    `, [accountId, organization_id]);

    res.json({
      success: true,
      transactions: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching account transactions:', error);
    res.status(500).json({
      error: 'Failed to fetch account transactions',
      message: error.message
    });
  }
});

/**
 * PUT /api/transactions/:id
 * Update a transaction
 */
router.put('/:id', validate(transactionSchemas.update), async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { id } = req.params;
    const { organization_id, id: user_id } = req.user;
    const updates = req.body;

    await client.query('BEGIN');

    // Set user context for RLS
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', user_id]);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', organization_id]);

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCounter = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        updateFields.push(`${key} = $${paramCounter}`);
        values.push(updates[key]);
        paramCounter++;
      }
    });

    if (updateFields.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'No fields to update'
      });
    }

    values.push(id, organization_id);

    const result = await client.query(`
      UPDATE transactions
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCounter} AND organization_id = $${paramCounter + 1}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Transaction not found'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      transaction: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating transaction:', error);
    res.status(500).json({
      error: 'Failed to update transaction',
      message: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/transactions/:id
 * Delete a transaction
 */
router.delete('/:id', async (req, res) => {
  const client = await db.pool.connect();

  try {
    const { id } = req.params;
    const { organization_id, id: user_id } = req.user;

    await client.query('BEGIN');

    // Set user context for RLS
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', user_id]);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', organization_id]);

    const result = await client.query(`
      DELETE FROM transactions
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `, [id, organization_id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Transaction not found'
      });
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Transaction deleted successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting transaction:', error);
    res.status(500).json({
      error: 'Failed to delete transaction',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// =====================================================
// SOFT DELETE (VOID) ENDPOINTS
// =====================================================

/**
 * POST /api/transactions/:id/void
 * Void a transaction (soft delete)
 * Marks transaction as void without permanently deleting it
 */
router.post('/:id/void', transactionController.voidTransaction);

/**
 * POST /api/transactions/:id/restore
 * Restore a voided transaction
 * WARNING: Use with caution - affects financial reports
 */
router.post('/:id/restore', transactionController.restoreTransaction);

/**
 * GET /api/transactions/voided/list
 * Get all voided transactions (admin only)
 */
router.get('/voided/list', transactionController.getVoidedTransactions);

/**
 * GET /api/transactions/stats
 * Get transaction statistics (includes void stats)
 */
router.get('/stats', transactionController.getTransactionStats);

module.exports = router;
