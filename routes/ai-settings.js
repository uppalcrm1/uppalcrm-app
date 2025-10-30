const express = require('express');
const Joi = require('joi');
const { validate } = require('../middleware/validation');
const {
  authenticateToken,
  requireAdmin,
  validateOrganizationContext
} = require('../middleware/auth');
const db = require('../db');
const sentimentService = require('../services/sentimentAnalysis');

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const updateAiSettingsSchema = Joi.object({
  sentiment_enabled: Joi.boolean().optional(),
  churn_detection_enabled: Joi.boolean().optional(),
  auto_analyze_emails: Joi.boolean().optional(),
  auto_analyze_tickets: Joi.boolean().optional(),

  churn_threshold_critical: Joi.number().integer().min(0).max(100).optional()
    .messages({
      'number.min': 'Critical threshold must be between 0 and 100',
      'number.max': 'Critical threshold must be between 0 and 100'
    }),

  churn_threshold_high: Joi.number().integer().min(0).max(100).optional()
    .messages({
      'number.min': 'High threshold must be between 0 and 100',
      'number.max': 'High threshold must be between 0 and 100'
    }),

  churn_threshold_medium: Joi.number().integer().min(0).max(100).optional()
    .messages({
      'number.min': 'Medium threshold must be between 0 and 100',
      'number.max': 'Medium threshold must be between 0 and 100'
    }),

  alert_on_critical: Joi.boolean().optional(),
  alert_on_high: Joi.boolean().optional(),
  alert_on_medium: Joi.boolean().optional(),

  alert_emails: Joi.array()
    .items(Joi.string().email())
    .max(10)
    .allow(null)
    .optional()
    .messages({
      'string.email': 'Invalid email address format',
      'array.max': 'Maximum 10 alert email addresses allowed'
    }),

  alert_slack_webhook: Joi.string().uri().allow(null, '').optional()
    .messages({
      'string.uri': 'Invalid Slack webhook URL'
    }),

  alert_teams_webhook: Joi.string().uri().allow(null, '').optional()
    .messages({
      'string.uri': 'Invalid Teams webhook URL'
    }),

  alert_custom_webhook: Joi.string().uri().allow(null, '').optional()
    .messages({
      'string.uri': 'Invalid webhook URL'
    }),

  min_confidence_threshold: Joi.number().min(0.0).max(1.0).optional()
    .messages({
      'number.min': 'Confidence threshold must be between 0.0 and 1.0',
      'number.max': 'Confidence threshold must be between 0.0 and 1.0'
    }),

  analysis_language: Joi.string().length(2).optional()
    .messages({
      'string.length': 'Language code must be 2 characters (ISO 639-1)'
    })
}).custom((value, helpers) => {
  // Validate that thresholds are in order: critical < high < medium
  const { churn_threshold_critical, churn_threshold_high, churn_threshold_medium } = value;

  if (churn_threshold_critical !== undefined && churn_threshold_high !== undefined) {
    if (churn_threshold_critical >= churn_threshold_high) {
      return helpers.error('custom.thresholdOrder', {
        message: 'Critical threshold must be less than high threshold'
      });
    }
  }

  if (churn_threshold_high !== undefined && churn_threshold_medium !== undefined) {
    if (churn_threshold_high >= churn_threshold_medium) {
      return helpers.error('custom.thresholdOrder', {
        message: 'High threshold must be less than medium threshold'
      });
    }
  }

  if (churn_threshold_critical !== undefined && churn_threshold_medium !== undefined) {
    if (churn_threshold_critical >= churn_threshold_medium) {
      return helpers.error('custom.thresholdOrder', {
        message: 'Critical threshold must be less than medium threshold'
      });
    }
  }

  return value;
});

const testSentimentSchema = Joi.object({
  text: Joi.string().min(10).max(5000).required()
    .messages({
      'string.empty': 'Text is required for sentiment analysis',
      'string.min': 'Text must be at least 10 characters',
      'string.max': 'Text must not exceed 5000 characters'
    }),

  entity_type: Joi.string().valid('contact', 'lead', 'ticket', 'email', 'other')
    .default('other')
    .optional(),

  entity_id: Joi.string().uuid().allow(null).optional()
});

// =============================================================================
// AI SETTINGS ENDPOINTS
// =============================================================================

/**
 * GET /api/organizations/current/ai-settings
 * Get organization's AI configuration
 */
