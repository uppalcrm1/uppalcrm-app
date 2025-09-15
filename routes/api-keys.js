const express = require('express');
const Joi = require('joi');
const ApiKey = require('../models/ApiKey');
const { validate, validateUuidParam } = require('../middleware/validation');
const { 
  authenticateToken, 
  requireAdmin,
  validateOrganizationContext 
} = require('../middleware/auth');

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const createApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).required()
    .messages({
      'string.empty': 'API key name is required',
      'string.max': 'API key name must be less than 100 characters'
    }),
  
  permissions: Joi.array()
    .items(Joi.string().valid(
      'contacts:read', 'contacts:write', 'contacts:delete',
      'leads:read', 'leads:write', 'leads:delete',
      'users:read', 'users:write',
      'organizations:read',
      'webhooks:read', 'webhooks:write',
      'analytics:read'
    ))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one permission is required',
      'any.only': 'Invalid permission specified'
    }),
  
  allowed_sources: Joi.array()
    .items(Joi.string().ip({ version: ['ipv4', 'ipv6'] }))
    .allow(null)
    .messages({
      'string.ip': 'Invalid IP address format'
    }),
  
  rate_limit_per_hour: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(1000)
    .messages({
      'number.min': 'Rate limit must be at least 1 request per hour',
      'number.max': 'Rate limit cannot exceed 10,000 requests per hour'
    }),
  
  expires_at: Joi.date()
    .iso()
    .greater('now')
    .allow(null)
    .messages({
      'date.greater': 'Expiration date must be in the future'
    })
});

const usageStatsQuerySchema = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional()
});

// =============================================================================
// API KEY MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * GET /api/organizations/current/api-keys
 * List organization's API keys (admin only)
 */
router.get('/api-keys',
  requireAdmin,
  async (req, res) => {
    try {
      console.log(`📋 Listing API keys for organization ${req.organizationId}`);
      
      const apiKeys = await ApiKey.findByOrganization(req.organizationId, {
        includeInactive: false
      });
      
      // Transform response to exclude sensitive data and add metadata
      const safeApiKeys = apiKeys.map(key => ({
        id: key.id,
        name: key.name,
        key_prefix: key.key_prefix,
        permissions: key.permissions,
        allowed_sources: key.allowed_sources,
        rate_limit_per_hour: key.rate_limit_per_hour,
        is_active: key.is_active,
        last_used_at: key.last_used_at,
        created_at: key.created_at,
        expires_at: key.expires_at,
        total_requests: key.total_requests,
        last_request_ip: key.last_request_ip,
        created_by_name: key.created_by_name,
        status: key.expires_at && new Date(key.expires_at) < new Date() ? 'expired' : 
                key.is_active ? 'active' : 'inactive'
      }));
      
      res.json({
        success: true,
        api_keys: safeApiKeys,
        total_count: safeApiKeys.length,
        active_count: safeApiKeys.filter(key => key.status === 'active').length
      });
      
    } catch (error) {
      console.error('Error listing API keys:', error);
      res.status(500).json({
        error: 'Failed to retrieve API keys',
        message: 'An error occurred while fetching API keys'
      });
    }
  }
);

/**
 * POST /api/organizations/current/api-keys
 * Create new API key (admin only)
 */
