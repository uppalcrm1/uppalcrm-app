const express = require('express');
const Contact = require('../models/Contact');
const { findByOrganizationSafe } = require('../models/Contact-Safe');
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
const { sanitizeUUID, sanitizeUUIDs } = require('../utils/sanitizeUUID');

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// Contact validation schemas
const contactSchemas = {
  createContact: {
    body: Joi.object({
      title: Joi.string().max(100).allow('').optional(),
      company: Joi.string().max(255).allow('').optional(),
      first_name: Joi.string().min(1).max(100).required(),
      last_name: Joi.string().min(1).max(100).required(),
      email: Joi.string().email().allow('').optional(),
      phone: Joi.string().max(50).allow('').optional(),
      status: Joi.string().valid('active', 'inactive', 'prospect', 'customer').default('active'),
      type: Joi.string().valid('customer', 'prospect', 'partner', 'vendor').default('customer'),
      source: Joi.string().valid('website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other').allow('').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
      value: Joi.number().min(0).default(0),
      notes: Joi.string().allow('').optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow(null).optional(),
      next_follow_up: Joi.date().iso().allow(null).optional()
    })
  },
  
  updateContact: {
    body: Joi.object({
      title: Joi.string().max(100).allow('').optional(),
      company: Joi.string().max(255).allow('').optional(),
      first_name: Joi.string().min(1).max(100).optional(),
      last_name: Joi.string().min(1).max(100).optional(),
      email: Joi.string().email().allow('').optional(),
      phone: Joi.string().max(50).allow('').optional(),
      status: Joi.string().valid('active', 'inactive', 'prospect', 'customer').optional(),
      type: Joi.string().valid('customer', 'prospect', 'partner', 'vendor').optional(),
      source: Joi.string().valid('website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other').allow('').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').optional(),
      value: Joi.number().min(0).optional(),
      notes: Joi.string().allow('').optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow(null).optional(),
      last_contact_date: Joi.date().iso().allow(null).optional(),
      next_follow_up: Joi.date().iso().allow(null).optional()
    }).unknown(true),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  listContacts: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(10000).default(10000),
      status: Joi.string().valid('active', 'inactive', 'prospect', 'customer').allow('').optional(),
      type: Joi.string().valid('customer', 'prospect', 'partner', 'vendor').allow('').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').allow('').optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow('').optional(),
      source: Joi.string().allow('').optional(),
      search: Joi.string().min(0).max(100).allow('').optional(),
      sort: Joi.string().valid('created_at', 'updated_at', 'first_name', 'last_name', 'company', 'status').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  convertFromLead: {
    params: Joi.object({
      leadId: Joi.string().guid({ version: 'uuidv4' }).required()
    }),
    body: Joi.object({
      // Contact mode: 'new' or 'existing'
      contactMode: Joi.string().valid('new', 'existing').required(),
      existingContactId: Joi.string().guid({ version: 'uuidv4' }).optional().allow(null, ''),
      
      // Contact data (for new contacts)
      contact: Joi.any().optional().allow(null),
      
      // Account creation
      createAccount: Joi.boolean().optional(),
      account: Joi.any().optional().allow(null),
      
      // Transaction creation
      createTransaction: Joi.boolean().optional(),
      transaction: Joi.any().optional().allow(null)
    }).unknown(true)
  },

  createEdition: {
    body: Joi.object({
      name: Joi.string().min(1).max(255).required(),
      version: Joi.string().min(1).max(50).required(),
      description: Joi.string().optional(),
      price: Joi.number().min(0).default(0),
      features: Joi.array().items(Joi.string()).optional(),
      is_active: Joi.boolean().default(true)
    })
  },

  createAccount: {
    body: Joi.object({
      contact_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      account_name: Joi.string().min(1).max(255).required(),
      account_type: Joi.string().valid('business', 'individual', 'government', 'nonprofit').default('business'),
      status: Joi.string().valid('active', 'inactive', 'suspended').default('active'),
      billing_address: Joi.object({
        street: Joi.string().optional(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        zip_code: Joi.string().optional(),
        country: Joi.string().optional()
      }).optional(),
      shipping_address: Joi.object({
        street: Joi.string().optional(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        zip_code: Joi.string().optional(),
        country: Joi.string().optional()
      }).optional(),
      payment_terms: Joi.string().max(100).optional(),
      credit_limit: Joi.number().min(0).default(0)
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  registerDevice: {
    body: Joi.object({
      device_name: Joi.string().max(255).optional(),
      mac_address: Joi.string().pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/).required(),
      device_type: Joi.string().max(100).optional(),
      os_info: Joi.object().optional(),
      hardware_info: Joi.object().optional(),
      license_id: Joi.string().guid({ version: 'uuidv4' }).optional()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  generateLicense: {
    body: Joi.object({
      edition_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      license_type: Joi.string().valid('standard', 'premium', 'enterprise', 'trial').default('standard'),
      duration_months: Joi.number().integer().min(1).max(120).default(12),
      max_devices: Joi.number().integer().min(1).max(1000).default(1),
      custom_features: Joi.object().optional()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  createTrial: {
    body: Joi.object({
      edition_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      trial_days: Joi.number().integer().min(1).max(365).default(30),
      features_enabled: Joi.object().optional()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  transferLicense: {
    body: Joi.object({
      new_contact_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      notes: Joi.string().optional()
    }),
    params: Joi.object({
      licenseId: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  recordDownload: {
    body: Joi.object({
      contact_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      edition_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      license_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      trial_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      download_url: Joi.string().uri().required(),
      file_size: Joi.number().integer().min(0).optional(),
      version: Joi.string().max(50).optional()
    })
  },

  recordActivation: {
    body: Joi.object({
      contact_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      license_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      trial_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      device_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      activation_key: Joi.string().required(),
      hardware_fingerprint: Joi.string().optional(),
      software_version: Joi.string().max(50).optional()
    })
  }
};

/**
 * GET /contacts
 * Get all contacts with filtering and pagination
 */
router.get('/',
  validate(contactSchemas.listContacts),
  async (req, res) => {
    try {
      console.log('Getting contacts for organization:', req.organizationId);
      console.log('Query params:', req.query);
      
      if (!req.organizationId) {
        return res.status(400).json({
          error: 'Missing organization context',
          message: 'Organization ID is required'
        });
      }

      const {
        page = 1,
        limit = 10000,
        status,
        type,
        priority,
        assigned_to,
        source,
        search,
        sort = 'created_at',
        order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      
      const result = await findByOrganizationSafe(req.organizationId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
        type,
        priority,
        assigned_to,
        source,
        search,
        sort,
        order
      });

      console.log(`Found ${result.contacts.length} contacts out of ${result.pagination.total} total`);

      res.json({
        contacts: result.contacts,
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get contacts error:', error);
      res.status(500).json({
        error: 'Failed to retrieve contacts',
        message: 'Unable to get contacts list',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /contacts/stats
 * Get contact statistics for the organization with aggregated data
 */
router.get('/stats',
  async (req, res) => {
    try {
      console.log('Getting contact stats for organization:', req.organizationId);

      if (!req.organizationId) {
        console.error('Missing organization context - req.organizationId is null/undefined');
        return res.status(400).json({
          error: 'Missing organization context',
          message: 'Organization ID is required'
        });
      }

      const { query } = require('../database/connection');

      // Get aggregated stats with JOINs to accounts and transactions
      const statsQuery = `
        SELECT
          COUNT(DISTINCT c.id)::integer as total_contacts,
          COUNT(DISTINCT CASE
            WHEN COALESCE(c.contact_status, c.status) = 'active'
            THEN c.id
          END)::integer as active_contacts,
          COUNT(DISTINCT a.id)::integer as total_accounts,
          COALESCE(SUM(
            CASE
              WHEN t.status IS NULL OR t.status != 'cancelled' THEN t.amount
              ELSE 0
            END
          ), 0)::numeric as total_revenue
        FROM contacts c
        LEFT JOIN accounts a
          ON a.contact_id = c.id
          AND a.organization_id = c.organization_id
        LEFT JOIN transactions t
          ON (t.contact_id = c.id OR t.account_id = a.id)
          AND t.organization_id = c.organization_id
        WHERE c.organization_id = $1
      `;

      const result = await query(statsQuery, [req.organizationId], req.organizationId);
      const stats = result.rows[0];

      console.log('Aggregated stats from database:', stats);

      res.json({
        stats: {
          total_contacts: parseInt(stats.total_contacts) || 0,
          active_contacts: parseInt(stats.active_contacts) || 0,
          total_accounts: parseInt(stats.total_accounts) || 0,
          total_revenue: parseFloat(stats.total_revenue) || 0
        }
      });
    } catch (error) {
      console.error('Get contact stats error:', error);
      console.error('Error context:', {
        organizationId: req.organizationId,
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: 'Unable to get contact statistics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /contacts/debug
 * Debug endpoint to test database connection and table creation
 */
router.get('/debug',
  async (req, res) => {
    try {
      const { query } = require('../database/connection');
      const debug = {
        timestamp: new Date().toISOString(),
        organizationId: req.organizationId,
        steps: []
      };

      // Step 1: Test basic query
      debug.steps.push({ step: 1, name: 'Testing basic query' });
      const basicTest = await query('SELECT NOW() as current_time');
      debug.steps.push({ step: 1, result: 'SUCCESS', data: basicTest.rows[0] });

      // Step 2: Check if organizations table exists
      debug.steps.push({ step: 2, name: 'Checking organizations table' });
      const orgCheck = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'organizations'
      `);
      debug.steps.push({ step: 2, result: 'SUCCESS', exists: orgCheck.rows.length > 0 });

      // Step 3: Check if contacts table exists
      debug.steps.push({ step: 3, name: 'Checking contacts table' });
      const contactsCheck = await query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'contacts'
      `);
      debug.steps.push({ step: 3, result: 'SUCCESS', exists: contactsCheck.rows.length > 0 });

      // Step 4: Check UUID extension
      debug.steps.push({ step: 4, name: 'Checking UUID extension' });
      const uuidCheck = await query(`
        SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'
      `);
      debug.steps.push({ step: 4, result: 'SUCCESS', exists: uuidCheck.rows.length > 0 });

      res.json(debug);
    } catch (error) {
      res.status(500).json({
        error: 'Debug failed',
        details: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name
        }
      });
    }
  }
);

/**
 * GET /contacts/software-editions
 * Get software editions for product catalog
 */
router.get('/software-editions',
  async (req, res) => {
    try {
      const editions = await Contact.getEditions(req.organizationId);
      
      res.json({
        editions: editions
      });
    } catch (error) {
      console.error('Get software editions error:', error);
      res.status(500).json({
        error: 'Failed to retrieve software editions',
        message: 'Unable to get product catalog'
      });
    }
  }
);

/**
 * POST /contacts/software-editions
 * Create new software edition
 */
router.post('/software-editions',
  validate(contactSchemas.createEdition),
  async (req, res) => {
    try {
      const edition = await Contact.createEdition(req.body, req.organizationId, req.user.id);

      res.status(201).json({
        message: 'Software edition created successfully',
        edition: edition
      });
    } catch (error) {
      console.error('Create software edition error:', error);
      res.status(500).json({
        error: 'Software edition creation failed',
        message: 'Unable to create software edition'
      });
    }
  }
);

/**
 * POST /contacts/convert-from-lead/:leadId
 * Convert lead to contact with optional account and transaction creation
 */
router.post('/convert-from-lead/:leadId',
  async (req, res) => {
    const { query } = require('../database/connection');

    try {
      const { leadId } = req.params;
      
      // Validate leadId is a UUID
      if (!leadId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(leadId)) {
        return res.status(400).json({
          error: 'Invalid lead ID',
          message: 'Lead ID must be a valid UUID'
        });
      }
      
      const {
        contactMode,
        existingContactId,
        contact: contactData,
        createAccount,
        account: accountData,
        createTransaction,
        transaction: transactionData
      } = req.body;

      console.log('🔄 Converting lead:', { leadId, contactMode, createAccount, createTransaction });

      // Start transaction
      await query('BEGIN');

      // Step 1: Get the lead
      const leadResult = await query(
        `SELECT * FROM leads WHERE id = $1 AND organization_id = $2`,
        [leadId, req.organizationId]
      );

      if (leadResult.rows.length === 0) {
        await query('ROLLBACK');
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      const lead = leadResult.rows[0];
      let contact;
      let contactId;

      // Step 2: Handle contact creation or linking
      if (contactMode === 'new') {
        // Create new contact from lead data
        const contactInsertResult = await query(
          `INSERT INTO contacts (
            organization_id, first_name, last_name, email, phone,
            contact_status, contact_source, company, title,
            converted_from_lead_id, created_by, assigned_to, priority
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *`,
          [
            req.organizationId,
            contactData?.firstName || lead.first_name,
            contactData?.lastName || lead.last_name,
            contactData?.email || lead.email,
            contactData?.phone || lead.phone,
            'customer',
            lead.source || null, // Preserve source
            lead.company,
            lead.title,
            leadId,
            req.user.id,
            lead.assigned_to || req.user.id, // Preserve owner (assigned_to)
            lead.priority || 'medium'
          ]
        );
        contact = contactInsertResult.rows[0];
        contactId = contact.id;
        console.log('✅ Created new contact:', contactId);
      } else if (contactMode === 'existing' && existingContactId) {
        // Link to existing contact
        contactId = existingContactId;
        const existingContactResult = await query(
          `SELECT * FROM contacts WHERE id = $1 AND organization_id = $2`,
          [contactId, req.organizationId]
        );

        if (existingContactResult.rows.length === 0) {
          await query('ROLLBACK');
          return res.status(404).json({
            error: 'Contact not found',
            message: 'Selected contact does not exist'
          });
        }
        contact = existingContactResult.rows[0];
        console.log('✅ Linked to existing contact:', contactId);
      } else {
        await query('ROLLBACK');
        return res.status(400).json({
          error: 'Invalid contact mode',
          message: 'Must provide contact data for new contact or contact ID for existing'
        });
      }

      // Step 3: Update lead status and link to contact
      await query(
        `UPDATE leads
         SET status = 'converted',
             linked_contact_id = $1,
             converted_date = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [contactId, leadId]
      );
      console.log('✅ Updated lead status to converted');

      // Step 4: Create lead-contact relationship
      await query(
        `INSERT INTO lead_contact_relationships (
          lead_id, contact_id, relationship_type, created_by
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (lead_id, contact_id) DO NOTHING`,
        [leadId, contactId, 'conversion', req.user.id]
      );

      // Step 4a: Transfer custom field values (if custom_field_values table exists)
      // First check if the table exists to avoid transaction errors
      const tableCheckResult = await query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'custom_field_values'
        )`
      );

      if (tableCheckResult.rows[0].exists) {
        try {
          const customFieldsResult = await query(
            `SELECT cfv.*, cfd.field_name
             FROM custom_field_values cfv
             JOIN custom_field_definitions cfd ON cfv.field_definition_id = cfd.id
             WHERE cfv.entity_id = $1
             AND cfv.entity_type = 'leads'
             AND cfd.is_active = true`,
            [leadId]
          );

          if (customFieldsResult.rows.length > 0) {
            for (const fieldValue of customFieldsResult.rows) {
              await query(
                `INSERT INTO custom_field_values (
                  organization_id, field_definition_id, entity_type, entity_id, field_value,
                  created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (field_definition_id, entity_id) DO UPDATE
                SET field_value = $5, updated_at = NOW(), updated_by = $7`,
                [
                  req.organizationId,
                  fieldValue.field_definition_id,
                  'contacts',
                  contactId,
                  fieldValue.field_value,
                  req.user.id,
                  req.user.id
                ]
              );
            }
            console.log(`✅ Transferred ${customFieldsResult.rows.length} custom field(s):`,
              customFieldsResult.rows.map(f => f.field_name).join(', '));
          }
        } catch (customFieldsError) {
          // If there's an error, rollback and re-throw to handle properly
          console.error('❌ Error transferring custom fields:', customFieldsError);
          throw customFieldsError;
        }
      } else {
        console.log('ℹ️ Custom fields stored in contact.custom_fields JSONB column');
      }

      // Step 4b: Transfer tasks from lead_interactions to contact_interactions
      // Note: Tasks are converted to 'note' type since contact_interactions doesn't support 'task' type
      const tasksResult = await query(
        `SELECT * FROM lead_interactions
         WHERE lead_id = $1 AND interaction_type = 'task'`,
        [leadId]
      );

      if (tasksResult.rows.length > 0) {
        for (const task of tasksResult.rows) {
          // Determine direction based on task status
          const direction = 'outbound'; // Tasks are typically outbound actions

          // Build subject that indicates this was a task
          const taskSubject = task.subject
            ? `[Task] ${task.subject}`
            : `[Task] ${task.status === 'completed' ? 'Completed' : 'Scheduled'} task`;

          // Build content that preserves task information
          let taskContent = task.description || '';
          if (task.outcome) {
            taskContent += `\n\nOutcome: ${task.outcome}`;
          }
          if (task.scheduled_at) {
            taskContent += `\n\nScheduled for: ${new Date(task.scheduled_at).toLocaleString()}`;
          }
          if (task.status) {
            taskContent += `\n\nStatus: ${task.status}`;
          }

          await query(
            `INSERT INTO contact_interactions (
              organization_id, contact_id, user_id, interaction_type,
              direction, subject, content, duration_minutes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              req.organizationId,
              contactId,
              sanitizeUUID(task.user_id), // Sanitize UUID - converts empty strings to NULL
              'note', // Convert task to note type
              direction,
              taskSubject,
              taskContent,
              task.duration_minutes || null, // Handle NULL duration
              task.completed_at || task.created_at // Use completion time if available
            ]
          );
        }
        console.log(`✅ Transferred ${tasksResult.rows.length} task(s) as notes`);
      }

      // Step 4c: Transfer lead interactions (activities) to contact_interactions
      const activitiesResult = await query(
        `SELECT * FROM lead_interactions
         WHERE lead_id = $1 AND interaction_type != 'task'`,
        [leadId]
      );

      if (activitiesResult.rows.length > 0) {
        for (const activity of activitiesResult.rows) {
          // Map lead interaction types to contact interaction types
          let interactionType = activity.interaction_type;
          let direction = 'outbound'; // Default direction

          await query(
            `INSERT INTO contact_interactions (
              organization_id, contact_id, user_id, interaction_type,
              direction, subject, content, duration_minutes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              req.organizationId,
              contactId,
              sanitizeUUID(activity.user_id), // Sanitize UUID - converts empty strings to NULL
              interactionType,
              direction,
              activity.subject || null, // Handle NULL subject
              activity.description || null, // Handle NULL description
              activity.duration_minutes || null, // Handle NULL duration
              activity.created_at
            ]
          );
        }
        console.log(`✅ Transferred ${activitiesResult.rows.length} activities`);
      }

      let account = null;
      let accountId = null;

      // Step 5: Create account if requested
      if (createAccount && accountData) {
        const accountInsertResult = await query(
          `INSERT INTO accounts (
            organization_id, contact_id, account_name, edition,
            device_name, mac_address, billing_cycle, account_type,
            license_status, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *`,
          [
            req.organizationId,
            contactId,
            accountData.accountName || `${contact.first_name} ${contact.last_name}'s Account`,
            accountData.product || 'Standard',
            accountData.deviceName,
            accountData.macAddress,
            accountData.term || 'Monthly',
            'active',
            'active',
            req.user.id
          ]
        );
        account = accountInsertResult.rows[0];
        accountId = account.id;
        console.log('✅ Created account:', accountId);
      }

      let transaction = null;

      // Step 6: Create transaction if requested
      if (createTransaction && transactionData && accountId) {
        console.log('🔍 DEBUG - Payment Date Received:', transactionData.paymentDate);
        console.log('🔍 DEBUG - Payment Date Type:', typeof transactionData.paymentDate);
        console.log('🔍 DEBUG - Next Renewal Date:', transactionData.nextRenewalDate);

        const transactionInsertResult = await query(
          `INSERT INTO transactions (
            organization_id, account_id, contact_id, payment_method,
            term, amount, status, transaction_date, notes, created_by
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, TO_DATE($8, 'YYYY-MM-DD'), $9, $10)
          RETURNING *`,
          [
            req.organizationId,
            accountId,
            contactId,
            transactionData.paymentMethod || 'Credit Card',
            transactionData.term || 'Monthly',
            transactionData.amount || 0,
            'pending',
            transactionData.paymentDate || new Date().toISOString().split('T')[0],
            `Converted from lead ${lead.full_name}`,
            req.user.id
          ]
        );
        transaction = transactionInsertResult.rows[0];
        console.log('✅ Created transaction:', transaction.id);
        console.log('🔍 DEBUG - Stored transaction_date:', transaction.transaction_date);

        // Update account with next renewal date if provided
        if (transactionData.nextRenewalDate && accountId) {
          console.log('🔍 DEBUG - Updating next_renewal_date to:', transactionData.nextRenewalDate);
          const updateResult = await query(
            `UPDATE accounts SET next_renewal_date = TO_DATE($1, 'YYYY-MM-DD') WHERE id = $2 RETURNING next_renewal_date`,
            [transactionData.nextRenewalDate, accountId]
          );
          console.log('🔍 DEBUG - Stored next_renewal_date:', updateResult.rows[0]?.next_renewal_date);
        }
      }

      // Commit transaction
      await query('COMMIT');

      res.status(201).json({
        message: 'Lead converted successfully',
        contact,
        account,
        transaction,
        summary: {
          contactCreated: contactMode === 'new',
          accountCreated: createAccount && account !== null,
          transactionCreated: createTransaction && transaction !== null
        }
      });
    } catch (error) {
      await query('ROLLBACK');
      console.error('Convert lead error:', error);

      res.status(500).json({
        error: 'Lead conversion failed',
        message: error.message || 'Unable to convert lead'
      });
    }
  }
);

/**
 * GET /contacts/:id/detail
 * Get contact with related data (accounts, stats, custom fields, tasks)
 */
router.get('/:id/detail',
  validateUuidParam,
  async (req, res) => {
    try {
      const { id } = req.params;
      const organizationId = req.organizationId;
      const { query } = require('../database/connection');

      // Fetch contact
      const contact = await Contact.findById(id, organizationId);
      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: 'Contact does not exist in this organization'
        });
      }

      // Fetch related accounts
      const accounts = await Contact.getAccounts(organizationId, {
        contact_id: id
      });

      // Note: Custom fields are stored in the contact.custom_fields JSONB column
      // No need to query a separate table

      // Fetch task stats from contact_interactions
      const taskStatsResult = await query(
        `SELECT
          COUNT(*) FILTER (WHERE subject LIKE '[Task]%' OR interaction_type = 'note') as total_tasks,
          COUNT(*) FILTER (WHERE (subject LIKE '[Task]%' OR interaction_type = 'note')
                                 AND subject LIKE '%Completed%') as completed_tasks,
          COUNT(*) FILTER (WHERE (subject LIKE '[Task]%' OR interaction_type = 'note')
                                 AND (subject LIKE '%Scheduled%' OR subject NOT LIKE '%Completed%')) as in_progress_tasks
         FROM contact_interactions
         WHERE contact_id = $1 AND organization_id = $2`,
        [id, organizationId],
        organizationId
      );

      const taskStats = taskStatsResult.rows[0] || {
        total_tasks: 0,
        completed_tasks: 0,
        in_progress_tasks: 0
      };

      // Return aggregated data with all fields
      const contactData = contact.toJSON();

      // Add assigned_to_name for backwards compatibility
      if (contact.assigned_user) {
        contactData.assigned_to_name = contact.assigned_user.full_name;
      }

      res.json({
        contact: contactData,
        accounts: accounts || [],
        customFields: [], // Custom fields are stored in contact.custom_fields JSONB column
        taskStats: {
          total: parseInt(taskStats.total_tasks) || 0,
          completed: parseInt(taskStats.completed_tasks) || 0,
          inProgress: parseInt(taskStats.in_progress_tasks) || 0
        }
      });
    } catch (error) {
      console.error('Error fetching contact detail:', error);
      res.status(500).json({
        error: 'Failed to fetch contact detail',
        message: error.message || 'Unable to get contact details'
      });
    }
  }
);

/**
 * GET /contacts/:id
 * Get specific contact by ID
 */
router.get('/:id',
  validateUuidParam,
  async (req, res) => {
    try {
      const contact = await Contact.findById(req.params.id, req.organizationId);

      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: 'Contact does not exist in this organization'
        });
      }

      res.json({
        contact: contact.toJSON()
      });
    } catch (error) {
      console.error('Get contact error:', error);
      res.status(500).json({
        error: 'Failed to retrieve contact',
        message: 'Unable to get contact information'
      });
    }
  }
);

/**
 * POST /contacts
 * Create new contact
 */
router.post('/',
  validate(contactSchemas.createContact),
  async (req, res) => {
    try {
      const contact = await Contact.create(req.body, req.organizationId, req.user.id);

      res.status(201).json({
        message: 'Contact created successfully',
        contact: contact.toJSON()
      });
    } catch (error) {
      console.error('Create contact error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Contact creation failed',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Contact creation failed',
        message: 'Unable to create contact'
      });
    }
  }
);

/**
 * PUT /contacts/:id/status
 * Update contact status and optionally create account when status is "won"
 */
router.put('/:id/status',
  validateUuidParam,
  async (req, res) => {
    try {
      const { status, accountData } = req.body;

      // Validate status
      const validStatuses = ['prospect', 'on_trial', 'first_follow_up', 'second_follow_up', 'won', 'lost'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

      // Get the contact first
      const contact = await Contact.findById(req.params.id, req.organizationId);
      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: 'Contact does not exist in this organization'
        });
      }

      // Update the contact status
      const updatedContact = await Contact.update(
        req.params.id,
        { status },
        req.organizationId
      );

      // If status is "won" and accountData is provided, create an account
      let account = null;
      if (status === 'won' && accountData) {
        const { edition_id, billing_cycle, price } = accountData;

        // Create account
        const accountInfo = {
          contact_id: req.params.id,
          account_name: `${contact.first_name} ${contact.last_name} Account`,
          account_type: 'business',
          status: 'active'
        };

        account = await Contact.createAccount(accountInfo, req.organizationId, req.user.id);

        // Generate license for the account
        if (edition_id) {
          const licenseData = {
            contact_id: req.params.id,
            edition_id,
            license_type: 'standard',
            duration_months: billing_cycle === 'monthly' ? 1 : 12,
            max_devices: 1,
            custom_features: { price }
          };

          await Contact.generateLicense(licenseData, req.organizationId, req.user.id);
        }
      }

      res.json({
        message: 'Contact status updated successfully',
        contact: updatedContact.toJSON(),
        account: account
      });
    } catch (error) {
      console.error('Update contact status error:', error);
      res.status(500).json({
        error: 'Status update failed',
        message: 'Unable to update contact status',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * PUT /contacts/:id
 * Update contact information
 */
router.put('/:id',
  validate(contactSchemas.updateContact),
  async (req, res) => {
    try {
      const contact = await Contact.update(req.params.id, req.body, req.organizationId);

      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: 'Contact does not exist in this organization'
        });
      }

      res.json({
        message: 'Contact updated successfully',
        contact: contact.toJSON()
      });
    } catch (error) {
      console.error('Update contact error:', error);
      res.status(500).json({
        error: 'Contact update failed',
        message: 'Unable to update contact'
      });
    }
  }
);

/**
 * DELETE /contacts/:id
 * Delete contact
 */
router.delete('/:id',
  validateUuidParam,
  async (req, res) => {
    try {
      const success = await Contact.delete(req.params.id, req.organizationId);
      
      if (!success) {
        return res.status(404).json({
          error: 'Contact not found',
          message: 'Contact does not exist in this organization'
        });
      }

      res.json({
        message: 'Contact deleted successfully'
      });
    } catch (error) {
      console.error('Delete contact error:', error);
      res.status(500).json({
        error: 'Contact deletion failed',
        message: 'Unable to delete contact'
      });
    }
  }
);

/**
 * GET /contacts/:id/accounts
 * Get accounts for specific contact
 */
router.get('/:id/accounts',
  validateUuidParam,
  async (req, res) => {
    try {
      const accounts = await Contact.getAccounts(req.organizationId, {
        contact_id: req.params.id
      });

      res.json({
        accounts: accounts
      });
    } catch (error) {
      console.error('Get contact accounts error:', error);
      res.status(500).json({
        error: 'Failed to retrieve accounts',
        message: 'Unable to get contact accounts'
      });
    }
  }
);

/**
 * POST /contacts/:id/accounts
 * Create account for contact
 */
router.post('/:id/accounts',
  validate(contactSchemas.createAccount),
  async (req, res) => {
    try {
      // Ensure contact_id matches URL parameter
      const accountData = {
        ...req.body,
        contact_id: req.params.id
      };

      const account = await Contact.createAccount(accountData, req.organizationId, req.user.id);

      res.status(201).json({
        message: 'Account created successfully',
        account: account
      });
    } catch (error) {
      console.error('Create account error:', error);
      res.status(500).json({
        error: 'Account creation failed',
        message: 'Unable to create account'
      });
    }
  }
);

/**
 * POST /contacts/:id/devices
 * Register device for contact
 */
router.post('/:id/devices',
  validate(contactSchemas.registerDevice),
  async (req, res) => {
    try {
      const deviceData = {
        ...req.body,
        contact_id: req.params.id
      };

      // Get client IP and user agent for tracking
      deviceData.ip_address = req.ip || req.connection.remoteAddress;
      deviceData.user_agent = req.get('User-Agent');

      const device = await Contact.registerDevice(deviceData, req.organizationId);

      res.status(201).json({
        message: 'Device registered successfully',
        device: device
      });
    } catch (error) {
      console.error('Register device error:', error);
      res.status(500).json({
        error: 'Device registration failed',
        message: 'Unable to register device'
      });
    }
  }
);

/**
 * GET /contacts/:id/devices
 * Get devices for contact
 */
router.get('/:id/devices',
  validateUuidParam,
  async (req, res) => {
    try {
      const devices = await Contact.getDevices(req.organizationId, {
        contact_id: req.params.id
      });

      res.json({
        devices: devices
      });
    } catch (error) {
      console.error('Get contact devices error:', error);
      res.status(500).json({
        error: 'Failed to retrieve devices',
        message: 'Unable to get contact devices'
      });
    }
  }
);

/**
 * POST /contacts/:id/licenses
 * Generate license for contact
 */
router.post('/:id/licenses',
  validate(contactSchemas.generateLicense),
  async (req, res) => {
    try {
      const licenseData = {
        ...req.body,
        contact_id: req.params.id
      };

      const license = await Contact.generateLicense(licenseData, req.organizationId, req.user.id);

      res.status(201).json({
        message: 'License generated successfully',
        license: license
      });
    } catch (error) {
      console.error('Generate license error:', error);
      res.status(500).json({
        error: 'License generation failed',
        message: 'Unable to generate license'
      });
    }
  }
);

/**
 * GET /contacts/:id/licenses
 * Get licenses for contact
 */
router.get('/:id/licenses',
  validateUuidParam,
  async (req, res) => {
    try {
      const { expired_only, status, license_type } = req.query;
      
      const licenses = await Contact.getLicenses(req.organizationId, {
        contact_id: req.params.id,
        expired_only: expired_only === 'true',
        status,
        license_type
      });

      res.json({
        licenses: licenses
      });
    } catch (error) {
      console.error('Get contact licenses error:', error);
      res.status(500).json({
        error: 'Failed to retrieve licenses',
        message: 'Unable to get contact licenses'
      });
    }
  }
);

/**
 * POST /contacts/:id/trials
 * Create trial for contact
 */
router.post('/:id/trials',
  validate(contactSchemas.createTrial),
  async (req, res) => {
    try {
      const trialData = {
        ...req.body,
        contact_id: req.params.id
      };

      const trial = await Contact.createTrial(trialData, req.organizationId);

      res.status(201).json({
        message: 'Trial created successfully',
        trial: trial
      });
    } catch (error) {
      console.error('Create trial error:', error);
      res.status(500).json({
        error: 'Trial creation failed',
        message: 'Unable to create trial'
      });
    }
  }
);

/**
 * GET /contacts/:id/trials
 * Get trials for contact
 */
router.get('/:id/trials',
  validateUuidParam,
  async (req, res) => {
    try {
      const { active_only, status } = req.query;
      
      const trials = await Contact.getTrials(req.organizationId, {
        contact_id: req.params.id,
        active_only: active_only === 'true',
        status
      });

      res.json({
        trials: trials
      });
    } catch (error) {
      console.error('Get contact trials error:', error);
      res.status(500).json({
        error: 'Failed to retrieve trials',
        message: 'Unable to get contact trials'
      });
    }
  }
);

/**
 * POST /contacts/licenses/:licenseId/transfer
 * Transfer license to another contact
 */
router.post('/licenses/:licenseId/transfer',
  validate(contactSchemas.transferLicense),
  async (req, res) => {
    try {
      const { licenseId } = req.params;
      const { new_contact_id, notes } = req.body;

      const result = await Contact.transferLicense(
        licenseId, 
        new_contact_id, 
        req.organizationId, 
        req.user.id
      );

      res.json({
        message: 'License transferred successfully',
        transfer: result.transfer,
        remaining_days: result.remaining_days,
        old_contact: result.old_contact
      });
    } catch (error) {
      console.error('Transfer license error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'License not found',
          message: 'License does not exist in this organization'
        });
      }

      res.status(500).json({
        error: 'License transfer failed',
        message: 'Unable to transfer license'
      });
    }
  }
);

/**
 * POST /contacts/downloads/record
 * Record software download
 */
router.post('/downloads/record',
  validate(contactSchemas.recordDownload),
  async (req, res) => {
    try {
      const downloadData = {
        ...req.body,
        ip_address: req.ip || req.connection.remoteAddress,
        user_agent: req.get('User-Agent')
      };

      const download = await Contact.recordDownload(downloadData, req.organizationId);

      res.status(201).json({
        message: 'Download recorded successfully',
        download: download
      });
    } catch (error) {
      console.error('Record download error:', error);
      res.status(500).json({
        error: 'Download recording failed',
        message: 'Unable to record download'
      });
    }
  }
);

/**
 * POST /contacts/activations/record
 * Record software activation
 */
router.post('/activations/record',
  validate(contactSchemas.recordActivation),
  async (req, res) => {
    try {
      const activationData = {
        ...req.body,
        ip_address: req.ip || req.connection.remoteAddress
      };

      const activation = await Contact.recordActivation(activationData, req.organizationId);

      res.status(201).json({
        message: 'Activation recorded successfully',
        activation: activation
      });
    } catch (error) {
      console.error('Record activation error:', error);
      res.status(500).json({
        error: 'Activation recording failed',
        message: 'Unable to record activation'
      });
    }
  }
);

/**
 * Contact Interaction endpoints
 */

// Contact interaction validation schemas
const interactionSchemas = {
  createInteraction: {
    body: Joi.object({
      contact_id: Joi.string().guid({ version: 'uuidv4' }).required(),
      interaction_type: Joi.string().valid('email', 'call', 'meeting', 'note', 'support_ticket').required(),
      direction: Joi.string().valid('inbound', 'outbound').required(),
      subject: Joi.string().max(500).optional(),
      content: Joi.string().optional(),
      duration_minutes: Joi.number().integer().min(0).optional(),
      email_message_id: Joi.string().max(500).optional()
    })
  },

  updateInteraction: {
    body: Joi.object({
      interaction_type: Joi.string().valid('email', 'call', 'meeting', 'note', 'support_ticket').optional(),
      direction: Joi.string().valid('inbound', 'outbound').optional(),
      subject: Joi.string().max(500).optional(),
      content: Joi.string().optional(),
      duration_minutes: Joi.number().integer().min(0).optional(),
      email_message_id: Joi.string().max(500).optional()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required(),
      interactionId: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  listInteractions: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(50),
      interaction_type: Joi.string().valid('email', 'call', 'meeting', 'note', 'support_ticket').optional(),
      direction: Joi.string().valid('inbound', 'outbound').optional(),
      sort: Joi.string().valid('created_at', 'interaction_type', 'direction').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  }
};

/**
 * POST /contacts/:id/interactions
 * Create new interaction for contact
 */
router.post('/:id/interactions',
  validateUuidParam,
  validate(interactionSchemas.createInteraction),
  async (req, res) => {
    try {
      // Ensure contact exists
      const contact = await Contact.findById(req.params.id, req.organizationId);
      if (!contact) {
        return res.status(404).json({
          error: 'Contact not found',
          message: 'Contact does not exist in this organization'
        });
      }

      // Ensure contact_id matches URL parameter
      const interactionData = {
        ...req.body,
        contact_id: req.params.id
      };

      const interaction = await Contact.createInteraction(
        interactionData,
        req.organizationId,
        req.user.id
      );

      res.status(201).json({
        message: 'Interaction created successfully',
        interaction: interaction
      });
    } catch (error) {
      console.error('Create interaction error:', error);
      res.status(500).json({
        error: 'Interaction creation failed',
        message: 'Unable to create interaction'
      });
    }
  }
);

/**
 * GET /contacts/:id/interactions
 * Get interactions for specific contact
 */
router.get('/:id/interactions',
  validateUuidParam,
  validate(interactionSchemas.listInteractions),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        interaction_type,
        direction,
        sort = 'created_at',
        order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;

      const interactions = await Contact.getInteractions(req.params.id, req.organizationId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        interaction_type,
        direction,
        sort,
        order
      });

      // Get total count for pagination
      const totalQuery = await require('../database/connection').query(`
        SELECT COUNT(*) as total
        FROM contact_interactions
        WHERE contact_id = $1 AND organization_id = $2
        ${interaction_type ? 'AND interaction_type = $3' : ''}
        ${direction ? (interaction_type ? 'AND direction = $4' : 'AND direction = $3') : ''}
      `, [
        req.params.id,
        req.organizationId,
        ...(interaction_type ? [interaction_type] : []),
        ...(direction ? [direction] : [])
      ], req.organizationId);

      const total = parseInt(totalQuery.rows[0].total);
      const pages = Math.ceil(total / limit);

      res.json({
        interactions: interactions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      });
    } catch (error) {
      console.error('Get contact interactions error:', error);
      res.status(500).json({
        error: 'Failed to retrieve interactions',
        message: 'Unable to get contact interactions'
      });
    }
  }
);

/**
 * GET /contacts/:id/interactions/stats
 * Get interaction statistics for contact
 */
router.get('/:id/interactions/stats',
  validateUuidParam,
  async (req, res) => {
    try {
      const stats = await Contact.getInteractionStats(req.params.id, req.organizationId);

      res.json({
        stats: stats
      });
    } catch (error) {
      console.error('Get interaction stats error:', error);
      res.status(500).json({
        error: 'Failed to retrieve interaction statistics',
        message: 'Unable to get interaction stats'
      });
    }
  }
);

/**
 * PUT /contacts/:id/interactions/:interactionId
 * Update contact interaction
 */
router.put('/:id/interactions/:interactionId',
  validate(interactionSchemas.updateInteraction),
  async (req, res) => {
    try {
      const interaction = await Contact.updateInteraction(
        req.params.interactionId,
        req.body,
        req.organizationId
      );

      if (!interaction) {
        return res.status(404).json({
          error: 'Interaction not found',
          message: 'Interaction does not exist in this organization'
        });
      }

      res.json({
        message: 'Interaction updated successfully',
        interaction: interaction
      });
    } catch (error) {
      console.error('Update interaction error:', error);
      res.status(500).json({
        error: 'Interaction update failed',
        message: 'Unable to update interaction'
      });
    }
  }
);

/**
 * DELETE /contacts/:id/interactions/:interactionId
 * Delete contact interaction
 */
router.delete('/:id/interactions/:interactionId',
  validateUuidParam,
  async (req, res) => {
    try {
      const success = await Contact.deleteInteraction(req.params.interactionId, req.organizationId);

      if (!success) {
        return res.status(404).json({
          error: 'Interaction not found',
          message: 'Interaction does not exist in this organization'
        });
      }

      res.json({
        message: 'Interaction deleted successfully'
      });
    } catch (error) {
      console.error('Delete interaction error:', error);
      res.status(500).json({
        error: 'Interaction deletion failed',
        message: 'Unable to delete interaction'
      });
    }
  }
);

/**
 * GET /contacts/interactions/recent
 * Get recent interactions across all contacts
 */
router.get('/interactions/recent',
  async (req, res) => {
    try {
      const {
        limit = 20,
        offset = 0,
        interaction_type,
        days = 30
      } = req.query;

      const interactions = await Contact.getRecentInteractions(req.organizationId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        interaction_type,
        days: parseInt(days)
      });

      res.json({
        interactions: interactions
      });
    } catch (error) {
      console.error('Get recent interactions error:', error);
      res.status(500).json({
        error: 'Failed to retrieve recent interactions',
        message: 'Unable to get recent interactions'
      });
    }
  }
);

module.exports = router;