router.get('/ai-settings',
  requireAdmin,
  async (req, res) => {
    try {
      console.log(`⚙️  Getting AI settings for organization ${req.organizationId}`);

      const result = await db.query(`
        SELECT
          id,
          organization_id,
          sentiment_enabled,
          churn_detection_enabled,
          auto_analyze_emails,
          auto_analyze_tickets,
          churn_threshold_critical,
          churn_threshold_high,
          churn_threshold_medium,
          alert_on_critical,
          alert_on_high,
          alert_on_medium,
          alert_emails,
          alert_slack_webhook,
          alert_teams_webhook,
          alert_custom_webhook,
          min_confidence_threshold,
          analysis_language,
          total_analyses,
          analyses_this_month,
          last_analysis_at,
          created_at,
          updated_at
        FROM organization_ai_settings
        WHERE organization_id = $1
      `, [req.organizationId]);

      let settings;

      if (result.rows.length === 0) {
        // Create default settings if they don't exist
        const insertResult = await db.query(`
          INSERT INTO organization_ai_settings (organization_id, created_by)
          VALUES ($1, $2)
          RETURNING *
        `, [req.organizationId, req.user.id]);

        settings = insertResult.rows[0];
        console.log(`✅ Created default AI settings for organization ${req.organizationId}`);
      } else {
        settings = result.rows[0];
      }

      res.json({
        success: true,
        settings: {
          id: settings.id,
          feature_flags: {
            sentiment_enabled: settings.sentiment_enabled,
            churn_detection_enabled: settings.churn_detection_enabled,
            auto_analyze_emails: settings.auto_analyze_emails,
            auto_analyze_tickets: settings.auto_analyze_tickets
          },
          thresholds: {
            critical: settings.churn_threshold_critical,
            high: settings.churn_threshold_high,
            medium: settings.churn_threshold_medium
          },
          alerts: {
            alert_on_critical: settings.alert_on_critical,
            alert_on_high: settings.alert_on_high,
            alert_on_medium: settings.alert_on_medium
          },
          notification_channels: {
            emails: settings.alert_emails || [],
            slack_webhook: settings.alert_slack_webhook,
            teams_webhook: settings.alert_teams_webhook,
            custom_webhook: settings.alert_custom_webhook
          },
          advanced: {
            min_confidence_threshold: parseFloat(settings.min_confidence_threshold),
            analysis_language: settings.analysis_language
          },
          usage: {
            total_analyses: settings.total_analyses,
            analyses_this_month: settings.analyses_this_month,
            last_analysis_at: settings.last_analysis_at
          },
          metadata: {
            created_at: settings.created_at,
            updated_at: settings.updated_at
          }
        }
      });

    } catch (error) {
      console.error('Error getting AI settings:', error);
      res.status(500).json({
        error: 'Failed to retrieve AI settings',
        message: 'An error occurred while fetching AI configuration'
      });
    }
  }
);

/**
 * PUT /api/organizations/current/ai-settings
 * Update organization's AI configuration (admin only)
 */
router.put('/ai-settings',
  requireAdmin,
  validate({
    body: updateAiSettingsSchema
  }),
  async (req, res) => {
    try {
      const updates = req.body;

      console.log(`✏️  Updating AI settings for organization ${req.organizationId}`);

      // Build dynamic UPDATE query
      const updateFields = [];
      const values = [req.organizationId];
      let paramIndex = 2;

      for (const [key, value] of Object.entries(updates)) {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          error: 'No fields to update',
          message: 'At least one field must be provided'
        });
      }

      // Add updated_by and updated_at
      updateFields.push(`updated_by = $${paramIndex}`);
      values.push(req.user.id);
      paramIndex++;

      updateFields.push(`updated_at = NOW()`);

      const query = `
        UPDATE organization_ai_settings
        SET ${updateFields.join(', ')}
        WHERE organization_id = $1
        RETURNING *
      `;

      const result = await db.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'AI settings not found',
          message: 'AI settings do not exist for this organization. They should have been created automatically.'
        });
      }

      const settings = result.rows[0];

      console.log(`✅ AI settings updated successfully for organization ${req.organizationId}`);

      res.json({
        success: true,
        message: 'AI settings updated successfully',
        settings: {
          id: settings.id,
          feature_flags: {
            sentiment_enabled: settings.sentiment_enabled,
            churn_detection_enabled: settings.churn_detection_enabled,
            auto_analyze_emails: settings.auto_analyze_emails,
            auto_analyze_tickets: settings.auto_analyze_tickets
          },
          thresholds: {
            critical: settings.churn_threshold_critical,
            high: settings.churn_threshold_high,
            medium: settings.churn_threshold_medium
          },
          alerts: {
            alert_on_critical: settings.alert_on_critical,
            alert_on_high: settings.alert_on_high,
            alert_on_medium: settings.alert_on_medium
          },
          notification_channels: {
            emails: settings.alert_emails || [],
            slack_webhook: settings.alert_slack_webhook,
            teams_webhook: settings.alert_teams_webhook,
            custom_webhook: settings.alert_custom_webhook
          },
          advanced: {
            min_confidence_threshold: parseFloat(settings.min_confidence_threshold),
            analysis_language: settings.analysis_language
          },
          updated_at: settings.updated_at
        }
      });

    } catch (error) {
      console.error('Error updating AI settings:', error);

      if (error.message && error.message.includes('thresholds_ordered')) {
        return res.status(400).json({
          error: 'Invalid threshold configuration',
          message: 'Thresholds must be ordered: critical < high < medium'
        });
      }

      res.status(500).json({
        error: 'Failed to update AI settings',
        message: 'An error occurred while updating AI configuration'
      });
    }
  }
);

