const express = require('express');
const Lead = require('../models/Lead');
const {
  validateUuidParam,
  validate,
  schemas
} = require('../middleware/validation');
const {
  authenticateToken,
  validateOrganizationContext
} = require('../middleware/auth');
const Joi = require('joi');
const db = require('../database/connection');
const nodemailer = require('nodemailer');

const router = express.Router();

// Lazy-load email transporter to avoid startup issues
let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return transporter;
}

// Send welcome email to the lead
async function sendLeadWelcomeEmail(leadData) {
  try {
    console.log('📧 sendLeadWelcomeEmail called with:', leadData);
    const leadName = `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'there';

    const mailOptions = {
      from: `${process.env.FROM_NAME || 'UppalCRM'} <${process.env.FROM_EMAIL}>`,
      to: leadData.email,
      subject: `Thank you for your interest!`,
      html: `
        <h2>Thank you for reaching out!</h2>
        <p>Hi ${leadName},</p>

        <p>We've received your information and appreciate your interest in our services. Our team will be in touch with you shortly to discuss how we can help.</p>

        <h3>What happens next?</h3>
        <ul>
          <li>A member of our team will review your inquiry</li>
          <li>We'll reach out to you within 24-48 hours</li>
          <li>We'll schedule a time to discuss your needs in detail</li>
        </ul>

        <p>In the meantime, if you have any urgent questions, feel free to reply to this email.</p>

        <p>Best regards,<br>
        The ${process.env.FROM_NAME || 'UppalCRM'} Team</p>
      `,
      text: `
Thank you for reaching out!

Hi ${leadName},

We've received your information and appreciate your interest in our services. Our team will be in touch with you shortly to discuss how we can help.

What happens next?
- A member of our team will review your inquiry
- We'll reach out to you within 24-48 hours
- We'll schedule a time to discuss your needs in detail

In the meantime, if you have any urgent questions, feel free to reply to this email.

Best regards,
The ${process.env.FROM_NAME || 'UppalCRM'} Team
      `
    };

    console.log('📧 Sending mail with options:', JSON.stringify(mailOptions, null, 2));
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Welcome email sent to lead: ${leadData.email}`, info);
    return true;
  } catch (error) {
    console.error(`❌ Error sending lead welcome email:`, error.message);
    console.error(`❌ Error stack:`, error.stack);
    return false;
  }
}

// Send notification email to the assigned user
async function sendUserNotificationEmail(leadData, assignedUserEmail) {
  try {
    const leadName = `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'N/A';

    const mailOptions = {
      from: `${process.env.FROM_NAME || 'UppalCRM'} <${process.env.FROM_EMAIL}>`,
      to: assignedUserEmail,
      subject: `New Lead Assigned: ${leadName}`,
      html: `
        <h2>New Lead Assignment</h2>
        <p>You have been assigned a new lead!</p>

        <h3>Lead Details:</h3>
        <ul>
          <li><strong>Lead ID:</strong> ${leadData.leadId}</li>
          <li><strong>Name:</strong> ${leadName}</li>
          <li><strong>Email:</strong> ${leadData.email || 'N/A'}</li>
          <li><strong>Phone:</strong> ${leadData.phone || 'N/A'}</li>
          <li><strong>Company:</strong> ${leadData.company || 'N/A'}</li>
          <li><strong>Source:</strong> ${leadData.source || 'N/A'}</li>
          <li><strong>Priority:</strong> ${leadData.priority || 'medium'}</li>
          <li><strong>Value:</strong> $${leadData.value || '0'}</li>
        </ul>

        <p><strong>Status:</strong> ${leadData.status || 'new'}</p>
        <p><em>Assigned on: ${new Date(leadData.createdAt).toLocaleString()}</em></p>

        <p><a href="https://uppalcrm-frontend.onrender.com/dashboard">View in CRM Dashboard</a></p>
      `,
      text: `
New Lead Assignment

You have been assigned a new lead!

Lead Details:
- Lead ID: ${leadData.leadId}
- Name: ${leadName}
- Email: ${leadData.email || 'N/A'}
- Phone: ${leadData.phone || 'N/A'}
- Company: ${leadData.company || 'N/A'}
- Source: ${leadData.source || 'N/A'}
- Priority: ${leadData.priority || 'medium'}
- Value: $${leadData.value || '0'}

Status: ${leadData.status || 'new'}
Assigned on: ${new Date(leadData.createdAt).toLocaleString()}

View in CRM Dashboard: https://uppalcrm-frontend.onrender.com/dashboard
      `
    };

    await getTransporter().sendMail(mailOptions);
    console.log(`✅ Notification email sent to user: ${assignedUserEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ Error sending user notification email:`, error.message);
    return false;
  }
}

// Add this helper function to get field configurations
// System field defaults - sync with backend/routes/customFields.js SYSTEM_FIELD_DEFAULTS
const SYSTEM_FIELD_DEFAULTS = {
  first_name: { field_name: 'first_name', field_label: 'First Name', field_type: 'text', is_required: true, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: true, field_options: null, display_order: 1 },
  last_name: { field_name: 'last_name', field_label: 'Last Name', field_type: 'text', is_required: true, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: true, field_options: null, display_order: 2 },
  email: { field_name: 'email', field_label: 'Email', field_type: 'email', is_required: true, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: true, field_options: null, display_order: 3 },
  phone: { field_name: 'phone', field_label: 'Phone', field_type: 'text', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: false, field_options: null, display_order: 4 },
  company: { field_name: 'company', field_label: 'Company', field_type: 'text', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: false, field_options: null, display_order: 5 },
  source: { field_name: 'source', field_label: 'Source', field_type: 'select', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: true, field_options: ['website', 'referral', 'phone', 'email', 'social_media', 'event', 'manual'], display_order: 6 },
  status: { field_name: 'status', field_label: 'Status', field_type: 'select', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: true, field_options: ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'], display_order: 7 },
  priority: { field_name: 'priority', field_label: 'Priority', field_type: 'select', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: true, field_options: ['low', 'medium', 'high'], display_order: 8 },
  value: { field_name: 'value', field_label: 'Potential Value ($)', field_type: 'number', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: false, field_options: null, display_order: 9 },
  assigned_to: { field_name: 'assigned_to', field_label: 'Assign To', field_type: 'user_select', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: false, field_options: null, display_order: 10 },
  next_follow_up: { field_name: 'next_follow_up', field_label: 'Next Follow Up', field_type: 'date', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: false, field_options: null, display_order: 11 },
  notes: { field_name: 'notes', field_label: 'Notes', field_type: 'textarea', is_required: false, is_enabled: true, show_in_create_form: true, show_in_edit_form: true, show_in_detail_view: true, show_in_list_view: false, field_options: null, display_order: 12 }
};

const getFieldConfigurations = async (organizationId) => {
  try {
    // Fetch custom fields with ALL visibility flags
    const customFieldsResult = await db.query(`
      SELECT
        id,
        field_name,
        field_label,
        field_type,
        field_options,
        is_required,
        is_active,
        is_enabled,
        show_in_create_form,
        show_in_edit_form,
        show_in_detail_view,
        show_in_list_view,
        display_order,
        created_at
      FROM custom_field_definitions
      WHERE organization_id = $1 AND is_active = true
      ORDER BY display_order ASC, created_at ASC
    `, [organizationId]);

    // Fetch system fields with ALL visibility flags from default_field_configurations
    let storedSystemFields = [];
    try {
      const systemFieldsResult = await db.query(`
        SELECT
          id,
          field_name,
          field_label,
          field_type,
          field_options,
          is_required,
          is_enabled,
          COALESCE(show_in_create_form, true) as show_in_create_form,
          COALESCE(show_in_edit_form, true) as show_in_edit_form,
          COALESCE(show_in_detail_view, true) as show_in_detail_view,
          COALESCE(show_in_list_view, false) as show_in_list_view,
          display_order
        FROM default_field_configurations
        WHERE organization_id = $1
        ORDER BY display_order ASC
      `, [organizationId]);
      storedSystemFields = systemFieldsResult.rows;
    } catch (error) {
      console.warn('⚠️ Error fetching system fields from database:', error.message);
      // Continue with defaults if table or columns don't exist
    }

    // Build final system fields by merging defaults with stored configs
    const storedConfigMap = {};
    storedSystemFields.forEach(field => {
      storedConfigMap[field.field_name] = field;
    });

    const systemFields = Object.values(SYSTEM_FIELD_DEFAULTS).map(defaultField => {
      const stored = storedConfigMap[defaultField.field_name] || {};
      return {
        ...defaultField,
        ...(stored.id && { id: stored.id }),
        ...(stored.field_label && { field_label: stored.field_label }),
        ...(stored.is_required !== undefined && { is_required: stored.is_required }),
        ...(stored.is_enabled !== undefined && { is_enabled: stored.is_enabled }),
        ...(stored.show_in_create_form !== undefined && { show_in_create_form: stored.show_in_create_form }),
        ...(stored.show_in_edit_form !== undefined && { show_in_edit_form: stored.show_in_edit_form }),
        ...(stored.show_in_detail_view !== undefined && { show_in_detail_view: stored.show_in_detail_view }),
        ...(stored.show_in_list_view !== undefined && { show_in_list_view: stored.show_in_list_view }),
        ...(stored.display_order !== undefined && { display_order: stored.display_order })
      };
    }).filter(field => field.is_enabled !== false);

    return {
      customFields: customFieldsResult.rows,
      systemFields: systemFields,
      defaultFields: systemFields // Maintain backward compatibility
    };
  } catch (error) {
    console.log('⚠️ Error fetching field configurations, returning defaults:', error.message);
    console.error('Error details:', error);
    // Return system field defaults if there's an error
    const defaultSystemFields = Object.values(SYSTEM_FIELD_DEFAULTS).filter(field => field.is_enabled !== false);
    return {
      customFields: [],
      systemFields: defaultSystemFields,
      defaultFields: defaultSystemFields
    };
  }
};

// Add validation for custom fields
const validateCustomFields = (customFields, fieldConfigs) => {
  const errors = [];

  // Validate required custom fields
  for (const field of fieldConfigs.customFields) {
    if (field.is_required && !customFields[field.field_name]) {
      errors.push(`${field.field_label} is required`);
    }

    // Validate field types
    if (customFields[field.field_name]) {
      const value = customFields[field.field_name];

      switch (field.field_type) {
        case 'email':
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            errors.push(`${field.field_label} must be a valid email`);
          }
          break;
        case 'number':
          if (isNaN(value)) {
            errors.push(`${field.field_label} must be a number`);
          }
          break;
        case 'select':
          if (field.field_options && !field.field_options.includes(value)) {
            errors.push(`${field.field_label} must be one of: ${field.field_options.join(', ')}`);
          }
          break;
      }
    }
  }

  return errors;
};

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// Database compatibility helper - detects which value column exists
let valueColumnName = 'value'; // default
const detectValueColumn = async () => {
  try {
    const { query } = require('../database/connection');
    const result = await query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name IN ('value', 'potential_value')
      LIMIT 1
    `);
    if (result.rows.length > 0) {
      valueColumnName = result.rows[0].column_name;
      console.log(`🔧 Using value column: ${valueColumnName}`);
    }
  } catch (error) {
    console.log('⚠️ Could not detect value column, using default: value');
  }
};

