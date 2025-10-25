const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, validateOrganizationContext } = require('../middleware/auth');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// Email transporter setup (lazy-loaded)
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
    console.log('📧 sendUserNotificationEmail called with lead:', leadData.leadId, 'to:', assignedUserEmail);
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

    console.log('📧 Sending user notification...');
    const info = await getTransporter().sendMail(mailOptions);
    console.log(`✅ Notification email sent to user: ${assignedUserEmail}`, info);
    return true;
  } catch (error) {
    console.error(`❌ Error sending user notification email:`, error.message);
    console.error(`❌ Error stack:`, error.stack);
    return false;
  }
}

// Add this helper function at the top after imports
const ensureTablesExist = async () => {
  try {
    console.log('🔧 Ensuring custom field tables exist...');

    // Create custom field definitions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS custom_field_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        entity_type VARCHAR(50) DEFAULT 'leads',
        field_name VARCHAR(50) NOT NULL,
        field_label VARCHAR(100) NOT NULL,
        field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'select', 'number', 'date', 'email', 'tel', 'textarea', 'url', 'datetime', 'multiselect', 'checkbox', 'radio', 'phone')),
        field_options JSONB,
        is_required BOOLEAN DEFAULT FALSE,
        is_enabled BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES users(id),

        UNIQUE(organization_id, entity_type, field_name),
        CONSTRAINT field_name_length CHECK (length(field_name) <= 50),
        CONSTRAINT field_label_length CHECK (length(field_label) <= 100),
        CONSTRAINT valid_entity_type CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions'))
      );
    `);

    // Add entity_type column if it doesn't exist (for existing tables)
    await db.query(`
      ALTER TABLE custom_field_definitions
      ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'leads';
    `);

    // Add is_enabled column if it doesn't exist (for existing tables)
    await db.query(`
      ALTER TABLE custom_field_definitions
      ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE;
    `);

    // Add sort_order column if it doesn't exist (for existing tables)
    await db.query(`
      ALTER TABLE custom_field_definitions
      ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    `);

    // Add constraint for entity_type if it doesn't exist
    await db.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'valid_entity_type'
        ) THEN
          ALTER TABLE custom_field_definitions
          ADD CONSTRAINT valid_entity_type CHECK (entity_type IN ('leads', 'contacts', 'accounts', 'transactions'));
        END IF;
      END $$;
    `);

    // Migrate existing fields: duplicate them for all entity types
    // This only runs once - it checks if there are fields with entity_type='leads' that don't have copies for other entities
    console.log('🔄 Starting field migration check...');
    const existingLeadFields = await db.query(`
      SELECT DISTINCT field_name, field_label, field_type, field_options, is_required, organization_id
      FROM custom_field_definitions
      WHERE entity_type = 'leads'
    `);

    console.log(`📋 Found ${existingLeadFields.rows.length} lead fields to potentially duplicate`);
    if (existingLeadFields.rows.length > 0) {
      console.log(`📝 Lead field names:`, existingLeadFields.rows.map(f => f.field_name).join(', '));

      for (const field of existingLeadFields.rows) {
        console.log(`🔍 Processing field: ${field.field_name} for org: ${field.organization_id}`);
        for (const entityType of ['contacts', 'accounts', 'transactions']) {
          // Check if this field already exists for this entity type
          const exists = await db.query(`
            SELECT id FROM custom_field_definitions
            WHERE organization_id = $1 AND field_name = $2 AND entity_type = $3
          `, [field.organization_id, field.field_name, entityType]);

          if (exists.rows.length === 0) {
            // Create the field for this entity type
            try {
              await db.query(`
                INSERT INTO custom_field_definitions
                (organization_id, entity_type, field_name, field_label, field_type, field_options, is_required)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
              `, [field.organization_id, entityType, field.field_name, field.field_label, field.field_type, field.field_options, field.is_required]);
              console.log(`✅ Duplicated field '${field.field_name}' for ${entityType}`);
            } catch (err) {
              console.log(`⚠️ Could not duplicate field '${field.field_name}' for ${entityType}:`, err.message);
            }
          } else {
            console.log(`⏭️ Field '${field.field_name}' already exists for ${entityType}, skipping`);
          }
        }
      }
    }
    console.log('✅ Field migration check complete');

    // Create default field configurations table
    await db.query(`
      CREATE TABLE IF NOT EXISTS default_field_configurations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        field_name VARCHAR(50) NOT NULL,
        field_options JSONB,
        is_enabled BOOLEAN DEFAULT TRUE,
        is_required BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        UNIQUE(organization_id, field_name)
      );
    `);

    // Add field_options column if it doesn't exist (for existing tables)
    await db.query(`
      ALTER TABLE default_field_configurations
      ADD COLUMN IF NOT EXISTS field_options JSONB;
    `);

    // Create organization usage tracking table
    await db.query(`
      CREATE TABLE IF NOT EXISTS organization_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        custom_fields_count INTEGER DEFAULT 0,
        contacts_count INTEGER DEFAULT 0,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        UNIQUE(organization_id)
      );
    `);

    // Enable RLS on new tables
    await db.query(`
      ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE default_field_configurations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
    `);

    // Create RLS policies
    await db.query(`
      DROP POLICY IF EXISTS custom_fields_isolation ON custom_field_definitions;
      CREATE POLICY custom_fields_isolation ON custom_field_definitions
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);

    await db.query(`
      DROP POLICY IF EXISTS default_fields_isolation ON default_field_configurations;
      CREATE POLICY default_fields_isolation ON default_field_configurations
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);

    await db.query(`
      DROP POLICY IF EXISTS usage_isolation ON organization_usage;
      CREATE POLICY usage_isolation ON organization_usage
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);

    console.log('✅ Custom field tables ensured');
  } catch (error) {
    console.log('⚠️ Table creation error (may already exist):', error.message);
  }
};

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
  entity_type: Joi.string()
    .valid('leads', 'contacts', 'accounts', 'transactions')
    .default('leads'),
  field_name: Joi.string()
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .required()
    .messages({
      'string.pattern.base': 'Field name can only contain letters, numbers, and underscores'
    }),
  field_label: Joi.string().max(100).required(),
  field_type: Joi.string()
    .valid('text', 'select', 'number', 'date', 'email', 'tel', 'textarea', 'url', 'datetime', 'multiselect', 'checkbox', 'radio', 'phone')
    .required(),
  field_options: Joi.when('field_type', {
    is: Joi.string().valid('select', 'multiselect', 'radio'),
    then: Joi.array().items(
      Joi.object({
        value: Joi.string().required(),
        label: Joi.string().required()
      })
    ).min(1).max(20).required(),
    otherwise: Joi.array().optional()
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

// Debug endpoint to check authentication
router.get('/debug', async (req, res) => {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      authentication: {
        userExists: !!req.user,
        userId: req.user?.id,
        userEmail: req.user?.email,
        organizationId: req.organizationId,
        userOrganizationId: req.user?.organization_id
      },
      headers: {
        authorization: req.headers.authorization ? 'Bearer ***' : 'MISSING',
        organizationSlug: req.headers['x-organization-slug'],
        contentType: req.headers['content-type']
      },
      database: {
        connectionExists: !!db
      }
    };

    // Test a simple database query
    try {
      const testQuery = await db.query('SELECT NOW() as current_time');
      debugInfo.database.queryTest = 'SUCCESS';
      debugInfo.database.currentTime = testQuery.rows[0]?.current_time;
    } catch (dbError) {
      debugInfo.database.queryTest = 'FAILED';
      debugInfo.database.error = dbError.message;
    }

    res.json(debugInfo);
  } catch (error) {
    res.status(500).json({
      error: 'Debug endpoint failed',
      details: error.message,
      stack: error.stack
    });
  }
});

// Get all custom fields and configuration
router.get('/', async (req, res) => {
  try {
    const { entity_type = 'leads' } = req.query;

    console.log('🔍 Custom fields GET request debugging:');
    console.log('  - req.user:', req.user ? 'EXISTS' : 'NULL');
    console.log('  - req.organizationId:', req.organizationId);
    console.log('  - entity_type:', entity_type);
    console.log('  - Headers Authorization:', req.headers.authorization ? 'EXISTS' : 'MISSING');
    console.log('  - Headers X-Organization-Slug:', req.headers['x-organization-slug']);

    if (!req.organizationId) {
      console.error('❌ Missing organizationId in request');
      return res.status(400).json({
        error: 'Missing organization context',
        details: 'Organization ID is required'
      });
    }

    // Validate entity_type
    const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions'];
    if (!validEntityTypes.includes(entity_type)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        details: `entity_type must be one of: ${validEntityTypes.join(', ')}`
      });
    }

    // Ensure tables exist before querying
    await ensureTablesExist();

    // Get custom fields
    console.log('📝 Querying custom_field_definitions...');

    // First check which columns exist
    const columnsCheck = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'custom_field_definitions'
    `);
    const availableColumns = columnsCheck.rows.map(r => r.column_name);
    const hasIsEnabled = availableColumns.includes('is_enabled');
    const hasSortOrder = availableColumns.includes('sort_order');
    const hasEntityType = availableColumns.includes('entity_type');

    console.log('📝 Available columns:', availableColumns);

    // Build query with only available columns
    let selectColumns = 'id, field_name, field_label, field_type, field_options, is_required, created_at';
    if (hasIsEnabled) selectColumns += ', is_enabled';
    if (hasSortOrder) selectColumns += ', sort_order';
    if (hasEntityType) selectColumns += ', entity_type';

    const orderBy = hasSortOrder ? 'ORDER BY sort_order ASC, created_at ASC' : 'ORDER BY created_at ASC';

    // Filter by entity_type if column exists
    const whereClause = hasEntityType
      ? 'WHERE organization_id = $1 AND entity_type = $2'
      : 'WHERE organization_id = $1';

    const queryParams = hasEntityType ? [req.organizationId, entity_type] : [req.organizationId];

    const customFields = await db.query(`
      SELECT ${selectColumns}
      FROM custom_field_definitions
      ${whereClause}
      ${orderBy}
    `, queryParams);

    console.log('Custom fields found:', customFields.rows.length);

    // Normalize customFields to add missing columns with defaults
    customFields.rows = customFields.rows.map(field => ({
      ...field,
      is_enabled: field.is_enabled !== undefined ? field.is_enabled : true,
      sort_order: field.sort_order !== undefined ? field.sort_order : 0
    }));

    // Build system fields from defaults + stored configurations
    // Define entity-specific system fields
    const systemFieldsByEntity = {
      leads: {
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
        assignedTo: { label: 'Assign To', type: 'user_select', required: false, editable: true },
        nextFollowUp: { label: 'Next Follow Up', type: 'date', required: false, editable: true },
        notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
      },
      contacts: {
        firstName: { label: 'First Name', type: 'text', required: true, editable: false },
        lastName: { label: 'Last Name', type: 'text', required: true, editable: false },
        email: { label: 'Email', type: 'email', required: false, editable: true },
        phone: { label: 'Phone', type: 'tel', required: false, editable: true },
        company: { label: 'Company', type: 'text', required: false, editable: true },
        title: { label: 'Job Title', type: 'text', required: false, editable: true },
        department: { label: 'Department', type: 'text', required: false, editable: true },
        linkedIn: { label: 'LinkedIn Profile', type: 'url', required: false, editable: true },
        status: {
          label: 'Status',
          type: 'select',
          required: false,
          editable: true,
          options: ['active', 'inactive', 'prospect']
        },
        assignedTo: { label: 'Assign To', type: 'user_select', required: false, editable: true },
        lastContactDate: { label: 'Last Contact Date', type: 'date', required: false, editable: true },
        notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
      },
      accounts: {
        companyName: { label: 'Company Name', type: 'text', required: true, editable: false },
        industry: { label: 'Industry', type: 'text', required: false, editable: true },
        website: { label: 'Website', type: 'url', required: false, editable: true },
        phone: { label: 'Phone', type: 'tel', required: false, editable: true },
        email: { label: 'Email', type: 'email', required: false, editable: true },
        address: { label: 'Address', type: 'text', required: false, editable: true },
        city: { label: 'City', type: 'text', required: false, editable: true },
        state: { label: 'State', type: 'text', required: false, editable: true },
        country: { label: 'Country', type: 'text', required: false, editable: true },
        employeeCount: { label: 'Employee Count', type: 'number', required: false, editable: true },
        annualRevenue: { label: 'Annual Revenue ($)', type: 'number', required: false, editable: true },
        assignedTo: { label: 'Account Owner', type: 'user_select', required: false, editable: true },
        notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
      },
      transactions: {
        dealName: { label: 'Deal Name', type: 'text', required: true, editable: false },
        amount: { label: 'Amount ($)', type: 'number', required: false, editable: true },
        stage: {
          label: 'Stage',
          type: 'select',
          required: false,
          editable: true,
          options: ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost']
        },
        probability: { label: 'Probability (%)', type: 'number', required: false, editable: true },
        expectedCloseDate: { label: 'Expected Close Date', type: 'date', required: false, editable: true },
        actualCloseDate: { label: 'Actual Close Date', type: 'date', required: false, editable: true },
        account: { label: 'Account', type: 'text', required: false, editable: true },
        contact: { label: 'Contact', type: 'text', required: false, editable: true },
        source: {
          label: 'Source',
          type: 'select',
          required: false,
          editable: true,
          options: ['Inbound', 'Outbound', 'Partner', 'Referral', 'Event']
        },
        assignedTo: { label: 'Deal Owner', type: 'user_select', required: false, editable: true },
        notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
      }
    };

    const systemFieldDefaults = systemFieldsByEntity[entity_type] || systemFieldsByEntity.leads;

    // Get any stored configurations for system fields
    let storedConfigs = {};
    try {
      const configResult = await db.query(`
        SELECT field_name, field_options, is_enabled, is_required, sort_order
        FROM default_field_configurations
        WHERE organization_id = $1 AND entity_type = $2
      `, [req.organizationId, entity_type]);

      configResult.rows.forEach(config => {
        storedConfigs[config.field_name] = config;
      });
      console.log('Stored system field configs found for', entity_type, ':', Object.keys(storedConfigs).length);
    } catch (configError) {
      console.log('No stored system field configs found for', entity_type, ':', configError.message);
    }

    // Build complete system fields list
    const systemFields = { rows: [] };
    Object.entries(systemFieldDefaults).forEach(([fieldName, fieldDef]) => {
      const storedConfig = storedConfigs[fieldName] || {};

      // Use stored field options if they exist, otherwise use defaults
      let fieldOptions = fieldDef.options || null;
      if (storedConfig.field_options) {
        fieldOptions = storedConfig.field_options;
      }

      systemFields.rows.push({
        field_name: fieldName,
        field_label: fieldDef.label,
        field_type: fieldDef.type,
        field_options: fieldOptions,
        is_enabled: storedConfig.is_enabled !== undefined ? storedConfig.is_enabled : true,
        is_required: storedConfig.is_required !== undefined ? storedConfig.is_required : fieldDef.required,
        is_deleted: false,
        sort_order: storedConfig.sort_order || 0,
        editable: fieldDef.editable
      });
    });

    console.log('System fields built:', systemFields.rows.length);

    // Get default field configurations (for backward compatibility)
    let defaultFields = { rows: [] };
    try {
      defaultFields = await db.query(`
        SELECT field_name, is_enabled, is_required, sort_order
        FROM default_field_configurations
        WHERE organization_id = $1
      `, [req.organizationId]);
      console.log('Default fields found:', defaultFields.rows.length);
    } catch (defaultError) {
      console.log('Default fields table not found, using empty array');
    }

    // Get usage statistics
    let usage = { rows: [{ custom_fields_count: 0, contacts_count: 0 }] };
    try {
      const usageResult = await db.query(`
        SELECT custom_fields_count, contacts_count
        FROM organization_usage
        WHERE organization_id = $1
      `, [req.organizationId]);
      if (usageResult.rows.length > 0) {
        usage = usageResult;
      }
      console.log('Usage stats:', usage.rows[0]);
    } catch (usageError) {
      console.log('Usage table not found, using defaults');
    }

    const response = {
      customFields: customFields.rows,
      systemFields: systemFields.rows,
      defaultFields: defaultFields.rows, // Keep for backward compatibility
      usage: usage.rows[0] || { custom_fields_count: 0, contacts_count: 0 },
      limits: {
        maxCustomFields: 15,
        maxContacts: 5000,
        maxFieldOptions: 20
      }
    };

    console.log('Sending response with keys:', Object.keys(response));
    res.json(response);
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      error: 'Failed to fetch custom fields',
      details: error.message
    });
  }
});