/**
 * POST /api/organizations/current/ai-settings/test
 * Test sentiment analysis with sample text (admin only)
 */
router.post('/ai-settings/test',
  requireAdmin,
  validate({
    body: testSentimentSchema
  }),
  async (req, res) => {
    try {
      const { text, entity_type, entity_id } = req.body;

      console.log(`🧪 Testing sentiment analysis for organization ${req.organizationId}`);

      // Get organization's AI settings
      const settingsResult = await db.query(`
        SELECT * FROM organization_ai_settings
        WHERE organization_id = $1
      `, [req.organizationId]);

      if (settingsResult.rows.length === 0) {
        return res.status(404).json({
          error: 'AI settings not configured',
          message: 'Please configure AI settings before testing'
        });
      }

      const orgSettings = settingsResult.rows[0];

      if (!orgSettings.sentiment_enabled) {
        return res.status(403).json({
          error: 'Sentiment analysis disabled',
          message: 'Sentiment analysis is disabled for your organization. Enable it in AI settings.'
        });
      }

      // Run sentiment analysis
      const startTime = Date.now();

      const analysis = await sentimentService.analyzeCustomerEmail(
        text,
        {
          id: entity_id || 'test',
          name: 'Test Entity',
          email: 'test@example.com'
        },
        orgSettings
      );

      const processingTime = Date.now() - startTime;

      // Generate alert if needed
      const alert = sentimentService.generateChurnAlert(analysis, orgSettings);

      console.log(`✅ Test analysis completed in ${processingTime}ms`);

      res.json({
        success: true,
        message: 'Sentiment analysis test completed',
        test_results: {
          sentiment: {
            score: analysis.sentiment.sentiment,
            score_percentage: `${(analysis.sentiment.sentiment * 100).toFixed(1)}%`,
            label: analysis.sentiment.label,
            confidence_scores: {
              positive: `${(analysis.sentiment.scores.positive * 100).toFixed(1)}%`,
              neutral: `${(analysis.sentiment.scores.neutral * 100).toFixed(1)}%`,
              negative: `${(analysis.sentiment.scores.negative * 100).toFixed(1)}%`
            }
          },
          churn_risk: {
            level: analysis.churnRisk.riskLevel,
            score: analysis.churnRisk.riskScore,
            color: analysis.churnRisk.color,
            recommended_action: analysis.churnRisk.action,
            message: analysis.churnRisk.message,
            thresholds_used: analysis.churnRisk.thresholdsUsed
          },
          alert: alert ? {
            would_trigger: true,
            priority: alert.priority,
            message: alert.message,
            action: alert.action,
            notification_channels: alert.notificationChannels
          } : {
            would_trigger: false,
            reason: 'Risk level does not meet alert threshold'
          },
          processing_time_ms: processingTime,
          analyzed_text_preview: text.substring(0, 200) + (text.length > 200 ? '...' : '')
        }
      });

    } catch (error) {
      console.error('Error testing sentiment analysis:', error);

      if (error.message && error.message.includes('Azure Text Analytics')) {
        return res.status(503).json({
          error: 'Azure service unavailable',
          message: 'Failed to connect to Azure Text Analytics. Please check API credentials.'
        });
      }

      res.status(500).json({
        error: 'Test failed',
        message: error.message || 'An error occurred while testing sentiment analysis'
      });
    }
  }
);