// Initialize column detection
detectValueColumn();

/**
 * GET /leads/debug/tables
 * Debug endpoint to check database tables (development only)
 */
router.get('/debug/tables', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    const { query } = require('../database/connection');
    
    // Check all tables
    const tables = await query(`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    // Check if leads table specifically exists with its columns
    const leadsColumns = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'leads'
      ORDER BY ordinal_position
    `);
    
    res.json({
      message: 'Database debug info',
      organizationId: req.organizationId,
      userId: req.user?.id,
      tables: tables.rows,
      leadsTableColumns: leadsColumns.rows,
      leadsTableExists: leadsColumns.rows.length > 0
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({
      error: 'Debug failed',
      message: error.message
    });
  }
});

/**
 * Fetch system field configurations from database
 * This makes validation dynamic based on Field Configuration settings
 */
async function getSystemFieldConfigurations(organizationId) {
  try {
    const result = await db.query(`
      SELECT field_name, field_options, is_enabled, is_required
      FROM default_field_configurations
      WHERE organization_id = $1
    `, [organizationId]);

    return result.rows;
  } catch (error) {
    console.error('Error fetching system field configurations:', error);
    return [];
  }
}

/**
 * Build dynamic Joi schema based on field configurations
 */
async function buildDynamicLeadSchema(organizationId, isUpdate = false) {
  const fieldConfigs = await getSystemFieldConfigurations(organizationId);
  const configMap = {};

  fieldConfigs.forEach(config => {
    configMap[config.field_name] = config;
  });

  // Helper to get allowed values for select fields
  const getAllowedValues = (fieldName, fallbackValues = []) => {
    const config = configMap[fieldName];
    if (config && config.field_options && Array.isArray(config.field_options)) {
      return config.field_options.map(opt =>
        typeof opt === 'string' ? opt : opt.value
      );
    }
    return fallbackValues;
  };

  // Build schema fields
  const schemaFields = {
    title: Joi.string().max(100).allow('', null).optional(),
    company: Joi.string().max(255).allow('', null).optional(),
    first_name: Joi.string().min(1).max(100).allow(null).optional(),
    last_name: Joi.string().min(1).max(100).allow(null).optional(),
    email: Joi.string().email().allow('', null).optional(),
    phone: Joi.string().max(50).allow('', null).optional(),
    notes: Joi.string().allow('', null).optional(),
    assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow(null, '').optional(),
    last_contact_date: Joi.date().iso().allow(null, '').optional(),
    next_follow_up: Joi.date().iso().allow(null, '').optional(),
    value: Joi.number().min(0).allow(null).optional(),
    potential_value: Joi.number().min(0).allow(null).optional(),
    customFields: Joi.object().optional(),
    custom_fields: Joi.object().optional() // snake_case version for inline edits
  };

  // Source field - accept any string for flexibility
  schemaFields.source = Joi.string().max(100).allow('', null).optional();

  // Dynamic validation for status field
  const statusValues = getAllowedValues('status', ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost']);
  if (isUpdate) {
    schemaFields.status = Joi.string().valid(...statusValues, null).optional();
  } else {
    schemaFields.status = Joi.string().valid(...statusValues).default('new');
  }

  // Dynamic validation for priority field
  const priorityValues = getAllowedValues('priority', ['low', 'medium', 'high']);
  if (isUpdate) {
    schemaFields.priority = Joi.string().valid(...priorityValues, null).optional();
  } else {
    schemaFields.priority = Joi.string().valid(...priorityValues).default('medium');
  }

  if (isUpdate) {
    // Additional fields allowed in update requests
    schemaFields.id = Joi.string().guid({ version: 'uuidv4' }).optional();
    schemaFields.created_at = Joi.date().optional();
    schemaFields.updated_at = Joi.date().optional();
    schemaFields.organization_id = Joi.string().guid({ version: 'uuidv4' }).optional();
    schemaFields.created_by = Joi.string().guid({ version: 'uuidv4' }).optional();
    schemaFields.linked_contact_id = Joi.string().guid({ version: 'uuidv4' }).allow(null).optional();
    schemaFields.relationship_type = Joi.string().allow(null).optional();
    schemaFields.interest_type = Joi.string().allow(null).optional();
    schemaFields.converted_date = Joi.date().iso().allow(null).optional();
    schemaFields.owner_first_name = Joi.string().allow(null).optional();
    schemaFields.owner_last_name = Joi.string().allow(null).optional();
    schemaFields.owner_email = Joi.string().allow(null).optional();

    return Joi.object(schemaFields).unknown(true);
  } else {
    // For create, first_name and last_name are optional for flexibility
    schemaFields.first_name = Joi.string().min(1).max(100).allow('', null).optional();
    schemaFields.last_name = Joi.string().min(1).max(100).allow('', null).optional();

    return Joi.object(schemaFields);
  }
}

/**
 * Dynamic validation middleware
 */
function validateLeadDynamic(isUpdate = false) {
  return async (req, res, next) => {
    try {
      const schema = await buildDynamicLeadSchema(req.organizationId, isUpdate);
      const { error, value } = schema.validate(req.body, { abortEarly: false });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          error: 'Request data is invalid',
          details: errors
        });
      }

      req.body = value; // Use validated/sanitized data
      next();
    } catch (err) {
      console.error('Validation error:', err);
      return res.status(500).json({
        error: 'Validation failed',
        message: err.message
      });
    }
  };
}