// Create new custom field
router.post('/', fieldCreationLimit, async (req, res) => {
  try {
    // Ensure tables exist before attempting to insert
    await ensureTablesExist();

    const { error, value } = createFieldSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { field_name, field_label, field_type, field_options, is_required, entity_type = 'leads' } = value;

    // Validate entity_type
    const validEntityTypes = ['leads', 'contacts', 'accounts', 'transactions'];
    if (!validEntityTypes.includes(entity_type)) {
      return res.status(400).json({
        error: 'Invalid entity type',
        details: `entity_type must be one of: ${validEntityTypes.join(', ')}`
      });
    }

    // Check if field name already exists for this entity type
    const existingField = await db.query(`
      SELECT id FROM custom_field_definitions
      WHERE organization_id = $1 AND field_name = $2 AND entity_type = $3
    `, [req.organizationId, field_name, entity_type]);

    if (existingField.rows.length > 0) {
      return res.status(400).json({ error: `Field name already exists for ${entity_type}` });
    }

    // Check against system field names
    const systemFields = ['firstName', 'lastName', 'email', 'phone', 'company', 'source', 'status', 'priority'];
    if (systemFields.includes(field_name)) {
      return res.status(400).json({ error: 'Field name conflicts with system field' });
    }

    const result = await db.query(`
      INSERT INTO custom_field_definitions
      (organization_id, entity_type, field_name, field_label, field_type, field_options, is_required, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, entity_type, field_name, field_label, field_type, field_options, is_required, is_enabled, created_at
    `, [req.organizationId, entity_type, field_name, field_label, field_type, field_options, is_required, req.userId]);

    res.status(201).json({
      message: 'Custom field created successfully',
      field: result.rows[0]
    });
  } catch (error) {
    console.error('❌ Error creating custom field:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    if (error.message.includes('Custom field limit exceeded')) {
      return res.status(403).json({ error: error.message });
    }
    res.status(500).json({
      error: 'Failed to create custom field',
      details: error.message
    });
  }
});