/**
 * GET /api/organizations/current/ai-settings/usage
 * Get AI usage statistics for current month
 */
router.get('/ai-settings/usage',
  requireAdmin,
  async (req, res) => {
    try {
      console.log(`📊 Getting AI usage stats for organization ${req.organizationId}`);

      // Get overall stats
      const settingsResult = await db.query(`
        SELECT
          total_analyses,
          analyses_this_month,
          last_analysis_at
        FROM organization_ai_settings
        WHERE organization_id = $1
      `, [req.organizationId]);

      if (settingsResult.rows.length === 0) {
        return res.status(404).json({
          error: 'AI settings not found',
          message: 'AI settings have not been configured'
        });
      }

      const stats = settingsResult.rows[0];

      // Get breakdown by risk level (last 30 days)
      const riskBreakdown = await db.query(`
        SELECT
          churn_risk_level,
          COUNT(*) as count,
          AVG(sentiment_score) as avg_sentiment
        FROM sentiment_analysis_history
        WHERE organization_id = $1
        AND analyzed_at >= NOW() - INTERVAL '30 days'
        GROUP BY churn_risk_level
        ORDER BY
          CASE churn_risk_level
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END
      `, [req.organizationId]);

      // Get alert statistics
      const alertStats = await db.query(`
        SELECT
          status,
          priority,
          COUNT(*) as count
        FROM churn_alerts
        WHERE organization_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY status, priority
        ORDER BY priority, status
      `, [req.organizationId]);

      res.json({
        success: true,
        usage_statistics: {
          all_time: {
            total_analyses: stats.total_analyses,
            last_analysis: stats.last_analysis_at
          },
          current_month: {
            analyses: stats.analyses_this_month,
            remaining_free_tier: Math.max(0, 5000 - stats.analyses_this_month)
          },
          last_30_days: {
            by_risk_level: riskBreakdown.rows.map(row => ({
              risk_level: row.churn_risk_level,
              count: parseInt(row.count),
              avg_sentiment: parseFloat(row.avg_sentiment).toFixed(3)
            })),
            alerts: alertStats.rows.map(row => ({
              status: row.status,
              priority: row.priority,
              count: parseInt(row.count)
            }))
          }
        }
      });

    } catch (error) {
      console.error('Error getting AI usage statistics:', error);
      res.status(500).json({
        error: 'Failed to retrieve usage statistics',
        message: 'An error occurred while fetching AI usage data'
      });
    }
  }
);

/**
 * POST /api/organizations/current/ai-settings/reset-defaults
 * Reset AI settings to default values (admin only)
 */
router.post('/ai-settings/reset-defaults',
  requireAdmin,
  async (req, res) => {
    try {
      console.log(`🔄 Resetting AI settings to defaults for organization ${req.organizationId}`);

      const result = await db.query(`
        UPDATE organization_ai_settings
        SET
          sentiment_enabled = true,
          churn_detection_enabled = true,
          auto_analyze_emails = false,
          auto_analyze_tickets = false,
          churn_threshold_critical = 30,
          churn_threshold_high = 50,
          churn_threshold_medium = 70,
          alert_on_critical = true,
          alert_on_high = false,
          alert_on_medium = false,
          alert_emails = ARRAY[]::TEXT[],
          alert_slack_webhook = NULL,
          alert_teams_webhook = NULL,
          alert_custom_webhook = NULL,
          min_confidence_threshold = 0.60,
          analysis_language = 'en',
          updated_by = $2,
          updated_at = NOW()
        WHERE organization_id = $1
        RETURNING *
      `, [req.organizationId, req.user.id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'AI settings not found',
          message: 'AI settings do not exist for this organization'
        });
      }

      console.log(`✅ AI settings reset to defaults for organization ${req.organizationId}`);

      res.json({
        success: true,
        message: 'AI settings reset to default values',
        settings: result.rows[0]
      });

    } catch (error) {
      console.error('Error resetting AI settings:', error);
      res.status(500).json({
        error: 'Failed to reset AI settings',
        message: 'An error occurred while resetting AI configuration'
      });
    }
  }
);

module.exports = router;