// Lead validation schemas (LEGACY - kept for backward compatibility)
const leadSchemas = {
  createLead: {
    body: Joi.object({
      title: Joi.string().max(100).optional(),
      company: Joi.string().max(255).optional(),
      first_name: Joi.string().min(1).max(100).required(),
      last_name: Joi.string().min(1).max(100).required(),
      email: Joi.string().email().optional(),
      phone: Joi.string().max(50).optional(),
      source: Joi.string().valid('website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other').optional(),
      status: Joi.string().valid('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost').default('new'),
      priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
      value: Joi.number().min(0).default(0),
      notes: Joi.string().optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).optional(),
      next_follow_up: Joi.date().iso().optional()
    })
  },
  
  updateLead: {
    body: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      title: Joi.string().max(100).allow('', null).optional(),
      company: Joi.string().max(255).allow('', null).optional(),
      first_name: Joi.string().min(1).max(100).allow(null).optional(),
      last_name: Joi.string().min(1).max(100).allow(null).optional(),
      email: Joi.string().email().allow('', null).optional(),
      phone: Joi.string().max(50).allow('', null).optional(),
      source: Joi.string().valid('website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other').allow('', null).optional(),
      status: Joi.string().valid('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost').allow(null).optional(),
      priority: Joi.string().valid('low', 'medium', 'high').allow(null).optional(),
      value: Joi.number().min(0).allow(null).optional(),
      potential_value: Joi.number().min(0).allow(null).optional(),
      notes: Joi.string().allow('', null).optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow(null, '').optional(),
      last_contact_date: Joi.date().iso().allow(null, '').optional(),
      next_follow_up: Joi.date().iso().allow(null, '').optional(),
      created_at: Joi.date().optional(),
      updated_at: Joi.date().optional(),
      organization_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      created_by: Joi.string().guid({ version: 'uuidv4' }).optional(),
      customFields: Joi.object().optional(),
      linked_contact_id: Joi.string().guid({ version: 'uuidv4' }).allow(null).optional(),
      relationship_type: Joi.string().allow(null).optional(),
      interest_type: Joi.string().allow(null).optional(),
      converted_date: Joi.date().iso().allow(null).optional(),
      owner_first_name: Joi.string().allow(null).optional(),
      owner_last_name: Joi.string().allow(null).optional(),
      owner_email: Joi.string().allow(null).optional()
    }).unknown(true),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  listLeads: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost').allow('').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').allow('').optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow('').optional(),
      source: Joi.string().allow('').optional(),
      search: Joi.string().min(1).max(100).allow('').optional(),
      sort: Joi.string().valid('created_at', 'updated_at', 'first_name', 'last_name', 'company', 'value', 'status').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    })
  }
};

/**
 * GET /leads/by-status
 * Get leads grouped by status (for Kanban view)
 */
router.get('/by-status', async (req, res) => {
  console.log('🔍 DEBUG: by-status endpoint hit');
  console.log('🔍 DEBUG: Query params:', req.query);
  console.log('🔍 DEBUG: Organization ID:', req.organizationId);
  console.log('🔍 DEBUG: User ID:', req.user.id);

  try {
    // Ensure value column is detected
    if (!valueColumnName) {
      await detectValueColumn();
    }

    console.log('Getting leads by status for organization:', req.organizationId);
    console.log('Value column being used:', valueColumnName);

    const leads = await db.query(`
      SELECT id, first_name, last_name, email, phone, company, source, status,
             priority, ${valueColumnName}, assigned_to, next_follow_up, notes,
             created_at, updated_at
      FROM leads
      WHERE organization_id = $1
      ORDER BY created_at DESC
    `, [req.organizationId]);

    // Group leads by status
    const leadsByStatus = {};
    const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost'];

    // Initialize empty arrays for each status
    statuses.forEach(status => {
      leadsByStatus[status] = [];
    });

    // Group leads by their status
    leads.rows.forEach(lead => {
      if (leadsByStatus[lead.status]) {
        leadsByStatus[lead.status].push(lead);
      }
    });

    res.json({ leadsByStatus });
  } catch (error) {
    console.error('❌ Get leads by status error:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error message:', error.message);
    console.error('❌ Organization ID during error:', req.organizationId);
    res.status(500).json({
      error: 'Failed to retrieve leads by status',
      message: 'Unable to get leads grouped by status',
      details: error.message
    });
  }
});

/**
 * GET /leads
 * Get all leads with filtering and pagination
 */
router.get('/',
  validate(leadSchemas.listLeads),
  async (req, res) => {
    try {
      console.log('Getting leads for organization:', req.organizationId);
      console.log('Query params:', req.query);
      console.log('Value column being used:', valueColumnName);
      console.log('✅ Updated leads endpoint - includes custom_fields column');

      // Check if organization ID exists
      if (!req.organizationId) {
        console.error('Missing organization ID in request');
        return res.status(400).json({
          error: 'Missing organization context',
          message: 'Organization ID is required'
        });
      }

      const {
        page = 1,
        limit = 20,
        status,
        priority,
        assigned_to,
        source,
        search,
        sort = 'created_at',
        order = 'desc'
      } = req.query;

      // Convert empty strings to undefined for proper filtering
      const filters = {
        status: status && status.trim() !== '' ? status : undefined,
        priority: priority && priority.trim() !== '' ? priority : undefined,
        assigned_to: assigned_to && assigned_to.trim() !== '' ? assigned_to : undefined,
        source: source && source.trim() !== '' ? source : undefined,
        search: search && search.trim() !== '' ? search : undefined
      };

      const offset = (page - 1) * limit;

      // Validate sort column to prevent SQL injection
      const validSortColumns = ['created_at', 'updated_at', 'first_name', 'last_name', 'company', 'value', 'status'];
      const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';

      // Validate order direction
      const orderDirection = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Build WHERE conditions and parameters
      let whereConditions = ['organization_id = $1'];
      let queryParams = [req.organizationId];
      let paramIndex = 2;

      if (filters.status) {
        whereConditions.push(`status = $${paramIndex}`);
        queryParams.push(filters.status);
        paramIndex++;
      }

      if (filters.priority) {
        whereConditions.push(`priority = $${paramIndex}`);
        queryParams.push(filters.priority);
        paramIndex++;
      }

      if (filters.assigned_to) {
        whereConditions.push(`assigned_to = $${paramIndex}`);
        queryParams.push(filters.assigned_to);
        paramIndex++;
      }

      if (filters.source) {
        whereConditions.push(`source = $${paramIndex}`);
        queryParams.push(filters.source);
        paramIndex++;
      }

      if (filters.search) {
        whereConditions.push(`(
          first_name ILIKE $${paramIndex} OR
          last_name ILIKE $${paramIndex} OR
          email ILIKE $${paramIndex} OR
          company ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${filters.search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Add pagination parameters
      queryParams.push(limit, offset);

      // Query leads WITH custom_fields column
      const leads = await db.query(`
        SELECT id, first_name, last_name, email, phone, company, source, status,
               priority, ${valueColumnName}, assigned_to, next_follow_up, notes,
               created_at, updated_at, custom_fields
        FROM leads
        WHERE ${whereClause}
        ORDER BY ${sortColumn} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, queryParams);

      // Get total count for pagination with same filters
      const countParams = queryParams.slice(0, -2); // Remove limit and offset
      const countResult = await db.query(`
        SELECT COUNT(*) as total
        FROM leads
        WHERE ${whereClause}
      `, countParams);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      console.log(`Found ${leads.rows.length} leads out of ${total} total`);

      res.json({
        leads: leads.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      });
    } catch (error) {
      console.error('Get leads error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        organizationId: req.organizationId,
        valueColumnName: valueColumnName,
        query: `SELECT id, first_name, last_name, email, phone, company, source, status,
               priority, ${valueColumnName}, assigned_to, next_follow_up, notes,
               created_at, updated_at, custom_fields`,
        params: [req.organizationId, 20, 0]
      });
      res.status(500).json({
        error: 'Failed to retrieve leads',
        message: 'Unable to get leads list',
        details: error.message, // Temporarily show in production for debugging
        valueColumn: valueColumnName
      });
    }
  }
);

/**
 * GET /leads/stats
 * Get lead statistics for the organization
 */