router.post('/api-keys',
  requireAdmin,
  validate({
    body: createApiKeySchema
  }),
  async (req, res) => {
    try {
      const { name, permissions, allowed_sources, rate_limit_per_hour, expires_at } = req.body;
      
      console.log(`🔑 Creating API key "${name}" for organization ${req.organizationId}`);
      
      // Check if API key name already exists for this organization
      const existingKeys = await ApiKey.findByOrganization(req.organizationId);
      const nameExists = existingKeys.some(key => 
        key.name.toLowerCase() === name.toLowerCase() && key.is_active
      );
      
      if (nameExists) {
        return res.status(409).json({
          error: 'API key name already exists',
          message: `An active API key with the name "${name}" already exists`,
          field: 'name'
        });
      }
      
      // Create the API key
      const apiKeyData = await ApiKey.create(req.organizationId, {
        name,
        permissions,
        allowed_sources,
        rate_limit_per_hour,
        expires_at
      }, req.user.id);
      
      console.log(`✅ API key created successfully: ${apiKeyData.key_prefix}`);
      
      // Return the API key with the plain text key (ONLY TIME IT'S SHOWN)
      res.status(201).json({
        success: true,
        message: 'API key created successfully',
        api_key: {
          id: apiKeyData.id,
          name: apiKeyData.name,
          key: apiKeyData.api_key, // ⚠️ FULL KEY - ONLY SHOWN ONCE
          key_prefix: apiKeyData.key_prefix,
          permissions: apiKeyData.permissions,
          allowed_sources: apiKeyData.allowed_sources,
          rate_limit_per_hour: apiKeyData.rate_limit_per_hour,
          expires_at: apiKeyData.expires_at,
          created_at: apiKeyData.created_at,
          is_active: apiKeyData.is_active
        },
        warning: {
          message: 'This is the only time the full API key will be displayed. Please store it securely.',
          security_note: 'The API key cannot be recovered if lost. You will need to create a new one.'
        }
      });
      
    } catch (error) {
      console.error('Error creating API key:', error);
      
      if (error.message.includes('Invalid permissions')) {
        return res.status(400).json({
          error: 'Invalid permissions',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'Failed to create API key',
        message: 'An error occurred while creating the API key'
      });
    }
  }
);

/**
 * DELETE /api/organizations/current/api-keys/:id
 * Deactivate API key (admin only)
 */
router.delete('/api-keys/:id',
  requireAdmin,
  validateUuidParam,
  async (req, res) => {
    try {
      const { id } = req.params;
      
      console.log(`🗑️ Deactivating API key ${id} for organization ${req.organizationId}`);
      
      // Check if API key exists and belongs to organization
      const apiKeys = await ApiKey.findByOrganization(req.organizationId, { includeInactive: true });
      const targetKey = apiKeys.find(key => key.id === id);
      
      if (!targetKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to your organization'
        });
      }
      
      if (!targetKey.is_active) {
        return res.status(400).json({
          error: 'API key already inactive',
          message: 'The specified API key is already deactivated'
        });
      }
      
      // Deactivate the API key
      const success = await ApiKey.deactivate(id, req.organizationId);
      
      if (!success) {
        return res.status(500).json({
          error: 'Deactivation failed',
          message: 'Failed to deactivate the API key'
        });
      }
      
      console.log(`✅ API key deactivated successfully: ${targetKey.name}`);
      
      res.json({
        success: true,
        message: 'API key deactivated successfully',
        api_key: {
          id: targetKey.id,
          name: targetKey.name,
          key_prefix: targetKey.key_prefix,
          status: 'deactivated',
          deactivated_at: new Date().toISOString(),
          deactivated_by: req.user.name || req.user.email
        }
      });
      
    } catch (error) {
      console.error('Error deactivating API key:', error);
      res.status(500).json({
        error: 'Failed to deactivate API key',
        message: 'An error occurred while deactivating the API key'
      });
    }
  }
);

/**
 * GET /api/organizations/current/api-keys/:id/usage
 * Get usage statistics for specific API key (admin only)
 */
router.get('/api-keys/:id/usage',
  requireAdmin,
  validateUuidParam,
  validate({
    query: usageStatsQuerySchema
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { startDate, endDate } = req.query;
      
      console.log(`📊 Getting usage stats for API key ${id}`);
      
      // Verify API key belongs to organization
      const apiKeys = await ApiKey.findByOrganization(req.organizationId, { includeInactive: true });
      const targetKey = apiKeys.find(key => key.id === id);
      
      if (!targetKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to your organization'
        });
      }
      
      // Set default date range (last 30 days)
      const options = {};
      if (startDate) options.startDate = new Date(startDate);
      if (endDate) options.endDate = new Date(endDate);
      
      // Get usage statistics
      const usageStats = await ApiKey.getUsageStats(id, options);
      
      // Get current rate limit status
      const rateLimitStatus = await ApiKey.checkRateLimit(id, targetKey.rate_limit_per_hour);
      
      res.json({
        success: true,
        api_key: {
          id: targetKey.id,
          name: targetKey.name,
          key_prefix: targetKey.key_prefix,
          is_active: targetKey.is_active
        },
        period: {
          start: options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: options.endDate || new Date()
        },
        usage_statistics: {
          total_requests: parseInt(usageStats.total_requests) || 0,
          successful_requests: parseInt(usageStats.successful_requests) || 0,
          failed_requests: parseInt(usageStats.failed_requests) || 0,
          success_rate: usageStats.total_requests > 0 ? 
            Math.round((usageStats.successful_requests / usageStats.total_requests) * 100) : 0,
          average_response_time_ms: usageStats.avg_response_time ? 
            Math.round(parseFloat(usageStats.avg_response_time)) : null,
          max_response_time_ms: usageStats.max_response_time ? 
            parseInt(usageStats.max_response_time) : null,
          total_data_transferred: {
            request_bytes: parseInt(usageStats.total_request_bytes) || 0,
            response_bytes: parseInt(usageStats.total_response_bytes) || 0
          },
          unique_source_ips: parseInt(usageStats.unique_ips) || 0,
          active_days: parseInt(usageStats.active_days) || 0
        },
        rate_limit_status: rateLimitStatus,
        key_info: {
          created_at: targetKey.created_at,
          last_used_at: targetKey.last_used_at,
          expires_at: targetKey.expires_at,
          permissions: targetKey.permissions,
          allowed_sources: targetKey.allowed_sources,
          rate_limit_per_hour: targetKey.rate_limit_per_hour
        }
      });
      
    } catch (error) {
      console.error('Error getting API key usage stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve usage statistics',
        message: 'An error occurred while fetching API key usage data'
      });
    }
  }
);