// Update custom field
router.put('/:fieldId', async (req, res) => {
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
router.delete('/:fieldId', async (req, res) => {
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
router.put('/default/:fieldName', async (req, res) => {
  try {
    console.log('🔧 Updating system field:', req.params.fieldName);
    console.log('🔧 Request body:', req.body);
    console.log('🔧 Organization ID:', req.organizationId);

    await ensureTablesExist();

    const { is_enabled, is_required, is_deleted, field_options, field_label, field_type, entity_type } = req.body;
    const { fieldName } = req.params;

    // entity_type is required for proper field isolation
    if (!entity_type) {
      return res.status(400).json({ error: 'entity_type is required' });
    }

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
      assignedTo: { label: 'Assign To', type: 'user_select', required: false, editable: true },
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

    // For system fields, we'll store the configuration in default_field_configurations
    // and store any custom options/settings in a JSON format
    const fieldConfig = {
      label: field_label || fieldDefault.label,
      type: field_type || fieldDefault.type,
      options: field_options || fieldDefault.options || null,
      is_enabled: is_enabled !== undefined ? is_enabled : true,
      is_required: is_required !== undefined ? is_required : fieldDefault.required,
      is_deleted: is_deleted !== undefined ? is_deleted : false
    };

    console.log('🔧 Storing field config:', fieldConfig);

    const result = await db.query(`
      INSERT INTO default_field_configurations
      (organization_id, field_name, entity_type, field_options, is_enabled, is_required, sort_order, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (organization_id, field_name, entity_type)
      DO UPDATE SET
        field_options = EXCLUDED.field_options,
        is_enabled = EXCLUDED.is_enabled,
        is_required = EXCLUDED.is_required,
        sort_order = EXCLUDED.sort_order,
        updated_at = NOW()
      RETURNING field_name, field_options, is_enabled, is_required, sort_order
    `, [
      req.organizationId,
      fieldName,
      entity_type,
      JSON.stringify(fieldConfig.options),
      fieldConfig.is_enabled,
      fieldConfig.is_required,
      0 // default sort order
    ]);

    // Store the complete field configuration (including options) in a separate way
    // For now, we'll return the basic config and handle options in memory
    const responseField = {
      field_name: fieldName,
      field_label: fieldConfig.label,
      field_type: fieldConfig.type,
      field_options: fieldConfig.options,
      is_enabled: fieldConfig.is_enabled,
      is_required: fieldConfig.is_required,
      is_deleted: fieldConfig.is_deleted,
      sort_order: 0
    };

    res.json({
      message: 'System field configuration updated',
      field: responseField
    });
  } catch (error) {
    console.error('Error updating system field:', error);
    res.status(500).json({ error: 'Failed to update system field configuration' });
  }
});

// Create lead endpoint (temporary workaround for authentication issues)
router.post('/create-lead', async (req, res) => {
  try {
    // Support both camelCase and snake_case field names
    const {
      firstName, lastName, email, phone, company, source,
      status, priority, potentialValue, assignedTo, nextFollowUp, notes,
      first_name, last_name, potential_value, assigned_to, next_follow_up,
      customFields = {}
    } = req.body;

    // Use snake_case if provided, otherwise fall back to camelCase
    const finalFirstName = first_name || firstName;
    const finalLastName = last_name || lastName;
    const finalPotentialValue = potential_value !== undefined ? potential_value : (potentialValue || 0);
    const finalAssignedTo = assigned_to || assignedTo;
    const finalNextFollowUp = next_follow_up || nextFollowUp;

    // Validate required fields
    if (!finalFirstName || !finalLastName) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'First name and last name are required',
        received: req.body
      });
    }

    console.log('🔍 Creating lead with:', {
      organizationId: req.organizationId,
      userId: req.user.id,
      firstName: finalFirstName,
      lastName: finalLastName,
      email, phone, company, source,
      status: status || 'new',
      priority: priority || 'medium',
      potentialValue: finalPotentialValue,
      assignedTo: finalAssignedTo,
      nextFollowUp: finalNextFollowUp,
      notes
    });

    // Create the lead
    const result = await db.query(`
      INSERT INTO leads
      (organization_id, first_name, last_name, email, phone, company, source,
       status, priority, value, assigned_to, next_follow_up, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, first_name, last_name, email, phone, company, source, status,
                priority, value, assigned_to, next_follow_up, notes, created_at
    `, [
      req.organizationId, finalFirstName, finalLastName, email || null, phone || null, company || null, source || null,
      status || 'new', priority || 'medium', finalPotentialValue,
      finalAssignedTo || null, finalNextFollowUp || null, notes || null,
      req.user.id
    ], req.organizationId);

    const createdLead = result.rows[0];

    // Send emails (fire-and-forget)
    (async () => {
      try {
        console.log('📧 Starting email sending process...');
        console.log('📧 Lead email:', createdLead.email);
        console.log('📧 Assigned to:', finalAssignedTo);

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
        if (finalAssignedTo) {
          console.log('📧 Looking up assigned user email for ID:', finalAssignedTo);
          const userResult = await db.query(
            'SELECT email FROM users WHERE id = $1',
            [finalAssignedTo],
            req.organizationId
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
              value: createdLead.value,
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
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      stack: error.stack
    });
    res.status(500).json({
      error: 'Failed to create lead',
      message: error.message,
      details: error.detail || error.code
    });
  }
});

// Get users for assignment dropdown
router.get('/users-for-assignment', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT id, first_name, last_name, email,
             (first_name || ' ' || last_name) as full_name
      FROM users
      WHERE organization_id = $1 AND is_active = true
      ORDER BY first_name ASC, last_name ASC
    `, [req.organizationId], req.organizationId);

    res.json({
      users: users.rows.map(user => ({
        id: user.id,
        value: user.id,
        label: user.full_name || `${user.first_name} ${user.last_name}`,
        email: user.email
      }))
    });
  } catch (error) {
    console.error('Error getting users for assignment:', error);
    res.status(500).json({
      error: 'Failed to retrieve users',
      message: 'Unable to get users for assignment'
    });
  }
});

// Get form configuration for dynamic form rendering (updated version)
router.get('/form-config', async (req, res) => {
  try {
    await ensureTablesExist();

    console.log('🔍 Form config request for organization:', req.organizationId);

    // Get custom fields (without is_enabled filter for schema compatibility)
    let customFields = { rows: [] };
    try {
      customFields = await db.query(`
        SELECT field_name, field_label, field_type, field_options, is_required, created_at
        FROM custom_field_definitions
        WHERE organization_id = $1
        ORDER BY created_at ASC
      `, [req.organizationId]);
    } catch (error) {
      console.log('⚠️ Could not fetch custom fields, continuing with empty set:', error.message);
    }

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
      assignedTo: { label: 'Assign To', type: 'user_select', required: false, editable: true },
      nextFollowUp: { label: 'Next Follow Up', type: 'date', required: false, editable: true },
      notes: { label: 'Notes', type: 'textarea', required: false, editable: true }
    };

    // Get any stored configurations for system fields from default_field_configurations
    let storedConfigs = {};
    try {
      const configResult = await db.query(`
        SELECT field_name, field_options, is_enabled, is_required
        FROM default_field_configurations
        WHERE organization_id = $1
      `, [req.organizationId]);

      configResult.rows.forEach(config => {
        storedConfigs[config.field_name] = config;
      });
      console.log('Form config stored configs found:', Object.keys(storedConfigs).length);
    } catch (configError) {
      console.log('No stored system field configs found for form');
    }

    // Build complete system fields list for form (only enabled fields)
    const systemFields = [];
    Object.entries(systemFieldDefaults).forEach(([fieldName, fieldDef]) => {
      const storedConfig = storedConfigs[fieldName] || {};

      // Use stored field options if they exist, otherwise use defaults
      let fieldOptions = fieldDef.options || null;
      if (storedConfig.field_options) {
        fieldOptions = storedConfig.field_options;
      }

      const isEnabled = storedConfig.is_enabled !== undefined ? storedConfig.is_enabled : true;

      // Only include enabled fields in the form
      if (isEnabled) {
        systemFields.push({
          field_name: fieldName,
          field_label: fieldDef.label,
          field_type: fieldDef.type,
          field_options: fieldOptions,
          is_required: storedConfig.is_required !== undefined ? storedConfig.is_required : fieldDef.required,
          is_enabled: true
        });
      }
    });

    console.log('Form config system fields count:', systemFields.length);

    res.json({
      customFields: customFields.rows,
      systemFields: systemFields
    });
  } catch (error) {
    console.error('Error fetching form config:', error);
    res.status(500).json({ error: 'Failed to fetch form configuration' });
  }
});

module.exports = router;