router.get('/stats',
  async (req, res) => {
    try {
      console.log('Getting lead stats for organization:', req.organizationId);
      console.log('User:', req.user?.id);
      
      // Check if organization ID exists
      if (!req.organizationId) {
        console.error('Missing organization ID in request');
        return res.status(400).json({
          error: 'Missing organization context',
          message: 'Organization ID is required'
        });
      }

      // Ensure leads table exists before getting stats
      const { query } = require('../database/connection');
      
      console.log('🔧 Ensuring leads table exists...');
      
      // Enable UUID extension if not exists
      await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
      
      await query(`
        CREATE TABLE IF NOT EXISTS leads (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          title VARCHAR(255),
          company VARCHAR(255),
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          email VARCHAR(255),
          phone VARCHAR(50),
          source VARCHAR(100) DEFAULT 'manual',
          status VARCHAR(50) DEFAULT 'new',
          priority VARCHAR(20) DEFAULT 'medium',
          value DECIMAL(10,2) DEFAULT 0,
          notes TEXT,
          assigned_to UUID REFERENCES users(id),
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_contact_date TIMESTAMP WITH TIME ZONE,
          next_follow_up TIMESTAMP WITH TIME ZONE
        )
      `);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
        CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      `);
      
      console.log('✅ Leads table ready');

      const stats = await Lead.getStats(req.organizationId);
      console.log('Raw stats from database:', stats);
      
      res.json({
        stats: {
          ...stats,
          total_value: parseFloat(stats.total_value) || 0,
          average_value: parseFloat(stats.average_value) || 0,
          conversion_rate: stats.total_leads > 0 
            ? ((parseInt(stats.converted_leads) / parseInt(stats.total_leads)) * 100).toFixed(2)
            : 0
        }
      });
    } catch (error) {
      console.error('Get lead stats error:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        organizationId: req.organizationId
      });
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: 'Unable to get lead statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

/**
 * ============================================================
 * TASK MANAGEMENT ENDPOINTS
 * ============================================================
 */

/**
 * GET /tasks
 * Get all tasks across the organization with filtering and sorting
 */
router.get('/tasks',
  (req, res, next) => {
    console.log('✅ /tasks route HIT - query:', req.query);
    next();
  },
  authenticateToken,
  validateOrganizationContext,
  validate({
    query: Joi.object({
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
      lead_owner: Joi.string().guid({ version: 'uuidv4' }).optional().allow('', null),
      status: Joi.string().optional().allow(''),
      sort_by: Joi.string().valid('scheduled_at', 'priority', 'created_at').default('scheduled_at'),
      sort_order: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').default('ASC'),
      limit: Joi.number().integer().min(1).max(1000).default(50),
      offset: Joi.number().integer().min(0).default(0),
      priority: Joi.string().valid('low', 'medium', 'high').optional().allow('')
    })
  }),
  async (req, res) => {
    console.log('✅ /tasks HANDLER executing');
    try {
      const {
        assigned_to,
        lead_owner,
        status,
        sort_by = 'scheduled_at',
        sort_order = 'ASC',
        limit = 50,
        offset = 0
      } = req.query;

      const organizationId = req.organizationId;

      // Build WHERE clause
      let whereConditions = [
        'li.organization_id = $1',
        "li.interaction_type = 'task'"
      ];
      let params = [organizationId];
      let paramCount = 1;

      // Filter by status
      if (status) {
        const statuses = status.split(',').map(s => s.trim());
        const statusPlaceholders = statuses.map((_, i) => `$${paramCount + i + 1}`).join(',');
        whereConditions.push(`li.status IN (${statusPlaceholders})`);
        params.push(...statuses);
        paramCount += statuses.length;
      }

      // Filter by assigned user
      if (assigned_to) {
        whereConditions.push(`li.user_id = $${++paramCount}`);
        params.push(assigned_to);
      }

      // Filter by lead owner
      if (lead_owner) {
        whereConditions.push(`l.assigned_to = $${++paramCount}`);
        params.push(lead_owner);
      }

      // Build ORDER BY
      let orderBy = 'li.scheduled_at ASC';
      if (sort_by === 'priority') {
        orderBy = `CASE WHEN li.priority = 'high' THEN 1 WHEN li.priority = 'medium' THEN 2 ELSE 3 END ${sort_order}`;
      } else if (sort_by === 'created_at') {
        orderBy = `li.created_at ${sort_order}`;
      } else {
        orderBy = `li.scheduled_at ${sort_order}`;
      }

      const whereClause = whereConditions.join(' AND ');

      // Get total count and statistics
      const countQuery = `
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN li.status IN ('scheduled', 'pending') THEN 1 END) as pending,
               COUNT(CASE WHEN li.status = 'completed' THEN 1 END) as completed,
               COUNT(CASE WHEN li.scheduled_at < NOW() AND li.status NOT IN ('completed', 'cancelled') THEN 1 END) as overdue
        FROM lead_interactions li
        JOIN leads l ON li.lead_id = l.id
        WHERE ${whereClause}
      `;

      const countResult = await db.query(countQuery, params, organizationId);
      const stats = countResult.rows[0];

      // Get tasks with pagination
      const tasksQuery = `
        SELECT
          li.id,
          li.lead_id,
          li.subject,
          li.description,
          li.status,
          li.priority,
          li.scheduled_at,
          li.completed_at,
          li.created_at,
          l.first_name || ' ' || l.last_name as lead_name,
          l.id as lead_id,
          u.first_name || ' ' || u.last_name as assigned_to_name,
          li.user_id as assigned_to,
          owner.first_name || ' ' || owner.last_name as lead_owner_name,
          l.assigned_to as lead_owner_id
        FROM lead_interactions li
        JOIN leads l ON li.lead_id = l.id
        LEFT JOIN users u ON li.user_id = u.id
        LEFT JOIN users owner ON l.assigned_to = owner.id
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      params.push(parseInt(limit), parseInt(offset));

      const tasksResult = await db.query(tasksQuery, params, organizationId);

      res.json({
        tasks: tasksResult.rows,
        stats: {
          total: parseInt(stats.total) || 0,
          pending: parseInt(stats.pending) || 0,
          completed: parseInt(stats.completed) || 0,
          overdue: parseInt(stats.overdue) || 0
        },
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: parseInt(stats.total) || 0
        }
      });
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({
        error: 'Failed to retrieve tasks',
        message: error.message
      });
    }
  }
);

/**
 * GET /leads/:leadId/tasks
 * Get all tasks for a specific lead with filtering options
 */
router.get('/:leadId/tasks',
  async (req, res) => {
    try {
      const { leadId } = req.params;
      const { status, date_range, priority, overdue } = req.query;
      const organizationId = req.organizationId;

      // Verify lead belongs to organization
      const leadCheck = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
        [leadId, organizationId]
      );

      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Build query with filters (using li. prefix for all columns)
      let whereConditions = ['li.lead_id = $1', 'li.interaction_type = $2', 'li.organization_id = $3'];
      let queryParams = [leadId, 'task', organizationId];
      let paramIndex = 4;

      // Filter by status
      if (status) {
        whereConditions.push(`li.status = $${paramIndex}`);
        queryParams.push(status);
        paramIndex++;
      }

      // Filter by priority
      if (priority) {
        whereConditions.push(`li.priority = $${paramIndex}`);
        queryParams.push(priority);
        paramIndex++;
      }

      // Filter overdue tasks
      if (overdue === 'true') {
        whereConditions.push(`li.scheduled_at < NOW()`);
        whereConditions.push(`li.status = 'scheduled'`);
      }

      // Filter by date range
      if (date_range === 'today') {
        whereConditions.push(`DATE(li.scheduled_at) = CURRENT_DATE`);
      } else if (date_range === 'week') {
        whereConditions.push(`li.scheduled_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'`);
      } else if (date_range === 'month') {
        whereConditions.push(`li.scheduled_at BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'`);
      }

      const whereClause = whereConditions.join(' AND ');

      const query = `
        SELECT
          li.*,
          u.first_name as user_first_name,
          u.last_name as user_last_name,
          u.email as user_email
        FROM lead_interactions li
        LEFT JOIN users u ON li.user_id = u.id
        WHERE ${whereClause}
        ORDER BY
          CASE WHEN li.status = 'scheduled' THEN 0 ELSE 1 END,
          li.scheduled_at ASC,
          li.created_at DESC
      `;

      const result = await db.query(query, queryParams);

      // Calculate statistics from ALL tasks (not filtered)
      const statsQuery = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'scheduled') as pending,
          COUNT(*) FILTER (WHERE status = 'completed') as completed,
          COUNT(*) FILTER (WHERE status = 'scheduled' AND scheduled_at < NOW()) as overdue
        FROM lead_interactions
        WHERE lead_id = $1 AND interaction_type = 'task' AND organization_id = $2
      `;
      const statsResult = await db.query(statsQuery, [leadId, organizationId]);
      const stats = {
        total: parseInt(statsResult.rows[0].total),
        pending: parseInt(statsResult.rows[0].pending),
        completed: parseInt(statsResult.rows[0].completed),
        overdue: parseInt(statsResult.rows[0].overdue)
      };

      res.json({
        tasks: result.rows,
        stats
      });
    } catch (error) {
      console.error('Error fetching tasks:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        leadId: req.params.leadId,
        filters: req.query
      });
      res.status(500).json({
        error: 'Failed to fetch tasks',
        detail: error.message
      });
    }
  }
);

/**
 * POST /leads/:leadId/tasks
 * Create a new task for a lead
 */
router.post('/:leadId/tasks',
  async (req, res) => {
    try {
      const { leadId } = req.params;
      const {
        subject,
        description,
        scheduled_at,
        priority = 'medium',
        assigned_to
      } = req.body;
      const organizationId = req.organizationId;
      const userId = req.user.id;

      // Verify lead belongs to organization
      const leadCheck = await db.query(
        'SELECT assigned_to FROM leads WHERE id = $1 AND organization_id = $2',
        [leadId, organizationId]
      );

      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Use assigned_to from request, or fallback to lead owner, or current user
      const taskAssignee = assigned_to || leadCheck.rows[0].assigned_to || userId;

      // Determine status based on scheduled date
      const status = scheduled_at && new Date(scheduled_at) > new Date()
        ? 'scheduled'
        : 'pending';

      const insertQuery = `
        INSERT INTO lead_interactions (
          lead_id, user_id, organization_id, interaction_type,
          subject, description, scheduled_at, status, priority, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        leadId,
        taskAssignee,
        organizationId,
        'task',
        subject,
        description || '',
        scheduled_at,
        status,
        priority,
        userId
      ]);

      res.status(201).json({
        message: 'Task created successfully',
        task: result.rows[0]
      });
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