/**
 * PUT /api/organizations/current/api-keys/:id
 * Update API key configuration (admin only)
 */
router.put('/api-keys/:id',
  requireAdmin,
  validateUuidParam,
  validate({
    body: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      permissions: Joi.array()
        .items(Joi.string().valid(
          'contacts:read', 'contacts:write', 'contacts:delete',
          'leads:read', 'leads:write', 'leads:delete',
          'users:read', 'users:write',
          'organizations:read',
          'webhooks:read', 'webhooks:write',
          'analytics:read'
        ))
        .min(1)
        .optional(),
      allowed_sources: Joi.array()
        .items(Joi.string().ip({ version: ['ipv4', 'ipv6'] }))
        .allow(null)
        .optional(),
      rate_limit_per_hour: Joi.number()
        .integer()
        .min(1)
        .max(10000)
        .optional(),
      expires_at: Joi.date()
        .iso()
        .greater('now')
        .allow(null)
        .optional(),
      is_active: Joi.boolean().optional()
    }).min(1) // At least one field must be provided
  }),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      console.log(`✏️ Updating API key ${id} for organization ${req.organizationId}`);
      
      // Check if name conflicts with existing keys (if name is being updated)
      if (updates.name) {
        const existingKeys = await ApiKey.findByOrganization(req.organizationId);
        const nameConflict = existingKeys.some(key => 
          key.id !== id && 
          key.name.toLowerCase() === updates.name.toLowerCase() && 
          key.is_active
        );
        
        if (nameConflict) {
          return res.status(409).json({
            error: 'API key name already exists',
            message: `An active API key with the name "${updates.name}" already exists`,
            field: 'name'
          });
        }
      }
      
      // Update the API key
      const updatedKey = await ApiKey.update(id, req.organizationId, updates);
      
      if (!updatedKey) {
        return res.status(404).json({
          error: 'API key not found',
          message: 'The specified API key does not exist or does not belong to your organization'
        });
      }
      
      console.log(`✅ API key updated successfully: ${updatedKey.name}`);
      
      res.json({
        success: true,
        message: 'API key updated successfully',
        api_key: {
          id: updatedKey.id,
          name: updatedKey.name,
          key_prefix: updatedKey.key_prefix,
          permissions: updatedKey.permissions,
          allowed_sources: updatedKey.allowed_sources,
          rate_limit_per_hour: updatedKey.rate_limit_per_hour,
          is_active: updatedKey.is_active,
          expires_at: updatedKey.expires_at,
          updated_at: new Date().toISOString()
        }
      });
      
    } catch (error) {
      console.error('Error updating API key:', error);
      res.status(500).json({
        error: 'Failed to update API key',
        message: 'An error occurred while updating the API key'
      });
    }
  }
);

/**
 * GET /api/organizations/current/api-keys/permissions
 * Get available permissions list
 */
router.get('/api-keys/permissions',
  requireAdmin,
  async (req, res) => {
    try {
      const permissions = [
        {
          category: 'Contacts',
          permissions: [
            { value: 'contacts:read', label: 'Read Contacts', description: 'View contact information' },
            { value: 'contacts:write', label: 'Write Contacts', description: 'Create and update contacts' },
            { value: 'contacts:delete', label: 'Delete Contacts', description: 'Delete contacts' }
          ]
        },
        {
          category: 'Leads',
          permissions: [
            { value: 'leads:read', label: 'Read Leads', description: 'View lead information' },
            { value: 'leads:write', label: 'Write Leads', description: 'Create and update leads' },
            { value: 'leads:delete', label: 'Delete Leads', description: 'Delete leads' }
          ]
        },
        {
          category: 'Users',
          permissions: [
            { value: 'users:read', label: 'Read Users', description: 'View user information' },
            { value: 'users:write', label: 'Write Users', description: 'Create and update users' }
          ]
        },
        {
          category: 'Organization',
          permissions: [
            { value: 'organizations:read', label: 'Read Organization', description: 'View organization information' }
          ]
        },
        {
          category: 'Webhooks',
          permissions: [
            { value: 'webhooks:read', label: 'Read Webhooks', description: 'View webhook configurations' },
            { value: 'webhooks:write', label: 'Write Webhooks', description: 'Create and update webhooks' }
          ]
        },
        {
          category: 'Analytics',
          permissions: [
            { value: 'analytics:read', label: 'Read Analytics', description: 'View analytics and reports' }
          ]
        }
      ];
      
      res.json({
        success: true,
        permissions
      });
      
    } catch (error) {
      console.error('Error getting permissions list:', error);
      res.status(500).json({
        error: 'Failed to retrieve permissions',
        message: 'An error occurred while fetching available permissions'
      });
    }
  }
);

module.exports = router;