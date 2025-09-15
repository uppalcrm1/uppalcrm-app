const express = require('express');
const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const Lead = require('../models/Lead');
const ApiKey = require('../models/ApiKey');
const { validate } = require('../middleware/validation');
const { query } = require('../database/connection');

const router = express.Router();

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * API Key Authentication Middleware
 * Validates X-API-Key header and sets organization context
 */
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'Missing API Key',
        message: 'X-API-Key header is required'
      });
    }

    // Verify API key and get organization context
    const keyData = await ApiKey.verify(apiKey);
    
    if (!keyData) {
      return res.status(401).json({
        error: 'Invalid API Key',
        message: 'The provided API key is invalid or expired'
      });
    }

    // Check if organization is active
    if (!keyData.organization) {
      return res.status(401).json({
        error: 'Organization not found',
        message: 'The organization associated with this API key is not active'
      });
    }

    // Check rate limit for this API key
    const rateStatus = await ApiKey.checkRateLimit(keyData.id, keyData.rate_limit_per_hour);
    
    if (rateStatus.exceeded) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `API key has exceeded rate limit of ${keyData.rate_limit_per_hour} requests per hour`,
        rate_limit: rateStatus
      });
    }

    // Check IP restrictions if configured
    const clientIp = req.ip || req.connection.remoteAddress;
    if (!ApiKey.isSourceAllowed(keyData.allowed_sources, clientIp)) {
      return res.status(403).json({
        error: 'Source Not Allowed',
        message: 'Request source IP is not in the allowed list'
      });
    }

    // Set context for downstream middleware
    req.apiKey = keyData;
    req.organizationId = keyData.organization.id;
    req.organizationSlug = keyData.organization.slug;
    req.clientIp = clientIp;

    next();
  } catch (error) {
    console.error('API key authentication error:', error);
    res.status(500).json({
      error: 'Authentication Error',
      message: 'An error occurred while validating the API key'
    });
  }
};

/**
 * Permission Check Middleware
 * Verifies API key has required permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!ApiKey.hasPermission(req.apiKey.permissions, permission)) {
      return res.status(403).json({
        error: 'Insufficient Permissions',
        message: `API key does not have '${permission}' permission`,
        required_permission: permission,
        current_permissions: req.apiKey.permissions
      });
    }
    next();
  };
};

/**
 * Usage Logging Middleware
 * Logs API usage for analytics and billing
 */
const logUsage = async (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;
  
  // Override res.send to capture response details
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    const responseSize = Buffer.byteLength(data || '', 'utf8');
    
    // Log usage asynchronously
    setImmediate(async () => {
      try {
        await ApiKey.logUsage(req.apiKey.id, req.organizationId, {
          endpoint: req.path,
          method: req.method,
          status_code: res.statusCode,
          source_ip: req.clientIp,
          user_agent: req.headers['user-agent'],
          request_size_bytes: req.headers['content-length'] ? parseInt(req.headers['content-length']) : null,
          response_size_bytes: responseSize,
          response_time_ms: responseTime,
          request_id: req.headers['x-request-id'] || null
        });
      } catch (error) {
        console.error('Failed to log API usage:', error);
      }
    });
    
    originalSend.call(this, data);
  };
  
  next();
};

/**
 * Organization-specific rate limiting
 */
const organizationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Use API key's rate limit if available, otherwise default
    return req.apiKey ? Math.ceil(req.apiKey.rate_limit_per_hour / 4) : 100; // 1/4 of hourly limit per 15 min
  },
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.'
  },
  keyGenerator: (req) => `webhook_${req.organizationId}`,
  standardHeaders: true,
  legacyHeaders: false
});

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const webhookParamsSchema = Joi.object({
  webhookId: Joi.string().uuid().required()
});