/**
 * PATCH /leads/:leadId/tasks/:taskId/complete
 * Mark a task as completed
 */
router.patch('/:leadId/tasks/:taskId/complete',
  authenticateToken,
  validateOrganizationContext,
  async (req, res) => {
    try {
      const { leadId, taskId } = req.params;
      const { outcome = null, notes = null } = req.body || {};
      const organizationId = req.organizationId;
      const userId = req.user?.id;

      // Validate UUID parameters
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (!leadId || typeof leadId !== 'string' || !uuidRegex.test(leadId)) {
        return res.status(400).json({
          error: 'Invalid lead ID',
          detail: 'Lead ID must be a valid UUID'
        });
      }

      if (!taskId || typeof taskId !== 'string' || !uuidRegex.test(taskId)) {
        return res.status(400).json({
          error: 'Invalid task ID',
          detail: 'Task ID must be a valid UUID'
        });
      }

      // Validate organizationId and userId
      if (!organizationId || typeof organizationId !== 'string' || !uuidRegex.test(organizationId)) {
        return res.status(400).json({
          error: 'Invalid organization ID',
          detail: 'Organization context missing or invalid: ' + organizationId
        });
      }

      if (!userId || typeof userId !== 'string' || !uuidRegex.test(userId)) {
        return res.status(400).json({
          error: 'Invalid user ID',
          detail: 'User context missing or invalid: ' + userId
        });
      }

      console.log('=== ABOUT TO EXECUTE QUERIES ===');
      console.log('Parameters:', {
        leadId,
        taskId,
        organizationId,
        userId,
        outcome: req.body?.outcome || null,
        notes: req.body?.notes || null
      });
      console.log('All UUIDs valid? ', leadId && taskId && organizationId && userId);

      console.log('Completing task:', { leadId, taskId, userId: userId.substring(0, 8) + '...', orgId: organizationId.substring(0, 8) + '...' });

      // Verify lead belongs to organization
      const leadCheck = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
        [leadId, organizationId]
      );

      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Update task to completed
      const query = `
        UPDATE lead_interactions
        SET
          status = 'completed',
          completed_at = NOW(),
          last_modified_by = $6,
          outcome = COALESCE($1::text, outcome),
          description = CASE
            WHEN $2::text IS NOT NULL THEN description || E'\n\nCompletion Notes: ' || $2::text
            ELSE description
          END,
          updated_at = NOW()
        WHERE id = $3 AND lead_id = $4 AND interaction_type = 'task' AND organization_id = $5
        RETURNING *
      `;

      const result = await db.query(query, [outcome, notes, taskId, leadId, organizationId, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Update lead's last_contact_date
      await db.query(
        'UPDATE leads SET last_contact_date = NOW(), updated_at = NOW() WHERE id = $1',
        [leadId]
      );

      res.json({
        message: 'Task marked as completed',
        task: result.rows[0]
      });
    } catch (error) {
      console.error('Error completing task:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        leadId: req.params.leadId,
        taskId: req.params.taskId,
        body: req.body
      });
      res.status(500).json({
        error: 'Failed to complete task',
        detail: error.message
      });
    }
  }
);

/**
 * PATCH /leads/:leadId/tasks/:taskId
 * Update task details
 */
router.patch('/:leadId/tasks/:taskId',
  async (req, res) => {
    try {
      const { leadId, taskId } = req.params;
      const {
        subject,
        description,
        scheduled_at,
        priority,
        status
      } = req.body;
      const organizationId = req.organizationId;
      const userId = req.user.id;

      // Verify lead belongs to organization
      const leadCheck = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
        [leadId, organizationId]
      );

      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      // Update task with last_modified_by tracking
      const query = `
        UPDATE lead_interactions
        SET
          subject = COALESCE($1, subject),
          description = COALESCE($2, description),
          scheduled_at = COALESCE($3, scheduled_at),
          priority = COALESCE($4, priority),
          status = COALESCE($5, status),
          last_modified_by = $9,
          updated_at = NOW()
        WHERE id = $6 AND lead_id = $7 AND interaction_type = 'task' AND organization_id = $8
        RETURNING *
      `;

      const result = await db.query(query, [
        subject,
        description,
        scheduled_at,
        priority,
        status,
        taskId,
        leadId,
        organizationId,
        userId
      ]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({
        message: 'Task updated successfully',
        task: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating task:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        leadId: req.params.leadId,
        taskId: req.params.taskId,
        body: req.body
      });
      res.status(500).json({
        error: 'Failed to update task',
        detail: error.message
      });
    }
  }
);

/**
 * DELETE /leads/:leadId/tasks/:taskId
 * Delete a task
 */
router.delete('/:leadId/tasks/:taskId',
  async (req, res) => {
    try {
      const { leadId, taskId } = req.params;
      const organizationId = req.organizationId;

      // Verify lead belongs to organization
      const leadCheck = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
        [leadId, organizationId]
      );

      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const query = `
        DELETE FROM lead_interactions
        WHERE id = $1 AND lead_id = $2 AND interaction_type = 'task' AND organization_id = $3
        RETURNING id
      `;

      const result = await db.query(query, [taskId, leadId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }

      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Error deleting task:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        leadId: req.params.leadId,
        taskId: req.params.taskId
      });
      res.status(500).json({
        error: 'Failed to delete task',
        detail: error.message
      });
    }
  }
);

/**
 * POST /leads/:leadId/tasks/bulk-complete
 * Mark multiple tasks as completed
 */
router.post('/:leadId/tasks/bulk-complete',
  async (req, res) => {
    try {
      const { leadId } = req.params;
      const { taskIds } = req.body;
      const organizationId = req.organizationId;

      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ error: 'taskIds must be a non-empty array' });
      }

      // Verify lead belongs to organization
      const leadCheck = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
        [leadId, organizationId]
      );

      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const query = `
        UPDATE lead_interactions
        SET
          status = 'completed',
          completed_at = NOW(),
          updated_at = NOW()
        WHERE id = ANY($1)
          AND lead_id = $2
          AND interaction_type = 'task'
          AND status != 'completed'
        RETURNING id
      `;

      const result = await db.query(query, [taskIds, leadId]);

      res.json({
        message: `${result.rows.length} tasks marked as completed`,
        completedCount: result.rows.length
      });
    } catch (error) {
      console.error('Error bulk completing tasks:', error);
      res.status(500).json({ error: 'Failed to complete tasks' });
    }
  }
);

