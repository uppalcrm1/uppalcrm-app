const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

// Rate limiting for field creation
const fieldCreationLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // Max 10 new fields per day per organization
  message: { error: 'Too many fields created today. Try again tomorrow.' },
  keyGenerator: (req) => req.organizationId,
  standardHeaders: true,
  legacyHeaders: false,
});

// Validation schemas
const createFieldSchema = Joi.object({
  field_name: Joi.string()
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Field name can only contain letters, numbers, and underscores'
    }),
  field_label: Joi.string().max(100).required(),
  field_type: Joi.string()
    .valid('text', 'select', 'number', 'date', 'email', 'tel', 'textarea')
    .required(),
  field_options: Joi.when('field_type', {
    is: 'select',
    then: Joi.array().items(Joi.string().max(100)).min(2).max(20).required(),
    otherwise: Joi.array().length(0)
  }),
  is_required: Joi.boolean().default(false)
});

const updateFieldSchema = Joi.object({
  field_label: Joi.string().max(100),
  field_options: Joi.when('field_type', {
    is: 'select',
    then: Joi.array().items(Joi.string().max(100)).min(2).max(20),
    otherwise: Joi.forbidden()
  }),
  is_required: Joi.boolean(),
  is_enabled: Joi.boolean(),
  sort_order: Joi.number().integer().min(0)
});

// Get all custom fields and configuration
router.get('/', authenticateToken, async (req, res) => {
  try {
    const customFields = await db.query(`
      SELECT id, field_name, field_label, field_type, field_options,
             is_required, is_enabled, sort_order, created_at
      FROM custom_field_definitions
      WHERE organization_id = $1
      ORDER BY sort_order ASC, created_at ASC
    `, [req.organizationId]);

    const defaultFields = await db.query(`
      SELECT field_name, is_enabled, is_required, sort_order
      FROM default_field_configurations
      WHERE organization_id = $1
    `, [req.organizationId]);

    // Get usage statistics
    const usage = await db.query(`
      SELECT custom_fields_count, contacts_count
      FROM organization_usage
      WHERE organization_id = $1
    `, [req.organizationId]);

    res.json({
      customFields: customFields.rows,
      defaultFields: defaultFields.rows,
      usage: usage.rows[0] || { custom_fields_count: 0, contacts_count: 0 },
      limits: {
        maxCustomFields: 15,
        maxContacts: 5000,
        maxFieldOptions: 20
      }
    });
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    res.status(500).json({ error: 'Failed to fetch custom fields' });
  }
});

// Create new custom field
router.post('/', authenticateToken, fieldCreationLimit, async (req, res) => {
  try {
    const { error, value } = createFieldSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { field_name, field_label, field_type, field_options, is_required } = value;

    // Check if field name already exists
    const existingField = await db.query(`
      SELECT id FROM custom_field_definitions
      WHERE organization_id = $1 AND field_name = $2
    `, [req.organizationId, field_name]);

    if (existingField.rows.length > 0) {
      return res.status(400).json({ error: 'Field name already exists' });
    }

    // Check against system field names
    const systemFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'source', 'status', 'priority'];
    if (systemFields.includes(field_name)) {
      return res.status(400).json({ error: 'Field name conflicts with system field' });
    }

    const result = await db.query(`
      INSERT INTO custom_field_definitions
      (organization_id, field_name, field_label, field_type, field_options, is_required, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, field_name, field_label, field_type, field_options, is_required, is_enabled, created_at
    `, [req.organizationId, field_name, field_label, field_type, field_options, is_required, req.userId]);

    res.status(201).json({
      message: 'Custom field created successfully',
      field: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating custom field:', error);
    if (error.message.includes('Custom field limit exceeded')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to create custom field' });
  }
});

// Update custom field
router.put('/:fieldId', authenticateToken, async (req, res) => {
  try {
    const { error, value } = updateFieldSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        updates.push(`${key} = $${paramCount++}`);
        values.push(val);
      }
    });

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.fieldId, req.organizationId);

    const result = await db.query(`
      UPDATE custom_field_definitions
      SET ${updates.join(', ')}
      WHERE id = $${paramCount++} AND organization_id = $${paramCount++}
      RETURNING id, field_name, field_label, field_type, field_options, is_required, is_enabled, sort_order
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    res.json({
      message: 'Custom field updated successfully',
      field: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating custom field:', error);
    res.status(500).json({ error: 'Failed to update custom field' });
  }
});

// Delete custom field
router.delete('/:fieldId', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      DELETE FROM custom_field_definitions
      WHERE id = $1 AND organization_id = $2
      RETURNING field_name
    `, [req.params.fieldId, req.organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Custom field not found' });
    }

    res.json({ message: 'Custom field deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom field:', error);
    res.status(500).json({ error: 'Failed to delete custom field' });
  }
});

// Update default field configuration
router.put('/default/:fieldName', authenticateToken, async (req, res) => {
  try {
    const { is_enabled, is_required, sort_order } = req.body;
    const { fieldName } = req.params;

    const result = await db.query(`
      INSERT INTO default_field_configurations
      (organization_id, field_name, is_enabled, is_required, sort_order)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (organization_id, field_name)
      DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        is_required = EXCLUDED.is_required,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      RETURNING field_name, is_enabled, is_required, sort_order
    `, [req.organizationId, fieldName, is_enabled, is_required, sort_order]);

    res.json({
      message: 'Default field configuration updated',
      field: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating default field:', error);
    res.status(500).json({ error: 'Failed to update default field configuration' });
  }
});

module.exports = router;