const leadCreationSchema = Joi.object({
  // Core lead fields
  first_name: Joi.string().min(1).max(100).required(),
  last_name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().max(255).required(),
  phone: Joi.string().max(20).allow(null, ''),
  company: Joi.string().max(255).allow(null, ''),
  
  // Lead specifics
  lead_source: Joi.string().max(100).default('Zapier Webhook'),
  status: Joi.string().valid('new', 'contacted', 'qualified', 'converted', 'lost').default('new'),
  priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
  
  // Contact details
  website: Joi.string().uri().allow(null, ''),
  address: Joi.string().max(500).allow(null, ''),
  city: Joi.string().max(100).allow(null, ''),
  state: Joi.string().max(100).allow(null, ''),
  country: Joi.string().max(100).allow(null, ''),
  postal_code: Joi.string().max(20).allow(null, ''),
  
  // Additional data
  notes: Joi.string().max(2000).allow(null, ''),
  tags: Joi.array().items(Joi.string().max(50)).max(10).default([]),
  custom_fields: Joi.object().pattern(Joi.string(), Joi.any()).default({}),
  
  // Zapier-specific fields
  zapier_webhook_id: Joi.string().allow(null, ''),
  external_id: Joi.string().max(255).allow(null, ''), // For tracking external system IDs
  
  // Assignment
  assigned_to: Joi.string().uuid().allow(null)
});

const genericWebhookSchema = Joi.object({
  // Allow flexible field mapping
  data: Joi.object().required(),
  field_mapping: Joi.object().pattern(
    Joi.string(), // target field
    Joi.string()  // source field path
  ).default({}),
  webhook_config: Joi.object({
    transform_rules: Joi.array().items(Joi.object()),
    default_values: Joi.object()
  }).default({})
});

// =============================================================================
// FIELD MAPPING UTILITIES
// =============================================================================

/**
 * Map incoming webhook data to lead fields using field mapping configuration
 */