/**
 * GET /tasks/overdue
 * Get all overdue tasks across all leads for the organization
 */
router.get('/tasks/overdue', async (req, res) => {
  try {
    const organizationId = req.organizationId;

    const query = `
      SELECT
        li.*,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        l.company as lead_company,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM lead_interactions li
      JOIN leads l ON li.lead_id = l.id
      LEFT JOIN users u ON li.user_id = u.id
      WHERE li.organization_id = $1
        AND li.interaction_type = 'task'
        AND li.status = 'scheduled'
        AND li.scheduled_at < NOW()
      ORDER BY li.scheduled_at ASC
    `;

    const result = await db.query(query, [organizationId]);

    res.json({
      tasks: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching overdue tasks:', error);
    res.status(500).json({ error: 'Failed to fetch overdue tasks' });
  }
});

/**
 * GET /tasks/upcoming
 * Get upcoming tasks (next 7 days) across all leads for the organization
 */
router.get('/tasks/upcoming', async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { days = 7 } = req.query;

    const query = `
      SELECT
        li.*,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        l.company as lead_company,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM lead_interactions li
      JOIN leads l ON li.lead_id = l.id
      LEFT JOIN users u ON li.user_id = u.id
      WHERE li.organization_id = $1
        AND li.interaction_type = 'task'
        AND li.status = 'scheduled'
        AND li.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '${parseInt(days)} days'
      ORDER BY li.scheduled_at ASC
    `;

    const result = await db.query(query, [organizationId]);

    res.json({
      tasks: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching upcoming tasks:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming tasks' });
  }
});

/**
 * GET /leads/:id
 * Get specific lead by ID
 */
router.get('/:id',
  // Skip this route if :id is actually a route name like "tasks", "stats", etc.
  (req, res, next) => {
    const nonIdPaths = ['tasks', 'stats', 'by-status', 'export', 'lead-statuses', 'form-config'];
    if (nonIdPaths.includes(req.params.id)) {
      return next('route'); // Skip to next route
    }
    next();
  },
  validateUuidParam,
  async (req, res) => {
    try {
      const lead = await Lead.findById(req.params.id, req.organizationId);
      
      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      res.json({
        lead: lead.toJSON()
      });
    } catch (error) {
      console.error('Get lead error:', error);
      res.status(500).json({
        error: 'Failed to retrieve lead',
        message: 'Unable to get lead information'
      });
    }
  }
);

/**
 * POST /leads
 * Create new lead with custom fields support
 * Uses dynamic validation based on Field Configuration settings
 */
router.post('/', validateLeadDynamic(false), async (req, res) => {
  try {
    console.log('🔍 Creating lead with data:', req.body);
    console.log('🔍 Organization ID:', req.organizationId);
    console.log('🔍 User ID:', req.user.id);
    console.log('🔍 Value column name:', valueColumnName);

    const {
      firstName, lastName, email, phone, company, source,
      status, priority, potentialValue, assignedTo, nextFollowUp, next_follow_up, notes,
      customFields = {} // Accept custom fields
    } = req.body;

    // Handle both camelCase and snake_case for follow-up date
    const followUpDate = nextFollowUp || next_follow_up;

    // Note: firstName and lastName are now optional fields (no validation required)

    // Validate authentication context
    if (!req.organizationId || !req.user.id) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Missing organization or user context'
      });
    }

    // Ensure value column is detected
    if (!valueColumnName) {
      await detectValueColumn();
    }

    // Get field configurations for validation
    const fieldConfigs = await getFieldConfigurations(req.organizationId);

    // Validate custom fields
    const validationErrors = validateCustomFields(customFields, fieldConfigs);

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors
      });
    }

    const result = await db.query(`
      INSERT INTO leads
      (organization_id, first_name, last_name, email, phone, company, source,
       status, priority, ${valueColumnName}, assigned_to, next_follow_up, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, first_name, last_name, email, phone, company, source, status,
                priority, ${valueColumnName}, assigned_to, next_follow_up, notes, created_at
    `, [
      req.organizationId, firstName, lastName, email, phone, company, source,
      status || 'new', priority || 'medium', potentialValue, assignedTo, followUpDate, notes,
      req.user.id
    ]);

    const createdLead = result.rows[0];

    // Auto-create follow-up task if next_follow_up is set
    if (followUpDate) {
      try {
        console.log('📅 Creating follow-up task for next_follow_up date:', followUpDate);
        const leadName = `${firstName || ''} ${lastName || ''}`.trim() || company || 'this lead';
        const taskUserId = assignedTo || req.user.id; // Assign to lead owner or creator

        // Adjust date if it's at midnight UTC (convert to noon UTC for better timezone display)
        const taskDate = new Date(followUpDate);
        if (taskDate.getUTCHours() === 0 && taskDate.getUTCMinutes() === 0 && taskDate.getUTCSeconds() === 0) {
          taskDate.setUTCHours(12, 0, 0, 0); // Set to noon UTC
          console.log('📅 Adjusted task date from midnight UTC to noon UTC:', taskDate.toISOString());
        }

        await db.query(`
          INSERT INTO lead_interactions (
            lead_id, user_id, organization_id, interaction_type, subject, description,
            scheduled_at, status, priority, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          createdLead.id,
          taskUserId,
          req.organizationId,
          'task',
          `Follow up with ${leadName}`,
          'Follow up with lead',
          taskDate.toISOString(),
          'scheduled',
          'medium',
          req.user.id
        ]);

        console.log('✅ Follow-up task created successfully');
      } catch (taskError) {
        console.error('⚠️ Failed to create follow-up task (non-blocking):', taskError.message);
      }
    }

    // Send emails (fire-and-forget)
    (async () => {
      try {
        console.log('📧 Starting email sending process...');
        console.log('📧 Lead email:', createdLead.email);
        console.log('📧 Assigned to:', assignedTo);

        // Send welcome email to the lead
        if (createdLead.email) {
          console.log('📧 Attempting to send welcome email to:', createdLead.email);
          await sendLeadWelcomeEmail({
            firstName: createdLead.first_name,
            lastName: createdLead.last_name,
            email: createdLead.email
          });
          console.log('📧 Welcome email sent successfully');
        } else {
          console.log('📧 No lead email provided, skipping welcome email');
        }

        // Send notification to assigned user
        if (assignedTo) {
          console.log('📧 Looking up assigned user email for ID:', assignedTo);
          const userResult = await db.query(
            'SELECT email FROM users WHERE id = $1',
            [assignedTo]
          );
          const assignedUserEmail = userResult.rows[0]?.email;
          console.log('📧 Assigned user email:', assignedUserEmail);

          if (assignedUserEmail) {
            console.log('📧 Attempting to send notification to:', assignedUserEmail);
            await sendUserNotificationEmail({
              leadId: createdLead.id,
              firstName: createdLead.first_name,
              lastName: createdLead.last_name,
              email: createdLead.email,
              phone: createdLead.phone,
              company: createdLead.company,
              source: createdLead.source,
              status: createdLead.status,
              priority: createdLead.priority,
              value: createdLead[valueColumnName],
              createdAt: createdLead.created_at
            }, assignedUserEmail);
            console.log('📧 User notification email sent successfully');
          } else {
            console.log('📧 No email found for assigned user');
          }
        } else {
          console.log('📧 No user assigned, skipping notification email');
        }
      } catch (error) {
        console.error('❌ Email sending error (non-blocking):', error);
        console.error('❌ Error stack:', error.stack);
      }
    })();

    res.status(201).json({
      message: 'Lead created successfully',
      lead: createdLead
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * PUT /leads/:id
 * Update lead information
 * Uses dynamic validation based on Field Configuration settings
 */
router.put('/:id',
  validateLeadDynamic(true),
  async (req, res) => {
    try {
      console.log('📝 PUT /leads/:id - Update request received');
      console.log('📝 Lead ID:', req.params.id);
      console.log('📝 Organization ID:', req.organizationId);
      console.log('📝 Request body:', JSON.stringify(req.body, null, 2));

      // Get the old lead data to check if next_follow_up changed
      const oldLeadResult = await db.query(
        'SELECT next_follow_up, first_name, last_name, company, assigned_to FROM leads WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.organizationId]
      );
      const oldLead = oldLeadResult.rows[0];

      // Pass user ID for audit trail tracking
      const userId = req.user?.id || null;
      const lead = await Lead.update(req.params.id, req.body, req.organizationId, userId);

      if (!lead) {
        console.log('❌ Lead not found:', req.params.id);
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      // Auto-create follow-up task if next_follow_up changed
      if (oldLead && req.body.next_follow_up) {
        const oldDate = oldLead.next_follow_up ? new Date(oldLead.next_follow_up).getTime() : null;
        const newDate = new Date(req.body.next_follow_up).getTime();

        // Only create task if the date actually changed
        if (oldDate !== newDate) {
          try {
            console.log('📅 Next follow-up date changed, creating new task...');
            const leadName = `${req.body.first_name || oldLead.first_name || ''} ${req.body.last_name || oldLead.last_name || ''}`.trim()
              || req.body.company || oldLead.company || 'this lead';
            const taskUserId = req.body.assigned_to || oldLead.assigned_to || req.user.id;

            // Adjust date if it's at midnight UTC (convert to noon UTC for better timezone display)
            const taskDate = new Date(req.body.next_follow_up);
            if (taskDate.getUTCHours() === 0 && taskDate.getUTCMinutes() === 0 && taskDate.getUTCSeconds() === 0) {
              taskDate.setUTCHours(12, 0, 0, 0); // Set to noon UTC
              console.log('📅 Adjusted task date from midnight UTC to noon UTC:', taskDate.toISOString());
            }

            await db.query(`
              INSERT INTO lead_interactions (
                lead_id, user_id, organization_id, interaction_type, subject, description,
                scheduled_at, status, priority, created_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
              req.params.id,
              taskUserId,
              req.organizationId,
              'task',
              `Follow up with ${leadName}`,
              'Follow up with lead',
              taskDate.toISOString(),
              'scheduled',
              'medium',
              userId
            ]);

            console.log('✅ Follow-up task created successfully');
          } catch (taskError) {
            console.error('⚠️ Failed to create follow-up task (non-blocking):', taskError.message);
          }
        } else {
          console.log('ℹ️ Next follow-up date unchanged, skipping task creation');
        }
      }

      console.log('✅ Lead updated successfully:', lead.id);
      res.json({
        message: 'Lead updated successfully',
        lead: lead.toJSON()
      });
    } catch (error) {
      console.error('❌ Update lead error:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error detail:', error.detail);

      res.status(500).json({
        error: 'Lead update failed',
        message: error.message || 'Unable to update lead',
        detail: error.detail || 'Internal server error'
      });
    }
  }
);

