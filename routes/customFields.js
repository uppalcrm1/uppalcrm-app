const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');

// Add this helper function at the top after imports
const ensureSystemFieldsTable = async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_field_configurations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        field_name VARCHAR(50) NOT NULL,
        field_label VARCHAR(100) NOT NULL,
        field_type VARCHAR(20) NOT NULL,
        field_options JSONB,
        is_enabled BOOLEAN DEFAULT TRUE,
        is_required BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        UNIQUE(organization_id, field_name)
      );
    `);

    // Enable RLS
    await db.query(`
      ALTER TABLE system_field_configurations ENABLE ROW LEVEL SECURITY;
    `);

    // Create RLS policy
    await db.query(`
      DROP POLICY IF EXISTS system_fields_isolation ON system_field_configurations;
      CREATE POLICY system_fields_isolation ON system_field_configurations
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);
  } catch (error) {
    console.log('System fields table setup error (may already exist):', error.message);
  }
};

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
    // Ensure system fields table exists
    await ensureSystemFieldsTable();

    const customFields = await db.query(`
      SELECT id, field_name, field_label, field_type, field_options,
             is_required, is_enabled, sort_order, created_at
      FROM custom_field_definitions
      WHERE organization_id = $1
      ORDER BY sort_order ASC, created_at ASC
    `, [req.organizationId]);

    // Get system field configurations (from new table)
    const systemFields = await db.query(`
      SELECT field_name, field_label, field_type, field_options, is_enabled, is_required, is_deleted, sort_order
      FROM system_field_configurations
      WHERE organization_id = $1
    `, [req.organizationId]);

    // Get legacy default field configurations (for backward compatibility)
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
      systemFields: systemFields.rows,
      defaultFields: defaultFields.rows, // Keep for backward compatibility
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

