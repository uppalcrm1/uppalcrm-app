const express = require('express');
const Contact = require('../models/Contact');
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

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// Contact validation schemas
const contactSchemas = {
  createContact: {
    body: Joi.object({
      title: Joi.string().max(100).optional(),
      company: Joi.string().max(255).optional(),
      first_name: Joi.string().min(1).max(100).required(),
      last_name: Joi.string().min(1).max(100).required(),
      email: Joi.string().email().optional(),
      phone: Joi.string().max(50).optional(),
      status: Joi.string().valid('active', 'inactive', 'prospect', 'customer').default('active'),
      type: Joi.string().valid('customer', 'prospect', 'partner', 'vendor').default('customer'),
      source: Joi.string().valid('website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
      value: Joi.number().min(0).default(0),
      notes: Joi.string().optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).optional(),
      next_follow_up: Joi.date().iso().optional()
    })
  },
  
  updateContact: {
    body: Joi.object({
      title: Joi.string().max(100).optional(),
      company: Joi.string().max(255).optional(),
      first_name: Joi.string().min(1).max(100).optional(),
      last_name: Joi.string().min(1).max(100).optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().max(50).optional(),
      status: Joi.string().valid('active', 'inactive', 'prospect', 'customer').optional(),
      type: Joi.string().valid('customer', 'prospect', 'partner', 'vendor').optional(),
      source: Joi.string().valid('website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').optional(),
      value: Joi.number().min(0).optional(),
      notes: Joi.string().optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow(null).optional(),
      last_contact_date: Joi.date().iso().optional(),
      next_follow_up: Joi.date().iso().allow(null).optional()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  listContacts: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid('active', 'inactive', 'prospect', 'customer').optional(),
      type: Joi.string().valid('customer', 'prospect', 'partner', 'vendor').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).optional(),
      source: Joi.string().optional(),
      search: Joi.string().min(1).max(100).optional(),
      sort: Joi.string().valid('created_at', 'updated_at', 'first_name', 'last_name', 'company', 'value', 'status').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    })
  },

  convertFromLead: {
    params: Joi.object({
      leadId: Joi.string().guid({ version: 'uuidv4' }).required()
    }),
    body: Joi.object({
      type: Joi.string().valid('customer', 'prospect', 'partner', 'vendor').default('customer'),
      status: Joi.string().valid('active', 'inactive', 'prospect', 'customer').default('active'),
      additional_notes: Joi.string().optional()
    })
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
        limit = 20,
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
      
      const result = await Contact.findByOrganization(req.organizationId, {
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
        contacts: result.contacts.map(contact => contact.toJSON()),
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
 * Get contact statistics for the organization
 */
router.get('/stats',
  async (req, res) => {
    try {
      console.log('Getting contact stats for organization:', req.organizationId);
      console.log('User details:', { id: req.user?.id, organization_id: req.user?.organization_id });
      
      if (!req.organizationId) {
        console.error('Missing organization context - req.organizationId is null/undefined');
        return res.status(400).json({
          error: 'Missing organization context',
          message: 'Organization ID is required'
        });
      }

      // Ensure contacts table exists before getting stats
      const { query } = require('../database/connection');
      
      console.log('🔧 Ensuring contacts table exists...');
      
      // Enable UUID extension if not exists
      await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`, [], req.organizationId);
      
      await query(`
        CREATE TABLE IF NOT EXISTS contacts (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          title VARCHAR(255),
          company VARCHAR(255),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(50),
          status VARCHAR(50) DEFAULT 'active',
          type VARCHAR(50) DEFAULT 'customer',
          source VARCHAR(100),
          priority VARCHAR(20) DEFAULT 'medium',
          value DECIMAL(10,2) DEFAULT 0,
          notes TEXT,
          assigned_to UUID REFERENCES users(id),
          created_by UUID REFERENCES users(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_contact_date TIMESTAMP WITH TIME ZONE,
          next_follow_up TIMESTAMP WITH TIME ZONE,
          converted_from_lead_id UUID REFERENCES leads(id)
        )
      `, [], req.organizationId);
      
      await query(`
        CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
        CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
        CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
      `, [], req.organizationId);
      
      console.log('✅ Contacts table ready');

      const stats = await Contact.getStats(req.organizationId);
      console.log('Raw stats from database:', stats);
      
      res.json({
        stats: {
          ...stats,
          total_value: parseFloat(stats.total_value) || 0,
          average_value: parseFloat(stats.average_value) || 0,
          conversion_rate: stats.total_contacts > 0 
            ? ((parseInt(stats.converted_from_leads) / parseInt(stats.total_contacts)) * 100).toFixed(2)
            : 0
        }
      });
    } catch (error) {
      console.error('Get contact stats error:', error);
      console.error('Error context:', {
        organizationId: req.organizationId,
        userId: req.user?.id,
        userOrgId: req.user?.organization_id,
        hasUser: !!req.user,
        timestamp: new Date().toISOString()
      });
      
      // Return detailed error information for debugging
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: 'Unable to get contact statistics',
        details: {
          message: error.message,
          stack: error.stack,
          code: error.code,
          name: error.name,
          organizationId: req.organizationId,
          userId: req.user?.id,
          userOrgId: req.user?.organization_id,
          timestamp: new Date().toISOString()
        }
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
 * Convert lead to contact
 */
router.post('/convert-from-lead/:leadId',
  validate(contactSchemas.convertFromLead),
  async (req, res) => {
    try {
      const { leadId } = req.params;
      const additionalData = {
        type: req.body.type,
        status: req.body.status,
        notes: req.body.additional_notes ? 
          `${req.body.additional_notes}\n\nConverted from lead on ${new Date().toISOString()}` :
          `Converted from lead on ${new Date().toISOString()}`
      };

      const contact = await Contact.convertFromLead(
        leadId, 
        req.organizationId, 
        req.user.id, 
        additionalData
      );

      res.status(201).json({
        message: 'Lead converted to contact successfully',
        contact: contact.toJSON()
      });
    } catch (error) {
      console.error('Convert lead to contact error:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      res.status(500).json({
        error: 'Lead conversion failed',
        message: 'Unable to convert lead to contact'
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

module.exports = router;