/**
 * PUT /leads/:id/assign
 * Assign lead to team member
 */
router.put('/:id/assign',
  validateUuidParam,
  validate({
    body: Joi.object({
      assignedTo: Joi.string().guid({ version: 'uuidv4' }).allow(null).required()
    })
  }),
  async (req, res) => {
    try {
      const lead = await Lead.update(req.params.id, { 
        assigned_to: req.body.assignedTo 
      }, req.organizationId);
      
      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      res.json({
        message: 'Lead assigned successfully',
        lead: lead.toJSON()
      });
    } catch (error) {
      console.error('Assign lead error:', error);
      res.status(500).json({
        error: 'Lead assignment failed',
        message: 'Unable to assign lead'
      });
    }
  }
);

/**
 * DELETE /leads/:id
 * Delete lead
 */
router.delete('/:id',
  validateUuidParam,
  async (req, res) => {
    try {
      const success = await Lead.delete(req.params.id, req.organizationId);

      if (!success) {
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      res.json({
        message: 'Lead deleted successfully'
      });
    } catch (error) {
      console.error('Delete lead error:', error);
      console.error('Error code:', error.code);
      console.error('Error detail:', error.detail);

      // Check if it's a foreign key constraint error
      if (error.code === '23503') {
        return res.status(400).json({
          error: 'Cannot delete lead',
          message: 'This lead cannot be deleted because it has related records. Please delete or reassign related items first.',
          detail: error.detail
        });
      }

      res.status(500).json({
        error: 'Lead deletion failed',
        message: error.message || 'Unable to delete lead',
        detail: process.env.NODE_ENV === 'development' ? error.detail : undefined
      });
    }
  }
);

/**
 * PATCH /leads/:id/status
 * Update lead status (for Kanban drag-and-drop)
 */
router.patch('/:id/status',
  validateUuidParam,
  async (req, res) => {
    try {
      const { status } = req.body;

      // Validate status dynamically based on field configuration
      const fieldConfigs = await getSystemFieldConfigurations(req.organizationId);
      const statusConfig = fieldConfigs.find(f => f.field_name === 'status');

      let validStatuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost']; // Fallback
      if (statusConfig && statusConfig.field_options && Array.isArray(statusConfig.field_options)) {
        validStatuses = statusConfig.field_options.map(opt =>
          typeof opt === 'string' ? opt : opt.value
        );
      }

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          message: 'Status must be one of: ' + validStatuses.join(', ')
        });
      }

      const lead = await Lead.update(req.params.id, { status }, req.organizationId);

      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      res.json({
        message: 'Lead status updated successfully',
        lead: lead.toJSON()
      });
    } catch (error) {
      console.error('Update lead status error:', error);
      res.status(500).json({
        error: 'Status update failed',
        message: 'Unable to update lead status'
      });
    }
  }
);


/**
 * PATCH /leads/bulk
 * Bulk update multiple leads
 */
