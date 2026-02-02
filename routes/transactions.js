const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../database/connection');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');
const transactionController = require('../backend/controllers/transactionController');
const ConfigService = require('../services/ConfigService');
const CurrencyHelper = require('../utils/currency');

// Apply authentication middleware to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// Validation schemas
const transactionSchemas = {
  create: Joi.object({
    account_id: Joi.string().uuid().required(), // REQUIRED: Every transaction must have an account
    contact_id: Joi.string().uuid().required(), // REQUIRED: Every transaction must have a contact
    product_id: Joi.string().uuid().allow(null),
    payment_method: Joi.string().max(50).default('Credit Card'),
    source: Joi.string().max(50).required(), // REQUIRED: Source must be provided
    term: Joi.string().max(50).required(), // REQUIRED: Billing term
    amount: Joi.number().min(0).required(),
    currency: Joi.string().valid('CAD', 'USD').default('CAD'),
    status: Joi.string().valid('completed', 'pending', 'failed', 'refunded').default('completed'),
    payment_date: Joi.date().iso().required(), // REQUIRED: Date when payment was made
    transaction_reference: Joi.string().max(255).allow('', null),
    notes: Joi.string().allow('', null),
    // Manual expiry update fields (Option 4)
    update_account_expiry: Joi.boolean().default(false), // Whether to update account expiry
    new_expiry_date: Joi.date().iso().allow(null) // New expiry date if updating
  }),

  update: Joi.object({
    payment_method: Joi.string().max(50),
    source: Joi.string().max(50).allow('', null),
    term: Joi.string().max(50),
    amount: Joi.number().min(0),
    currency: Joi.string().valid('CAD', 'USD'),
    status: Joi.string().valid('completed', 'pending', 'failed', 'refunded'),
    payment_date: Joi.date().iso(), // Allow updating payment date
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

// =====================================================
// SPECIFIC ROUTES - MUST BE DEFINED BEFORE /:id ROUTE
// =====================================================

/**
 * GET /api/transactions/stats
 * Get transaction statistics (includes void stats)
 */
router.get('/stats', transactionController.getTransactionStats);

/**
 * GET /api/transactions/stats/revenue
 * Get total revenue in CAD (with currency conversion)
 * All amounts converted to CAD for reporting
 */
router.get('/stats/revenue', async (req, res) => {
  try {
    const { organization_id } = req.user;

    // Get all completed transactions with dates
    const result = await db.query(`
      SELECT
        amount,
        currency,
        status,
        transaction_date
      FROM transactions
      WHERE organization_id = $1
        AND status = 'completed'
        AND (deleted_at IS NULL OR is_void = FALSE)
    `, [organization_id]);

    // Get all transactions count (for total count)
    const countResult = await db.query(`
      SELECT COUNT(*) as total_count
      FROM transactions
      WHERE organization_id = $1
        AND (deleted_at IS NULL OR is_void = FALSE)
    `, [organization_id]);

    // Get exchange rate
    const exchangeRate = await ConfigService.getExchangeRate(organization_id);

    let totalInCAD = 0;
    let cadCount = 0;
    let usdCount = 0;
    let cadRevenue = 0;
    let usdRevenue = 0;
    let thisMonthRevenueCAD = 0;
    let thisMonthCADRevenue = 0;
    let thisMonthUSDRevenue = 0;

    // Calculate first day of current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Process each transaction
    result.rows.forEach(row => {
      const amount = parseFloat(row.amount);
      const currency = row.currency || 'CAD'; // Default to CAD if null
      const transDate = row.transaction_date ? new Date(row.transaction_date) : null;

      // Convert to CAD based on currency
      let amountInCAD = 0;
      if (currency === 'CAD') {
        amountInCAD = amount;
        totalInCAD += amount;
        cadRevenue += amount;
        cadCount++;
        
        // Track this month
        if (transDate && transDate >= firstDayOfMonth) {
          thisMonthCADRevenue += amount;
          thisMonthRevenueCAD += amount;
        }
      } else if (currency === 'USD') {
        amountInCAD = CurrencyHelper.toCAD(amount, 'USD', exchangeRate);
        totalInCAD += amountInCAD;
        usdRevenue += amount;
        usdCount++;
        
        // Track this month
        if (transDate && transDate >= firstDayOfMonth) {
          thisMonthUSDRevenue += amount;
          thisMonthRevenueCAD += amountInCAD;
        }
      }
    });

    // Calculate average transaction amount (in CAD)
    const totalTransactions = cadCount + usdCount;
    const averageTransactionCAD = totalTransactions > 0 ? totalInCAD / totalTransactions : 0;

    res.json({
      success: true,
      total_revenue_cad: parseFloat(totalInCAD.toFixed(2)),
      average_transaction_cad: parseFloat(averageTransactionCAD.toFixed(2)),
      this_month_revenue_cad: parseFloat(thisMonthRevenueCAD.toFixed(2)),
      total_transactions: parseInt(countResult.rows[0].total_count),
      breakdown: {
        cad_transactions: cadCount,
        cad_revenue: parseFloat(cadRevenue.toFixed(2)),
        usd_transactions: usdCount,
        usd_revenue: parseFloat(usdRevenue.toFixed(2)),
        usd_converted_to_cad: parseFloat((usdRevenue * exchangeRate).toFixed(2))
      },
      this_month_breakdown: {
        cad_revenue: parseFloat(thisMonthCADRevenue.toFixed(2)),
        usd_revenue: parseFloat(thisMonthUSDRevenue.toFixed(2)),
        usd_converted_to_cad: parseFloat((thisMonthUSDRevenue * exchangeRate).toFixed(2))
      },
      exchange_rate_used: exchangeRate,
      reporting_currency: 'CAD'
    });
  } catch (error) {
    console.error('Error calculating revenue:', error);
    res.status(500).json({
      error: 'Failed to calculate revenue',
      message: error.message
    });
  }
});

/**
 * GET /api/transactions/voided/list
 * Get all voided transactions (admin only)
 */
router.get('/voided/list', transactionController.getVoidedTransactions);

/**
 * GET /api/transactions/config/exchange-rate
 * Get current exchange rate configuration
 */
router.get('/config/exchange-rate', async (req, res) => {
  try {
    const { organization_id } = req.user;

    const rate = await ConfigService.getExchangeRate(organization_id);
    const reportingCurrency = await ConfigService.getReportingCurrency(organization_id);

    res.json({
      success: true,
      exchange_rate_usd_to_cad: parseFloat(rate),
      reporting_currency: reportingCurrency,
      info: {
        description: '1 USD = ' + rate + ' CAD',
        example: '100 USD = ' + (100 * rate) + ' CAD'
      }
    });
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    res.status(500).json({
      error: 'Failed to fetch exchange rate',
      message: error.message
    });
  }
});

/**
 * PUT /api/transactions/config/exchange-rate
 * Update exchange rate (admin only)
 * Body: { rate: 1.25 }
 */
router.put('/config/exchange-rate', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { rate } = req.body;

    // Validation
    if (!rate || rate <= 0) {
      return res.status(400).json({
        error: 'Invalid exchange rate',
        message: 'Rate must be a positive number'
      });
    }

    // Update configuration
    await ConfigService.set(
      organization_id,
      'exchange_rate_usd_to_cad',
      rate.toString(),
      '1 USD = ' + rate + ' CAD'
    );

    console.log(`✅ Exchange rate updated: 1 USD = ${rate} CAD for org ${organization_id}`);

    res.json({
      success: true,
      message: 'Exchange rate updated successfully',
      exchange_rate_usd_to_cad: parseFloat(rate),
      info: {
        description: '1 USD = ' + rate + ' CAD',
        example: '100 USD = ' + (100 * rate) + ' CAD'
      }
    });
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    res.status(500).json({
      error: 'Failed to update exchange rate',
      message: error.message
    });
  }
});

/**
 * GET /api/transactions/accounts/:accountId
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

// =====================================================
// GENERAL CRUD ROUTES
// =====================================================

/**
 * GET /api/transactions
 * Get all transactions for the organization with 8 required columns
 */
router.get('/', async (req, res) => {
  try {
    const { organization_id } = req.user;
    const { status, contact_id, limit = 100, offset = 0, search } = req.query;

    console.log('📥 [Transactions GET] Received query:', { status, contact_id, search, limit, offset });

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

        -- Created by user information
        COALESCE(u.first_name || ' ' || u.last_name, 'Unknown') as created_by_name,
        u.email as created_by_email,

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
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.organization_id = $1
    `;

    const params = [organization_id];

    if (status) {
      query += ` AND t.status = $${params.length + 1}`;
      params.push(status);
    }

    if (contact_id) {
      query += ` AND t.contact_id = $${params.length + 1}`;
      params.push(contact_id);
    }

    // Add search filter
    if (search && search.trim()) {
      query += ` AND (
        t.transaction_reference ILIKE $${params.length + 1} OR
        a.account_name ILIKE $${params.length + 1} OR
        c.first_name ILIKE $${params.length + 1} OR
        c.last_name ILIKE $${params.length + 1} OR
        c.email ILIKE $${params.length + 1} OR
        p.name ILIKE $${params.length + 1}
      )`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY t.transaction_date DESC, t.created_at DESC`;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    // Get total count (without LIMIT/OFFSET)
    let countQuery = `
      SELECT COUNT(*) as total_count
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN products p ON t.product_id = p.id
      WHERE t.organization_id = $1
    `;

    const countParams = [organization_id];

    if (status) {
      countQuery += ` AND t.status = $${countParams.length + 1}`;
      countParams.push(status);
    }

    if (contact_id) {
      countQuery += ` AND t.contact_id = $${countParams.length + 1}`;
      countParams.push(contact_id);
    }

    // Add search filter to count query
    if (search && search.trim()) {
      countQuery += ` AND (
        t.transaction_reference ILIKE $${countParams.length + 1} OR
        a.account_name ILIKE $${countParams.length + 1} OR
        c.first_name ILIKE $${countParams.length + 1} OR
        c.last_name ILIKE $${countParams.length + 1} OR
        c.email ILIKE $${countParams.length + 1} OR
        p.name ILIKE $${countParams.length + 1}
      )`;
      countParams.push(`%${search}%`);
    }

    const result = await db.query(query, params);
    const countResult = await db.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].total_count, 10);

    res.json({
      success: true,
      transactions: result.rows,
      count: result.rows.length,
      total: totalCount,
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      totalPages: Math.ceil(totalCount / parseInt(limit, 10))
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
 * Create a new transaction with optional account expiry update (Option 4)
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
      payment_date,
      transaction_reference,
      notes,
      // Manual expiry update fields
      update_account_expiry,
      new_expiry_date
    } = req.body;

    await client.query('BEGIN');

    // Set user context for RLS
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', user_id]);
    await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', organization_id]);

    // 1. Create the transaction
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
        transaction_date,
        transaction_reference,
        notes,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date, $12, $13, $14)
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
      payment_date,
      transaction_reference,
      notes,
      user_id
    ]);

    const transaction = result.rows[0];

    // 2. Update account expiry ONLY if user requested it (Option 4 - Manual Control)
    let accountUpdateResult = null;
    if (update_account_expiry && new_expiry_date) {
      console.log(`📅 Updating account ${account_id} expiry to ${new_expiry_date}`);

      accountUpdateResult = await client.query(`
        UPDATE accounts
        SET
          next_renewal_date = $1::date,
          subscription_end_date = $1::date,
          price = $2,
          billing_cycle = $3,
          updated_at = NOW()
        WHERE id = $4 AND organization_id = $5
        RETURNING id, account_name, next_renewal_date, subscription_end_date
      `, [
        new_expiry_date,
        amount,
        term,
        account_id,
        organization_id
      ]);

      if (accountUpdateResult.rows.length > 0) {
        console.log(`✅ Account expiry updated successfully for ${accountUpdateResult.rows[0].account_name}`);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: update_account_expiry
        ? 'Transaction created and account expiry updated successfully'
        : 'Transaction created successfully (account expiry not changed)',
      transaction: transaction,
      account_updated: update_account_expiry && accountUpdateResult?.rows.length > 0,
      updated_account: accountUpdateResult?.rows[0] || null
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

    // Map API field names to database column names
    const fieldMapping = {
      'payment_date': 'transaction_date' // Map payment_date from API to transaction_date in DB
    };

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        const dbColumnName = fieldMapping[key] || key; // Use mapped name or original
        updateFields.push(`${dbColumnName} = $${paramCounter}`);
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


module.exports = router;
