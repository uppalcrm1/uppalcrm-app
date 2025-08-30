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

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

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
      title: Joi.string().max(100).optional(),
      company: Joi.string().max(255).optional(),
      first_name: Joi.string().min(1).max(100).optional(),
      last_name: Joi.string().min(1).max(100).optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().max(50).optional(),
      source: Joi.string().valid('website', 'referral', 'social', 'cold-call', 'email', 'advertisement', 'trade-show', 'other').optional(),
      status: Joi.string().valid('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost').optional(),
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

  listLeads: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      status: Joi.string().valid('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost').optional(),
      priority: Joi.string().valid('low', 'medium', 'high').optional(),
      assigned_to: Joi.string().guid({ version: 'uuidv4' }).optional(),
      source: Joi.string().optional(),
      search: Joi.string().min(1).max(100).optional(),
      sort: Joi.string().valid('created_at', 'updated_at', 'first_name', 'last_name', 'company', 'value', 'status').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    })
  }
};

/**
 * GET /leads
 * Get all leads with filtering and pagination
 */
router.get('/',
  validate(leadSchemas.listLeads),
  async (req, res) => {
    try {
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

      const offset = (page - 1) * limit;
      
      const result = await Lead.findByOrganization(req.organizationId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
        priority,
        assigned_to,
        source,
        search,
        sort,
        order
      });

      res.json({
        leads: result.leads.map(lead => lead.toJSON()),
        pagination: result.pagination
      });
    } catch (error) {
      console.error('Get leads error:', error);
      res.status(500).json({
        error: 'Failed to retrieve leads',
        message: 'Unable to get leads list'
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
      const stats = await Lead.getStats(req.organizationId);
      
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
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: 'Unable to get lead statistics'
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
 * Create new lead
 */
router.post('/',
  validate(leadSchemas.createLead),
  async (req, res) => {
    try {
      const lead = await Lead.create(req.body, req.organizationId, req.user.id);

      res.status(201).json({
        message: 'Lead created successfully',
        lead: lead.toJSON()
      });
    } catch (error) {
      console.error('Create lead error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Lead creation failed',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Lead creation failed',
        message: 'Unable to create lead'
      });
    }
  }
);

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

module.exports = router;