// Update default/system field configuration
router.put('/default/:fieldName', authenticateToken, async (req, res) => {
  try {
    await ensureSystemFieldsTable();

    const { is_enabled, is_required, is_deleted, field_options, field_label, field_type } = req.body;
    const { fieldName } = req.params;

    // Define system field defaults
    const systemFieldDefaults = {
      firstName: { label: 'First Name', type: 'text', required: true, editable: false },
      lastName: { label: 'Last Name', type: 'text', required: true, editable: false },
      email: { label: 'Email', type: 'email', required: false, editable: true },
      phone: { label: 'Phone', type: 'tel', required: false, editable: true },
      company: { label: 'Company', type: 'text', required: false, editable: true },
      source: {
        label: 'Source',
        type: 'select',
        required: false,
        editable: true,
        options: ['Website', 'Referral', 'Social', 'Cold-call', 'Email', 'Advertisement', 'Trade-show', 'Other']
      },
      status: {
        label: 'Status',
        type: 'select',
        required: false,
        editable: true,
        options: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost']
      },
      priority: {
        label: 'Priority',
        type: 'select',
        required: false,
        editable: true,
        options: ['low', 'medium', 'high']
      },
      potentialValue: { label: 'Potential Value ($)', type: 'number', required: false, editable: true },
      assignedTo: { label: 'Assign To', type: 'text', required: false, editable: true },
      nextFollowUp: { label: 'Next Follow Up', type: 'date', required: false, editable: true },
      notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
    };

    const fieldDefault = systemFieldDefaults[fieldName];
    if (!fieldDefault) {
      return res.status(400).json({ error: 'Invalid system field name' });
    }

    // Prevent editing of core required fields
    if (!fieldDefault.editable && (is_required !== undefined || is_deleted !== undefined)) {
      return res.status(400).json({ error: 'Cannot modify core required fields' });
    }

    // Validate field options for select fields
    if (field_options && fieldDefault.type === 'select') {
      if (!Array.isArray(field_options) || field_options.length < 2 || field_options.length > 20) {
        return res.status(400).json({ error: 'Select fields must have 2-20 options' });
      }
    }

    const result = await db.query(`
      INSERT INTO system_field_configurations
      (organization_id, field_name, field_label, field_type, field_options, is_enabled, is_required, is_deleted, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (organization_id, field_name)
      DO UPDATE SET
        field_label = COALESCE(EXCLUDED.field_label, system_field_configurations.field_label),
        field_type = COALESCE(EXCLUDED.field_type, system_field_configurations.field_type),
        field_options = COALESCE(EXCLUDED.field_options, system_field_configurations.field_options),
        is_enabled = COALESCE(EXCLUDED.is_enabled, system_field_configurations.is_enabled),
        is_required = COALESCE(EXCLUDED.is_required, system_field_configurations.is_required),
        is_deleted = COALESCE(EXCLUDED.is_deleted, system_field_configurations.is_deleted),
        sort_order = COALESCE(EXCLUDED.sort_order, system_field_configurations.sort_order),
        updated_at = NOW()
      RETURNING field_name, field_label, field_type, field_options, is_enabled, is_required, is_deleted, sort_order
    `, [
      req.organizationId,
      fieldName,
      field_label || fieldDefault.label,
      field_type || fieldDefault.type,
      field_options || fieldDefault.options || null,
      is_enabled !== undefined ? is_enabled : true,
      is_required !== undefined ? is_required : fieldDefault.required,
      is_deleted !== undefined ? is_deleted : false,
      0 // default sort order
    ]);

    res.json({
      message: 'System field configuration updated',
      field: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating system field:', error);
    res.status(500).json({ error: 'Failed to update system field configuration' });
  }
});

// Get form configuration for dynamic form rendering (updated version)
router.get('/form-config', authenticateToken, async (req, res) => {
  try {
    await ensureSystemFieldsTable();

    // Get custom fields
    const customFields = await db.query(`
      SELECT field_name, field_label, field_type, field_options, is_required, sort_order
      FROM custom_field_definitions
      WHERE organization_id = $1 AND is_enabled = true
      ORDER BY sort_order ASC, created_at ASC
    `, [req.organizationId]);

    // Get system field configurations
    const systemFieldConfigs = await db.query(`
      SELECT field_name, field_label, field_type, field_options, is_enabled, is_required, is_deleted
      FROM system_field_configurations
      WHERE organization_id = $1
    `, [req.organizationId]);

    // Default system fields with fallback configurations
    const defaultSystemFields = {
      firstName: { label: 'First Name', type: 'text', required: true, enabled: true },
      lastName: { label: 'Last Name', type: 'text', required: true, enabled: true },
      email: { label: 'Email', type: 'email', required: false, enabled: true },
      phone: { label: 'Phone', type: 'tel', required: false, enabled: true },
      company: { label: 'Company', type: 'text', required: false, enabled: true },
      source: {
        label: 'Source',
        type: 'select',
        required: false,
        enabled: true,
        options: ['Website', 'Referral', 'Social', 'Cold-call', 'Email', 'Advertisement', 'Trade-show', 'Other']
      },
      status: {
        label: 'Status',
        type: 'select',
        required: false,
        enabled: true,
        options: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost']
      },
      priority: {
        label: 'Priority',
        type: 'select',
        required: false,
        enabled: true,
        options: ['low', 'medium', 'high']
      },
      potentialValue: { label: 'Potential Value ($)', type: 'number', required: false, enabled: true },
      assignedTo: { label: 'Assign To', type: 'text', required: false, enabled: true },
      nextFollowUp: { label: 'Next Follow Up', type: 'date', required: false, enabled: true },
      notes: { label: 'Notes', type: 'textarea', required: false, enabled: true }
    };

    // Build system fields array with custom configurations
    const systemFields = Object.keys(defaultSystemFields).map(fieldName => {
      const customConfig = systemFieldConfigs.rows.find(f => f.field_name === fieldName);
      const defaultConfig = defaultSystemFields[fieldName];

      if (customConfig && customConfig.is_deleted) {
        return null; // Field is deleted
      }

      return {
        field_name: fieldName,
        field_label: customConfig?.field_label || defaultConfig.label,
        field_type: customConfig?.field_type || defaultConfig.type,
        field_options: customConfig?.field_options || defaultConfig.options,
        is_required: customConfig?.is_required !== undefined ? customConfig.is_required : defaultConfig.required,
        is_enabled: customConfig?.is_enabled !== undefined ? customConfig.is_enabled : defaultConfig.enabled
      };
    }).filter(Boolean); // Remove null entries (deleted fields)

    res.json({
      customFields: customFields.rows,
      systemFields: systemFields.filter(f => f.is_enabled) // Only return enabled fields
    });
  } catch (error) {
    console.error('Error fetching form config:', error);
    res.status(500).json({ error: 'Failed to fetch form configuration' });
  }
});

module.exports = router;