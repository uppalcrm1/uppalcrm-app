const express = require('express');
const router = express.Router();
const Joi = require('joi');
const db = require('../database/connection');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');

// Validation schemas
const productSchemas = {
  createProduct: Joi.object({
    name: Joi.string().required().max(100),
    description: Joi.string().allow('', null),
    price: Joi.number().required().min(0),
    currency: Joi.string().default('USD').max(3),
    allowed_billing_cycles: Joi.array().items(
      Joi.string().valid('monthly', 'quarterly', 'semi-annual', 'annual')
    ).default(['monthly', 'annual']),
    is_active: Joi.boolean().default(true),
    is_default: Joi.boolean().default(false),
    display_order: Joi.number().integer().default(0),
    color: Joi.string().allow('', null).max(50),
    features: Joi.array().items(Joi.string()).default([])
  }),

  updateProduct: Joi.object({
    name: Joi.string().max(100),
    description: Joi.string().allow('', null),
    price: Joi.number().min(0),
    currency: Joi.string().max(3),
    allowed_billing_cycles: Joi.array().items(
      Joi.string().valid('monthly', 'quarterly', 'semi-annual', 'annual')
    ),
    is_active: Joi.boolean(),
    is_default: Joi.boolean(),
    display_order: Joi.number().integer(),
    color: Joi.string().allow('', null).max(50),
    features: Joi.array().items(Joi.string())
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

// Check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only administrators can perform this action'
    });
  }
  next();
};

/**
 * GET /api/products
 * Get all active products for the organization
 */
router.get('/',
  authenticateToken,
  validateOrganizationContext,
  async (req, res) => {
    try {
      const { organization_id } = req.user;
      const { include_inactive } = req.query;

      let query = `
        SELECT
          id,
          name,
          description,
          price,
          currency,
          allowed_billing_cycles,
          is_active,
          is_default,
          display_order,
          color,
          features,
          created_at,
          updated_at
        FROM products
        WHERE organization_id = $1
      `;

      const params = [organization_id];

      // Only show active products by default
      if (include_inactive !== 'true') {
        query += ' AND is_active = true';
      }

      query += ' ORDER BY display_order ASC, name ASC';

      const result = await db.query(query, params);

      res.json({
        products: result.rows
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).json({
        error: 'Failed to fetch products',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/products
 * Create a new product (admin only)
 */
router.post('/',
  authenticateToken,
  validateOrganizationContext,
  requireAdmin,
  validate(productSchemas.createProduct),
  async (req, res) => {
    const client = await db.pool.connect();

    try {
      const { organization_id, id: user_id } = req.user;
      const {
        name,
        description,
        price,
        currency,
        allowed_billing_cycles,
        is_active,
        is_default,
        display_order,
        color,
        features
      } = req.body;

      await client.query('BEGIN');

      // Set user context for RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', user_id]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', organization_id]);

      // If this is set as default, unset other defaults
      if (is_default) {
        await client.query(
          'UPDATE products SET is_default = false WHERE organization_id = $1',
          [organization_id]
        );
      }

      // Insert the new product
      const insertQuery = `
        INSERT INTO products (
          organization_id,
          name,
          description,
          price,
          currency,
          allowed_billing_cycles,
          is_active,
          is_default,
          display_order,
          color,
          features,
          created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        organization_id,
        name,
        description,
        price,
        currency,
        JSON.stringify(allowed_billing_cycles),
        is_active,
        is_default,
        display_order,
        color,
        JSON.stringify(features),
        user_id
      ]);

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Product created successfully',
        product: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating product:', error);
      res.status(500).json({
        error: 'Failed to create product',
        message: error.message
      });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/products/:id
 * Update a product (admin only)
 */
router.put('/:id',
  authenticateToken,
  validateOrganizationContext,
  requireAdmin,
  validate(productSchemas.updateProduct),
  async (req, res) => {
    const client = await db.pool.connect();

    try {
      const { id } = req.params;
      const { organization_id, id: user_id } = req.user;
      const updates = req.body;

      await client.query('BEGIN');

      // Set user context for RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', user_id]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', organization_id]);

      // If setting as default, unset other defaults
      if (updates.is_default === true) {
        await client.query(
          'UPDATE products SET is_default = false WHERE organization_id = $1 AND id != $2',
          [organization_id, id]
        );
      }

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      let paramCounter = 1;

      Object.keys(updates).forEach(key => {
        if (updates[key] !== undefined) {
          updateFields.push(`${key} = $${paramCounter}`);
          // Convert arrays to JSON for JSONB fields
          if (key === 'allowed_billing_cycles' || key === 'features') {
            values.push(JSON.stringify(updates[key]));
          } else {
            values.push(updates[key]);
          }
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

      const updateQuery = `
        UPDATE products
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramCounter} AND organization_id = $${paramCounter + 1}
        RETURNING *
      `;

      const result = await client.query(updateQuery, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Product not found'
        });
      }

      await client.query('COMMIT');

      res.json({
        message: 'Product updated successfully',
        product: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating product:', error);
      res.status(500).json({
        error: 'Failed to update product',
        message: error.message
      });
    } finally {
      client.release();
    }
  }
);

/**
 * DELETE /api/products/:id
 * Soft delete (deactivate) a product
 */
router.delete('/:id',
  authenticateToken,
  validateOrganizationContext,
  requireAdmin,
  async (req, res) => {
    const client = await db.pool.connect();

    try {
      const { id } = req.params;
      const { organization_id, id: user_id } = req.user;

      await client.query('BEGIN');

      // Set user context for RLS
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', user_id]);
      await client.query('SELECT set_config($1, $2, true)', ['app.current_organization_id', organization_id]);

      // Soft delete by setting is_active = false
      const result = await client.query(
        `UPDATE products
         SET is_active = false, updated_at = NOW()
         WHERE id = $1 AND organization_id = $2
         RETURNING *`,
        [id, organization_id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          error: 'Product not found'
        });
      }

      // If this was the default product, set another product as default
      if (result.rows[0].is_default) {
        await client.query(
          `UPDATE products
           SET is_default = true
           WHERE organization_id = $1
           AND is_active = true
           AND id != $2
           ORDER BY display_order ASC
           LIMIT 1`,
          [organization_id, id]
        );
      }

      await client.query('COMMIT');

      res.json({
        message: 'Product deactivated successfully',
        product: result.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error deleting product:', error);
      res.status(500).json({
        error: 'Failed to delete product',
        message: error.message
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
