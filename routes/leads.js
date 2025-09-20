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

const router = express.Router();

// Add this helper function to get field configurations
const getFieldConfigurations = async (organizationId) => {
  const customFields = await db.query(`
    SELECT field_name, field_label, field_type, field_options, is_required, sort_order
    FROM custom_field_definitions
    WHERE organization_id = $1 AND is_enabled = true
    ORDER BY sort_order ASC, created_at ASC
  `, [organizationId]);

  const defaultFields = await db.query(`
    SELECT field_name, is_enabled, is_required, sort_order
    FROM default_field_configurations
    WHERE organization_id = $1
  `, [organizationId]);

  return {
    customFields: customFields.rows,
    defaultFields: defaultFields.rows
  };
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

// Lead validation schemas
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
      notes: Joi.string().allow('', null).optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).allow(null, '').optional(),
      last_contact_date: Joi.date().iso().allow(null, '').optional(),
      next_follow_up: Joi.date().iso().allow(null, '').optional(),
      created_at: Joi.date().optional(),
      updated_at: Joi.date().optional(),
      organization_id: Joi.string().guid({ version: 'uuidv4' }).optional(),
      created_by: Joi.string().guid({ version: 'uuidv4' }).optional()
    }),
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
  console.log('🔍 DEBUG: User ID:', req.userId);

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
      console.log('🔄 Updated leads endpoint - no custom_fields column');

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

      // Query leads without custom_fields column
      const leads = await db.query(`
        SELECT id, first_name, last_name, email, phone, company, source, status,
               priority, ${valueColumnName}, assigned_to, next_follow_up, notes,
               created_at, updated_at
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
               created_at, updated_at`,
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
  }
);

/**
 * GET /leads/:id
 * Get specific lead by ID
 */
router.get('/:id',
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
 */
router.post('/', async (req, res) => {
  try {
    console.log('🔍 Creating lead with data:', req.body);
    console.log('🔍 Organization ID:', req.organizationId);
    console.log('🔍 User ID:', req.userId);
    console.log('🔍 Value column name:', valueColumnName);

    const {
      firstName, lastName, email, phone, company, source,
      status, priority, potentialValue, assignedTo, nextFollowUp, notes,
      customFields = {} // Accept custom fields
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        error: 'Validation failed',
        message: 'First name and last name are required'
      });
    }

    // Validate authentication context
    if (!req.organizationId || !req.userId) {
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
      status || 'new', priority || 'medium', potentialValue, assignedTo, nextFollowUp, notes,
      req.userId
    ]);

    res.status(201).json({
      message: 'Lead created successfully',
      lead: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

/**
 * PUT /leads/:id
 * Update lead information
 */
router.put('/:id',
  validate(leadSchemas.updateLead),
  async (req, res) => {
    try {
      const lead = await Lead.update(req.params.id, req.body, req.organizationId);
      
      if (!lead) {
        return res.status(404).json({
          error: 'Lead not found',
          message: 'Lead does not exist in this organization'
        });
      }

      res.json({
        message: 'Lead updated successfully',
        lead: lead.toJSON()
      });
    } catch (error) {
      console.error('Update lead error:', error);
      res.status(500).json({
        error: 'Lead update failed',
        message: 'Unable to update lead'
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
      res.status(500).json({
        error: 'Lead deletion failed',
        message: 'Unable to delete lead'
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

      // Validate status
      const validStatuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost'];
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

module.exports = router;