router.patch('/bulk', async (req, res) => {
  try {
    const { leadIds, updates } = req.body;

    if (!Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({
        error: 'Invalid lead IDs',
        message: 'leadIds must be a non-empty array'
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No updates provided',
        message: 'updates object cannot be empty'
      });
    }

    const updatedLeads = [];
    const errors = [];

    for (const leadId of leadIds) {
      try {
        const lead = await Lead.update(leadId, updates, req.organizationId);
        if (lead) {
          updatedLeads.push(lead.toJSON());
        } else {
          errors.push({ leadId, error: 'Lead not found' });
        }
      } catch (error) {
        errors.push({ leadId, error: error.message });
      }
    }

    res.json({
      message: `Bulk update completed. ${updatedLeads.length} leads updated.`,
      updatedLeads,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Bulk update error:', error);
    res.status(500).json({
      error: 'Bulk update failed',
      message: 'Unable to update leads'
    });
  }
});

/**
 * GET /leads/export
 * Export leads data as CSV
 */
router.get('/export', async (req, res) => {
  try {
    const { leadIds, ...filters } = req.query;

    let whereConditions = ['organization_id = $1'];
    let queryParams = [req.organizationId];
    let paramIndex = 2;

    // If specific lead IDs are provided
    if (leadIds) {
      const ids = Array.isArray(leadIds) ? leadIds : leadIds.split(',');
      whereConditions.push(`id = ANY($${paramIndex})`);
      queryParams.push(ids);
      paramIndex++;
    }

    // Add other filters
    if (filters.status) {
      whereConditions.push(`status = $${paramIndex}`);
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters.priority) {
      whereConditions.push(`priority = $${paramIndex}`);
      queryParams.push(filters.priority);
      paramIndex++;
    }

    if (filters.assigned_to && filters.assigned_to !== 'unassigned') {
      whereConditions.push(`assigned_to = $${paramIndex}`);
      queryParams.push(filters.assigned_to);
      paramIndex++;
    } else if (filters.assigned_to === 'unassigned') {
      whereConditions.push('assigned_to IS NULL');
    }

    const whereClause = whereConditions.join(' AND ');

    const leads = await db.query(`
      SELECT l.*, u.first_name as assigned_first_name, u.last_name as assigned_last_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id AND u.organization_id = l.organization_id
      WHERE ${whereClause}
      ORDER BY l.created_at DESC
    `, queryParams);

    // Generate CSV
    const csvHeaders = [
      'ID', 'First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Source',
      'Status', 'Priority', 'Value', 'Assigned To', 'Notes', 'Created At', 'Updated At'
    ];

    const csvRows = leads.rows.map(lead => [
      lead.id,
      lead.first_name || '',
      lead.last_name || '',
      lead.email || '',
      lead.phone || '',
      lead.company || '',
      lead.source || '',
      lead.status || '',
      lead.priority || '',
      lead.value || '',
      lead.assigned_first_name && lead.assigned_last_name
        ? `${lead.assigned_first_name} ${lead.assigned_last_name}`
        : '',
      lead.notes || '',
      lead.created_at,
      lead.updated_at
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    res.send(csvContent);
  } catch (error) {
    console.error('Export leads error:', error);
    res.status(500).json({
      error: 'Export failed',
      message: 'Unable to export leads'
    });
  }
});

/**
 * GET /lead-statuses
 * Get available lead statuses
 */
router.get('/lead-statuses', async (req, res) => {
  try {
    const statuses = [
      { value: 'new', label: 'New', color: 'blue' },
      { value: 'contacted', label: 'Contacted', color: 'yellow' },
      { value: 'qualified', label: 'Qualified', color: 'purple' },
      { value: 'proposal', label: 'Proposal', color: 'indigo' },
      { value: 'negotiation', label: 'Negotiation', color: 'pink' },
      { value: 'converted', label: 'Converted', color: 'green' },
      { value: 'lost', label: 'Lost', color: 'red' }
    ];

    res.json({ statuses });
  } catch (error) {
    console.error('Get lead statuses error:', error);
    res.status(500).json({
      error: 'Failed to get statuses',
      message: 'Unable to retrieve lead statuses'
    });
  }
});

/**
 * GET /leads/form-config
 * Get form configuration for dynamic form rendering
 */
router.get('/form-config', authenticateToken, async (req, res) => {
  try {
    const fieldConfigs = await getFieldConfigurations(req.organizationId);
    res.json(fieldConfigs);
  } catch (error) {
    console.error('Error fetching form config:', error);
    res.status(500).json({ error: 'Failed to fetch form configuration' });
  }
});

// Import lead controller for detailed functionality
const leadController = require('../controllers/leadController');

/**
 * GET /leads/:id/detail
 * Get detailed lead with activities and history
 */
router.get('/:id/detail',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  leadController.getLeadDetail
);

/**
 * GET /leads/:id/activities
 * Get lead activity timeline
 */
router.get('/:id/activities',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  leadController.getLeadActivities
);

/**
 * POST /leads/:id/activities
 * Add new activity to lead
 */
router.post('/:id/activities',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  validate(Joi.object({
    interaction_type: Joi.string().valid('email', 'call', 'meeting', 'note', 'task').required(),
    subject: Joi.string().max(255).required(),
    description: Joi.string().allow(''),
    outcome: Joi.string().max(100),
    duration: Joi.number().integer().min(0),
    scheduled_at: Joi.date().iso(),
    participants: Joi.array().items(Joi.string()),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    activity_metadata: Joi.object()
  })),
  leadController.addActivity
);

/**
 * GET /leads/:id/history
 * Get lead change history
 */
router.get('/:id/history',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  leadController.getLeadHistory
);

/**
 * PUT /leads/:id/status
 * Update lead status (for progress bar)
 */
router.put('/:id/status',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  validate(Joi.object({
    status: Joi.string().required(),
    reason: Joi.string().max(500)
  })),
  leadController.updateLeadStatus
);

/**
 * POST /leads/:id/follow
 * Follow/unfollow lead
 */
router.post('/:id/follow',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  leadController.toggleFollowLead
);

/**
 * GET /leads/:id/duplicates
 * Get potential duplicates for a lead
 */
router.get('/:id/duplicates',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  leadController.getLeadDuplicates
);

/**
 * POST /leads/:id/detect-duplicates
 * Detect and store potential duplicates
 */
router.post('/:id/detect-duplicates',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  leadController.detectDuplicates
);

/**
 * GET /leads/:id/status-progression
 * Get lead status progression data
 */
router.get('/:id/status-progression',
  authenticateToken,
  validateOrganizationContext,
  validateUuidParam,
  leadController.getLeadStatusProgression
);

/**
 * POST /leads/:id/conversion-preview
 * Generate a preview of field mappings for conversion modal
 */
router.post('/:id/conversion-preview',
  validateUuidParam,
  validate({
    body: Joi.object({
      templateId: Joi.string().guid({ version: 'uuidv4' }).optional()
    }).unknown(false)
  }),
  async (req, res) => {
    try {
      const fieldMappingService = require('../services/fieldMappingService');

      const preview = await fieldMappingService.generateConversionPreview(
        req.organizationId,
        req.params.id,
        req.body.templateId
      );

      res.json({
        success: true,
        data: preview
      });
    } catch (error) {
      console.error('Error generating conversion preview:', error);
      res.status(500).json({
        error: 'Preview generation failed',
        message: error.message
      });
    }
  }
);

/**
 * POST /leads/:id/convert
 * Convert a lead to a contact (and optionally create an account)
 * Enhanced with field mapping support
 */
router.post('/:id/convert',
  validateUuidParam,
  validate({
    body: Joi.object({
      createAccount: Joi.boolean().default(false).optional(),
      accountDetails: Joi.object({
        accountName: Joi.string().max(255).optional(),
        edition: Joi.string().max(100).optional(),
        deviceName: Joi.string().max(255).optional(),
        macAddress: Joi.string().max(17).optional(),
        billingCycle: Joi.string().valid('monthly', 'quarterly', 'semi-annual', 'annual', 'biennial').optional(),
        term: Joi.string().valid('1', '3', '6', '12', '24').optional(), // Standardized numeric months
        price: Joi.number().min(0).optional(),
        isTrial: Joi.boolean().default(false).optional(),
        productId: Joi.string().guid({ version: 'uuidv4' }).optional()
      }).optional(),
      transactionDetails: Joi.object({
        paymentMethod: Joi.string().max(50).default('Credit Card'),
        term: Joi.string().max(50).optional(),
        amount: Joi.number().min(0).required(),
        currency: Joi.string().max(10).default('USD'),
        status: Joi.string().valid('completed', 'pending', 'failed', 'refunded').default('completed')
      }).optional(),
      existingContactId: Joi.string().guid({ version: 'uuidv4' }).optional(),
      relationshipType: Joi.string().valid('new_customer', 'existing_customer', 'additional_device').default('new_customer').optional(),
      interestType: Joi.string().valid('first_account', 'additional_device', 'upgrade').optional(),
      templateId: Joi.string().guid({ version: 'uuidv4' }).optional() // Field mapping template
    }).unknown(false)
  }),
  async (req, res) => {
    console.log('🔄 Lead conversion started (with field mapping support)');
    console.log('Lead ID:', req.params.id);
    console.log('Organization ID:', req.organizationId);
    console.log('User ID:', req.user.id);
    console.log('Request body:', req.body);

    // Import the enhanced conversion service
    const leadConversionService = require('../services/leadConversionService');

    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');
      console.log('✅ Transaction started');

      await client.query(
        "SELECT set_config('app.current_organization_id', $1, true)",
        [req.organizationId]
      );

      await client.query(
        "SELECT set_config('app.current_user_id', $1, true)",
        [req.user.id]
      );
      console.log('✅ Session variables set');


      // Use the enhanced conversion service with field mapping support
      const result = await leadConversionService.convertLeadWithMappings(
        req.organizationId,
        req.params.id,
        req.user.id,
        {
          createAccount: req.body.createAccount,
          accountDetails: req.body.accountDetails,
          transactionDetails: req.body.transactionDetails,
          existingContactId: req.body.existingContactId,
          relationshipType: req.body.relationshipType,
          interestType: req.body.interestType,
          templateId: req.body.templateId
        },
        client
      );

      const { contact, account, isNewContact, usedFieldMappings } = result;

      await client.query('COMMIT');
      console.log('✅ Transaction committed successfully');

      const response = {
        message: isNewContact ? 'Lead converted to new contact successfully' : 'Lead linked to existing contact successfully',
        contact: {
          id: contact.id,
          firstName: contact.first_name,
          lastName: contact.last_name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          status: contact.contact_status
        },
        account: account ? {
          id: account.id,
          accountName: account.account_name,
          edition: account.edition,
          accountType: account.account_type,
          isTrial: account.is_trial,
          productId: account.product_id
        } : null,
        isNewContact,
        usedFieldMappings
      };

      console.log('📤 Sending response:', response);
      res.status(200).json(response);

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('❌ Lead conversion error:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error code:', error.code);

      if (error.message && error.message.includes('duplicate key')) {
        return res.status(409).json({
          error: 'Conversion failed',
          message: 'A contact with this email already exists'
        });
      }

      if (error.code === '42P01') {
        console.error('❌ Table does not exist!');
        return res.status(500).json({
          error: 'Database table missing',
          message: 'The contacts table does not exist. Please run database migrations.',
          details: error.message
        });
      }

      res.status(500).json({
        error: 'Conversion failed',
        message: 'Unable to convert lead to contact',
        details: error.message // Show details to help debug
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;