function mapWebhookDataToLead(incomingData, fieldMapping = {}, defaultValues = {}) {
  const mappedData = { ...defaultValues };
  
  // Default field mappings for common webhook formats
  const defaultMappings = {
    first_name: ['first_name', 'firstName', 'fname', 'given_name'],
    last_name: ['last_name', 'lastName', 'lname', 'family_name', 'surname'],
    email: ['email', 'email_address', 'emailAddress'],
    phone: ['phone', 'phone_number', 'phoneNumber', 'mobile'],
    company: ['company', 'company_name', 'organization', 'business_name'],
    website: ['website', 'url', 'company_website'],
    lead_source: ['source', 'lead_source', 'referrer', 'utm_source'],
    notes: ['notes', 'message', 'description', 'comments']
  };
  
  // Apply custom field mappings
  Object.entries(fieldMapping).forEach(([targetField, sourceField]) => {
    const value = getNestedValue(incomingData, sourceField);
    if (value !== undefined && value !== null && value !== '') {
      mappedData[targetField] = value;
    }
  });
  
  // Apply default mappings for unmapped fields
  Object.entries(defaultMappings).forEach(([targetField, sourcePaths]) => {
    if (mappedData[targetField] === undefined) {
      for (const sourcePath of sourcePaths) {
        const value = getNestedValue(incomingData, sourcePath);
        if (value !== undefined && value !== null && value !== '') {
          mappedData[targetField] = value;
          break;
        }
      }
    }
  });
  
  // Set defaults for required fields if missing
  if (!mappedData.lead_source) {
    mappedData.lead_source = 'Zapier Webhook';
  }
  
  if (!mappedData.status) {
    mappedData.status = 'new';
  }
  
  if (!mappedData.priority) {
    mappedData.priority = 'medium';
  }
  
  return mappedData;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

/**
 * Get webhook endpoint configuration
 */
async function getWebhookConfig(webhookId, organizationId) {
  const result = await query(`
    SELECT we.*, o.name as organization_name
    FROM webhook_endpoints we
    JOIN organizations o ON we.organization_id = o.id
    WHERE we.id = $1 AND we.organization_id = $2 AND we.is_active = true
  `, [webhookId, organizationId]);
  
  return result.rows.length > 0 ? result.rows[0] : null;
}

// =============================================================================
// WEBHOOK ENDPOINTS
// =============================================================================

/**
 * POST /api/webhooks/:webhookId
 * Generic webhook endpoint that receives data from Zapier and creates leads
 */
router.post('/:webhookId',
  authenticateApiKey,
  requirePermission('leads:write'),
  organizationRateLimit,
  logUsage,
  validate({
    params: webhookParamsSchema,
    body: genericWebhookSchema
  }),
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      const { data, field_mapping, webhook_config } = req.body;
      
      console.log(`🪝 Webhook ${webhookId} received data for org ${req.organizationId}`);
      
      // Get webhook configuration
      const webhookConfig = await getWebhookConfig(webhookId, req.organizationId);
      
      if (!webhookConfig) {
        return res.status(404).json({
          error: 'Webhook Not Found',
          message: 'The specified webhook endpoint is not found or inactive',
          webhook_id: webhookId
        });
      }
      
      // Map incoming data to lead format
      const defaultValues = webhook_config.default_values || {};
      const mappedLeadData = mapWebhookDataToLead(data, field_mapping, defaultValues);
      
      // Add webhook tracking information
      mappedLeadData.zapier_webhook_id = webhookId;
      mappedLeadData.lead_source = mappedLeadData.lead_source || webhookConfig.name || 'Zapier Webhook';
      
      // Validate mapped data
      const { error, value: validatedData } = leadCreationSchema.validate(mappedLeadData);
      
      if (error) {
        return res.status(400).json({
          error: 'Invalid Lead Data',
          message: 'The mapped webhook data is invalid',
          validation_errors: error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message
          })),
          mapped_data: mappedLeadData
        });
      }
      
      // Create the lead
      const lead = await Lead.create(validatedData, req.organizationId);
      
      // Update webhook statistics
      await query(`
        UPDATE webhook_endpoints 
        SET 
          total_deliveries = total_deliveries + 1,
          successful_deliveries = successful_deliveries + 1,
          last_success_at = NOW(),
          last_triggered_at = NOW()
        WHERE id = $1
      `, [webhookId]);
      
      // Log webhook delivery
      await query(`
        INSERT INTO webhook_delivery_logs (
          webhook_endpoint_id, organization_id, event_type, payload,
          status_code, delivered_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `, [
        webhookId,
        req.organizationId,
        'lead.created',
        JSON.stringify({ incoming_data: data, mapped_data: validatedData }),
        200
      ]);
      
      res.status(201).json({
        success: true,
        message: 'Lead created successfully via webhook',
        lead: {
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          status: lead.status,
          lead_source: lead.lead_source
        },
        webhook: {
          id: webhookId,
          name: webhookConfig.name
        }
      });
      
    } catch (error) {
      console.error('Webhook processing error:', error);
      
      // Log failed webhook delivery
      try {
        await query(`
          INSERT INTO webhook_delivery_logs (
            webhook_endpoint_id, organization_id, event_type, payload,
            status_code, error_message
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          req.params.webhookId,
          req.organizationId,
          'lead.created',
          JSON.stringify(req.body),
          500,
          error.message
        ]);
        
        await query(`
          UPDATE webhook_endpoints 
          SET 
            total_deliveries = total_deliveries + 1,
            failed_deliveries = failed_deliveries + 1,
            last_failure_at = NOW(),
            last_triggered_at = NOW()
          WHERE id = $1
        `, [req.params.webhookId]);
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
      
      res.status(500).json({
        error: 'Webhook Processing Failed',
        message: 'An error occurred while processing the webhook',
        webhook_id: req.params.webhookId
      });
    }
  }
);

/**
 * POST /api/webhooks/leads
 * Direct lead creation endpoint for Zapier
 */
router.post('/leads',
  authenticateApiKey,
  requirePermission('leads:write'),
  organizationRateLimit,
  logUsage,
  validate({
    body: leadCreationSchema
  }),
  async (req, res) => {
    try {
      console.log(`📝 Direct lead creation for org ${req.organizationId}`);
      
      // Create the lead
      const lead = await Lead.create(req.body, req.organizationId);
      
      res.status(201).json({
        success: true,
        message: 'Lead created successfully',
        lead: {
          id: lead.id,
          first_name: lead.first_name,
          last_name: lead.last_name,
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
          status: lead.status,
          priority: lead.priority,
          lead_source: lead.lead_source,
          created_at: lead.created_at
        }
      });
      
    } catch (error) {
      console.error('Direct lead creation error:', error);
      
      if (error.message && error.message.includes('duplicate')) {
        return res.status(409).json({
          error: 'Duplicate Lead',
          message: 'A lead with this email already exists',
          field: 'email'
        });
      }
      
      res.status(500).json({
        error: 'Lead Creation Failed',
        message: 'An error occurred while creating the lead'
      });
    }
  }
);

/**
 * GET /api/webhooks/test/:webhookId
 * Test webhook endpoint to verify configuration
 */
router.get('/test/:webhookId',
  authenticateApiKey,
  requirePermission('webhooks:read'),
  organizationRateLimit,
  logUsage,
  validate({
    params: webhookParamsSchema
  }),
  async (req, res) => {
    try {
      const { webhookId } = req.params;
      
      // Get webhook configuration
      const webhookConfig = await getWebhookConfig(webhookId, req.organizationId);
      
      if (!webhookConfig) {
        return res.status(404).json({
          error: 'Webhook Not Found',
          message: 'The specified webhook endpoint is not found or inactive',
          webhook_id: webhookId
        });
      }
      
      // Generate test data
      const testData = {
        first_name: 'Test',
        last_name: 'Lead',
        email: `test-${Date.now()}@example.com`,
        phone: '+1-555-0123',
        company: 'Test Company',
        lead_source: 'Webhook Test',
        notes: `Test lead created via webhook ${webhookId} at ${new Date().toISOString()}`
      };
      
      res.json({
        success: true,
        message: 'Webhook test endpoint is accessible',
        webhook: {
          id: webhookConfig.id,
          name: webhookConfig.name,
          url: req.originalUrl,
          is_active: webhookConfig.is_active,
          events: webhookConfig.events,
          last_triggered_at: webhookConfig.last_triggered_at,
          total_deliveries: webhookConfig.total_deliveries,
          successful_deliveries: webhookConfig.successful_deliveries,
          failed_deliveries: webhookConfig.failed_deliveries
        },
        api_key: {
          name: req.apiKey.name,
          permissions: req.apiKey.permissions,
          rate_limit_per_hour: req.apiKey.rate_limit_per_hour
        },
        test_data: testData,
        instructions: {
          message: 'To create a lead via this webhook, send a POST request to the same URL with lead data',
          example_payload: testData,
          required_headers: {
            'X-API-Key': 'your-api-key',
            'Content-Type': 'application/json'
          }
        }
      });
      
    } catch (error) {
      console.error('Webhook test error:', error);
      res.status(500).json({
        error: 'Test Failed',
        message: 'An error occurred while testing the webhook endpoint'
      });
    }
  }
);

/**
 * GET /api/webhooks/stats
 * Get webhook usage statistics
 */
router.get('/stats',
  authenticateApiKey,
  requirePermission('webhooks:read'),
  logUsage,
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();
      
      // Get webhook statistics
      const webhookStats = await query(`
        SELECT 
          we.id,
          we.name,
          we.total_deliveries,
          we.successful_deliveries,
          we.failed_deliveries,
          we.last_triggered_at,
          we.last_success_at,
          we.last_failure_at,
          COUNT(wdl.id) as recent_deliveries,
          COUNT(CASE WHEN wdl.status_code >= 200 AND wdl.status_code < 300 THEN 1 END) as recent_successful,
          COUNT(CASE WHEN wdl.status_code >= 400 OR wdl.status_code IS NULL THEN 1 END) as recent_failed
        FROM webhook_endpoints we
        LEFT JOIN webhook_delivery_logs wdl ON we.id = wdl.webhook_endpoint_id 
          AND wdl.created_at BETWEEN $2 AND $3
        WHERE we.organization_id = $1
        GROUP BY we.id, we.name, we.total_deliveries, we.successful_deliveries, 
                 we.failed_deliveries, we.last_triggered_at, we.last_success_at, we.last_failure_at
        ORDER BY we.total_deliveries DESC
      `, [req.organizationId, start, end]);
      
      res.json({
        success: true,
        period: {
          start: start.toISOString(),
          end: end.toISOString()
        },
        webhooks: webhookStats.rows
      });
      
    } catch (error) {
      console.error('Webhook stats error:', error);
      res.status(500).json({
        error: 'Stats Retrieval Failed',
        message: 'An error occurred while retrieving webhook statistics'
      });
    }
  }
);

module.exports = router;