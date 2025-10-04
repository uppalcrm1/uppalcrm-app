const express = require('express');
const Organization = require('../models/Organization');
const Lead = require('../models/Lead');
const Contact = require('../models/Contact');
const { 
  validateUpdateOrganization, 
  validateUuidParam 
} = require('../middleware/validation');
const { 
  authenticateToken, 
  requireAdmin,
  validateOrganizationContext 
} = require('../middleware/auth');

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

/**
 * GET /organizations/current
 * Get current organization information
 */
router.get('/current',
  async (req, res) => {
    try {
      const organization = await Organization.findById(req.organizationId);

      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Current organization does not exist'
        });
      }

      res.json({
        organization: organization.toJSON()
      });
    } catch (error) {
      console.error('Get organization error:', error);
      res.status(500).json({
        error: 'Failed to retrieve organization',
        message: 'Unable to get organization information'
      });
    }
  }
);

/**
 * GET /organizations/current/trial-info
 * Get trial information for current organization
 */
router.get('/current/trial-info',
  async (req, res) => {
    try {
      const { query } = require('../database/connection');

      const result = await query(`
        SELECT
          o.is_trial,
          o.trial_status,
          o.trial_expires_at,
          GREATEST(0, EXTRACT(DAY FROM (o.trial_expires_at - NOW()))::INTEGER) as days_remaining,
          CASE
            WHEN o.trial_expires_at IS NULL THEN null
            WHEN o.trial_expires_at > NOW() + INTERVAL '15 days' THEN 'green'
            WHEN o.trial_expires_at > NOW() + INTERVAL '7 days' THEN 'yellow'
            ELSE 'red'
          END as urgency_color
        FROM organizations o
        WHERE o.id = $1
      `, [req.organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Organization not found'
        });
      }

      const trialInfo = result.rows[0];

      res.json({
        is_trial: trialInfo.is_trial,
        trial_status: trialInfo.trial_status,
        trial_expires_at: trialInfo.trial_expires_at,
        days_remaining: trialInfo.days_remaining,
        urgency_color: trialInfo.urgency_color,
        show_banner: trialInfo.is_trial && trialInfo.trial_status === 'active'
      });
    } catch (error) {
      console.error('Get trial info error:', error);
      res.status(500).json({
        error: 'Failed to retrieve trial information',
        message: 'Unable to get trial information'
      });
    }
  }
);

/**
 * PUT /organizations/current
 * Update current organization (admin only)
 */
router.put('/current',
  requireAdmin,
  validateUpdateOrganization,
  async (req, res) => {
    try {
      const organization = await Organization.update(req.organizationId, req.body);
      
      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Organization does not exist'
        });
      }

      res.json({
        message: 'Organization updated successfully',
        organization: organization.toJSON()
      });
    } catch (error) {
      console.error('Update organization error:', error);
      res.status(500).json({
        error: 'Organization update failed',
        message: 'Unable to update organization'
      });
    }
  }
);

/**
 * GET /organizations/current/stats
 * Get organization statistics (admin only)
 */
router.get('/current/stats',
  requireAdmin,
  async (req, res) => {
    try {
      const stats = await Organization.getStats(req.organizationId);
      
      if (!stats) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Organization statistics not available'
        });
      }

      // Additional detailed statistics
      const { query } = require('../database/connection');
      
      const detailedStats = await query(`
        SELECT 
          -- User activity stats
          COUNT(CASE WHEN u.last_login > NOW() - INTERVAL '1 day' THEN 1 END) as active_today,
          COUNT(CASE WHEN u.last_login > NOW() - INTERVAL '7 days' THEN 1 END) as active_this_week,
          COUNT(CASE WHEN u.last_login > NOW() - INTERVAL '30 days' THEN 1 END) as active_this_month,
          
          -- User role distribution
          COUNT(CASE WHEN u.role = 'admin' AND u.is_active THEN 1 END) as active_admins,
          COUNT(CASE WHEN u.role = 'user' AND u.is_active THEN 1 END) as active_users,
          COUNT(CASE WHEN u.role = 'viewer' AND u.is_active THEN 1 END) as active_viewers,
          
          -- Account verification stats
          COUNT(CASE WHEN u.email_verified AND u.is_active THEN 1 END) as verified_users,
          COUNT(CASE WHEN NOT u.email_verified AND u.is_active THEN 1 END) as unverified_users,
          
          -- Growth metrics
          COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '7 days' THEN 1 END) as new_users_this_week,
          COUNT(CASE WHEN u.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as new_users_this_month
          
        FROM users u
        WHERE u.organization_id = $1
      `, [req.organizationId], req.organizationId);

      const sessionStats = await query(`
        SELECT 
          COUNT(*) as active_sessions,
          COUNT(DISTINCT user_id) as users_with_active_sessions
        FROM user_sessions 
        WHERE organization_id = $1 AND expires_at > NOW()
      `, [req.organizationId], req.organizationId);

      // Get lead and contact statistics for dashboard
      let leadStats = null;
      let contactStats = null;
      
      try {
        leadStats = await Lead.getStats(req.organizationId);
      } catch (error) {
        console.log('Lead stats not available:', error.message);
        leadStats = {
          total_leads: 0,
          new_leads: 0,
          contacted_leads: 0,
          qualified_leads: 0,
          converted_leads: 0,
          lost_leads: 0,
          high_priority: 0,
          assigned_leads: 0,
          new_this_week: 0,
          new_this_month: 0,
          total_value: 0,
          average_value: 0
        };
      }

      try {
        contactStats = await Contact.getStats(req.organizationId);
      } catch (error) {
        console.log('Contact stats not available:', error.message);
        contactStats = {
          total_contacts: 0,
          active_contacts: 0,
          customers: 0,
          prospects: 0,
          converted_from_leads: 0,
          new_this_week: 0,
          new_this_month: 0,
          total_value: 0,
          average_value: 0
        };
      }

      // Calculate conversion rates and combined metrics
      const totalProspects = parseInt(leadStats.total_leads) + parseInt(contactStats.prospects);
      const totalCustomers = parseInt(contactStats.customers);
      const overallConversionRate = totalProspects > 0 ? 
        ((parseInt(contactStats.converted_from_leads) / parseInt(leadStats.total_leads)) * 100).toFixed(2) : 0;

      res.json({
        basic_stats: stats,
        detailed_stats: detailedStats.rows[0],
        session_stats: sessionStats.rows[0],
        lead_stats: {
          ...leadStats,
          total_value: parseFloat(leadStats.total_value) || 0,
          average_value: parseFloat(leadStats.average_value) || 0,
          conversion_rate: leadStats.total_leads > 0 ? 
            ((parseInt(leadStats.converted_leads) / parseInt(leadStats.total_leads)) * 100).toFixed(2) : 0
        },
        contact_stats: {
          ...contactStats,
          total_value: parseFloat(contactStats.total_value) || 0,
          average_value: parseFloat(contactStats.average_value) || 0,
          conversion_rate: contactStats.total_contacts > 0 ? 
            ((parseInt(contactStats.converted_from_leads) / parseInt(contactStats.total_contacts)) * 100).toFixed(2) : 0
        },
        combined_metrics: {
          total_prospects: totalProspects,
          total_customers: totalCustomers,
          overall_conversion_rate: overallConversionRate,
          total_pipeline_value: (parseFloat(leadStats.total_value) || 0) + (parseFloat(contactStats.total_value) || 0),
          new_prospects_this_week: (parseInt(leadStats.new_this_week) || 0) + (parseInt(contactStats.new_this_week) || 0),
          new_prospects_this_month: (parseInt(leadStats.new_this_month) || 0) + (parseInt(contactStats.new_this_month) || 0)
        },
        limits: {
          max_users: parseInt(stats.max_users),
          current_users: parseInt(stats.active_users),
          remaining_slots: parseInt(stats.max_users) - parseInt(stats.active_users)
        }
      });
    } catch (error) {
      console.error('Get organization stats error:', error);
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: 'Unable to get organization statistics'
      });
    }
  }
);

/**
 * GET /organizations/current/dashboard
 * Get comprehensive dashboard metrics including contacts, leads, and licenses
 */
router.get('/current/dashboard',
  async (req, res) => {
    try {
      // Get basic organization info
      const organization = await Organization.findById(req.organizationId);
      
      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Current organization does not exist'
        });
      }

      // Get lead and contact statistics
      let leadStats = {};
      let contactStats = {};
      
      try {
        leadStats = await Lead.getStats(req.organizationId);
      } catch (error) {
        console.log('Lead stats not available:', error.message);
        leadStats = { total_leads: 0, new_this_week: 0, new_this_month: 0, total_value: 0 };
      }

      try {
        contactStats = await Contact.getStats(req.organizationId);
      } catch (error) {
        console.log('Contact stats not available:', error.message);
        contactStats = { total_contacts: 0, customers: 0, new_this_week: 0, new_this_month: 0, total_value: 0 };
      }

      // Get licensing metrics if tables exist
      const { query } = require('../database/connection');
      let licensingMetrics = {
        active_licenses: 0,
        active_trials: 0,
        registered_devices: 0,
        recent_downloads: 0,
        recent_activations: 0,
        expiring_soon: 0
      };

      try {
        // Check if licensing tables exist before querying
        const tablesExist = await query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
            AND table_name IN ('licenses', 'trials', 'devices', 'downloads', 'activations')
        `, []);

        const existingTables = tablesExist.rows.map(row => row.table_name);

        if (existingTables.includes('licenses')) {
          const licenseStats = await query(`
            SELECT 
              COUNT(CASE WHEN status = 'active' AND expires_at > NOW() THEN 1 END) as active_licenses,
              COUNT(CASE WHEN status = 'active' AND expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days' THEN 1 END) as expiring_soon
            FROM licenses 
            WHERE organization_id = $1
          `, [req.organizationId], req.organizationId);
          
          if (licenseStats.rows.length > 0) {
            licensingMetrics.active_licenses = parseInt(licenseStats.rows[0].active_licenses) || 0;
            licensingMetrics.expiring_soon = parseInt(licenseStats.rows[0].expiring_soon) || 0;
          }
        }

        if (existingTables.includes('trials')) {
          const trialStats = await query(`
            SELECT COUNT(*) as active_trials
            FROM trials 
            WHERE organization_id = $1 AND status = 'active' AND expires_at > NOW()
          `, [req.organizationId], req.organizationId);
          
          if (trialStats.rows.length > 0) {
            licensingMetrics.active_trials = parseInt(trialStats.rows[0].active_trials) || 0;
          }
        }

        if (existingTables.includes('devices')) {
          const deviceStats = await query(`
            SELECT COUNT(*) as registered_devices
            FROM devices 
            WHERE organization_id = $1
          `, [req.organizationId], req.organizationId);
          
          if (deviceStats.rows.length > 0) {
            licensingMetrics.registered_devices = parseInt(deviceStats.rows[0].registered_devices) || 0;
          }
        }

        if (existingTables.includes('downloads')) {
          const downloadStats = await query(`
            SELECT COUNT(*) as recent_downloads
            FROM downloads 
            WHERE organization_id = $1 AND downloaded_at >= NOW() - INTERVAL '30 days'
          `, [req.organizationId], req.organizationId);
          
          if (downloadStats.rows.length > 0) {
            licensingMetrics.recent_downloads = parseInt(downloadStats.rows[0].recent_downloads) || 0;
          }
        }

        if (existingTables.includes('activations')) {
          const activationStats = await query(`
            SELECT COUNT(*) as recent_activations
            FROM activations 
            WHERE organization_id = $1 AND activated_at >= NOW() - INTERVAL '30 days'
          `, [req.organizationId], req.organizationId);
          
          if (activationStats.rows.length > 0) {
            licensingMetrics.recent_activations = parseInt(activationStats.rows[0].recent_activations) || 0;
          }
        }

      } catch (error) {
        console.log('Licensing metrics not available:', error.message);
      }

      // Calculate key performance indicators
      const totalPipeline = (parseFloat(leadStats.total_value) || 0) + (parseFloat(contactStats.total_value) || 0);
      const totalGrowth = (parseInt(leadStats.new_this_month) || 0) + (parseInt(contactStats.new_this_month) || 0);
      const conversionRate = (parseInt(leadStats.total_leads) || 0) > 0 ? 
        (((parseInt(contactStats.converted_from_leads) || 0) / (parseInt(leadStats.total_leads) || 0)) * 100).toFixed(2) : 0;

      res.json({
        organization: {
          name: organization.name,
          subscription_plan: organization.subscription_plan,
          created_at: organization.created_at
        },
        summary: {
          total_leads: parseInt(leadStats.total_leads) || 0,
          total_contacts: parseInt(contactStats.total_contacts) || 0,
          total_customers: parseInt(contactStats.customers) || 0,
          total_pipeline_value: totalPipeline,
          conversion_rate: parseFloat(conversionRate),
          growth_this_month: totalGrowth
        },
        leads: {
          total: parseInt(leadStats.total_leads) || 0,
          new_this_week: parseInt(leadStats.new_this_week) || 0,
          new_this_month: parseInt(leadStats.new_this_month) || 0,
          value: parseFloat(leadStats.total_value) || 0
        },
        contacts: {
          total: parseInt(contactStats.total_contacts) || 0,
          customers: parseInt(contactStats.customers) || 0,
          prospects: parseInt(contactStats.prospects) || 0,
          new_this_week: parseInt(contactStats.new_this_week) || 0,
          new_this_month: parseInt(contactStats.new_this_month) || 0,
          value: parseFloat(contactStats.total_value) || 0
        },
        licensing: licensingMetrics,
        alerts: {
          licenses_expiring_soon: licensingMetrics.expiring_soon,
          high_priority_leads: parseInt(leadStats.high_priority) || 0,
          unassigned_leads: (parseInt(leadStats.total_leads) || 0) - (parseInt(leadStats.assigned_leads) || 0)
        }
      });
    } catch (error) {
      console.error('Get dashboard metrics error:', error);
      res.status(500).json({
        error: 'Failed to retrieve dashboard data',
        message: 'Unable to get dashboard metrics',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * GET /organizations/current/usage
 * Get organization usage metrics (admin only)
 */
router.get('/current/usage',
  requireAdmin,
  async (req, res) => {
    try {
      const { query } = require('../database/connection');
      
      // Get usage metrics for the last 30 days
      const usageStats = await query(`
        WITH daily_stats AS (
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as new_users
          FROM users 
          WHERE organization_id = $1 
            AND created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(created_at)
          ORDER BY date
        ),
        login_stats AS (
          SELECT 
            DATE(last_login) as date,
            COUNT(DISTINCT id) as active_users
          FROM users 
          WHERE organization_id = $1 
            AND last_login >= NOW() - INTERVAL '30 days'
            AND last_login IS NOT NULL
          GROUP BY DATE(last_login)
          ORDER BY date
        )
        SELECT 
          COALESCE(d.date, l.date) as date,
          COALESCE(d.new_users, 0) as new_users,
          COALESCE(l.active_users, 0) as active_users
        FROM daily_stats d
        FULL OUTER JOIN login_stats l ON d.date = l.date
        ORDER BY date;
      `, [req.organizationId], req.organizationId);

      // Get current month summary
      const monthlyStats = await query(`
        SELECT 
          COUNT(*) as total_users_created_this_month,
          COUNT(DISTINCT DATE(created_at)) as days_with_new_users,
          AVG(daily_count) as avg_new_users_per_day
        FROM (
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as daily_count
          FROM users 
          WHERE organization_id = $1 
            AND created_at >= DATE_TRUNC('month', NOW())
          GROUP BY DATE(created_at)
        ) daily_summary;
      `, [req.organizationId], req.organizationId);

      const organization = await Organization.findById(req.organizationId);
      const userCount = await Organization.getUserCount(req.organizationId);

      res.json({
        daily_usage: usageStats.rows,
        monthly_summary: monthlyStats.rows[0],
        current_usage: {
          total_active_users: userCount,
          max_users: organization.max_users,
          usage_percentage: Math.round((userCount / organization.max_users) * 100),
          remaining_slots: organization.max_users - userCount
        },
        subscription: {
          plan: organization.subscription_plan,
          max_users: organization.max_users
        }
      });
    } catch (error) {
      console.error('Get organization usage error:', error);
      res.status(500).json({
        error: 'Failed to retrieve usage data',
        message: 'Unable to get organization usage metrics'
      });
    }
  }
);

/**
 * PUT /organizations/current/settings
 * Update organization settings (admin only)
 */
router.put('/current/settings',
  requireAdmin,
  async (req, res) => {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({
          error: 'Invalid settings',
          message: 'Settings must be a valid object'
        });
      }

      const organization = await Organization.update(req.organizationId, { settings });
      
      if (!organization) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Organization does not exist'
        });
      }

      res.json({
        message: 'Organization settings updated successfully',
        settings: organization.settings
      });
    } catch (error) {
      console.error('Update organization settings error:', error);
      res.status(500).json({
        error: 'Settings update failed',
        message: 'Unable to update organization settings'
      });
    }
  }
);

/**
 * PUT /organizations/current/licenses
 * Manage organization licenses (add/remove seats) - Admin only
 */
router.put('/current/licenses',
  requireAdmin,
  async (req, res) => {
    try {
      const { action, quantity } = req.body;
      const { query: dbQuery } = require('../database/connection');

      // Validate input
      if (!action || !['add', 'remove'].includes(action)) {
        return res.status(400).json({
          error: 'Invalid action',
          message: 'Action must be "add" or "remove"'
        });
      }

      if (!quantity || quantity < 1 || !Number.isInteger(quantity)) {
        return res.status(400).json({
          error: 'Invalid quantity',
          message: 'Quantity must be a positive integer'
        });
      }

      console.log(`🎫 License ${action}: ${quantity} seats for organization ${req.organizationId}`);

      // Get current organization state
      const orgResult = await dbQuery(`
        SELECT id, name, max_users, is_trial, trial_status
        FROM organizations
        WHERE id = $1
      `, [req.organizationId]);

      if (orgResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Organization not found'
        });
      }

      const org = orgResult.rows[0];

      // Get current active user count
      const userCountResult = await dbQuery(`
        SELECT COUNT(*) as active_users
        FROM users
        WHERE organization_id = $1 AND is_active = true
      `, [req.organizationId]);

      const currentUsers = parseInt(userCountResult.rows[0].active_users);
      const currentMaxUsers = org.max_users;
      let newMaxUsers;

      if (action === 'add') {
        newMaxUsers = currentMaxUsers + quantity;
      } else {
        // Remove licenses
        newMaxUsers = currentMaxUsers - quantity;

        // Validate: can't remove licenses if users are occupying them
        if (newMaxUsers < currentUsers) {
          return res.status(400).json({
            error: 'Cannot remove licenses',
            message: `You have ${currentUsers} active users. Cannot reduce licenses below current usage.`,
            details: {
              current_users: currentUsers,
              current_max: currentMaxUsers,
              requested_new_max: newMaxUsers
            }
          });
        }

        // Minimum 1 license
        if (newMaxUsers < 1) {
          return res.status(400).json({
            error: 'Invalid license count',
            message: 'Organization must have at least 1 license'
          });
        }
      }

      // Calculate pricing
      const pricePerUser = 15;
      const oldMonthlyPrice = currentMaxUsers * pricePerUser;
      const newMonthlyPrice = newMaxUsers * pricePerUser;
      const priceDifference = newMonthlyPrice - oldMonthlyPrice;

      // Update organization max_users
      await dbQuery(`
        UPDATE organizations
        SET max_users = $1, updated_at = NOW()
        WHERE id = $2
      `, [newMaxUsers, req.organizationId]);

      console.log(`✅ Updated max_users: ${currentMaxUsers} → ${newMaxUsers}`);

      // Update subscription record if exists
      await dbQuery(`
        UPDATE organization_subscriptions
        SET updated_at = NOW()
        WHERE organization_id = $1
      `, [req.organizationId]).catch(() => {
        console.log('No subscription record to update');
      });

      // Get admin user for email notification
      const adminResult = await dbQuery(`
        SELECT email, first_name, last_name
        FROM users
        WHERE organization_id = $1 AND role = 'admin' AND is_active = true
        LIMIT 1
      `, [req.organizationId]);

      // Send email notification
      if (adminResult.rows.length > 0) {
        const admin = adminResult.rows[0];
        const emailService = require('../services/emailService');

        try {
          await emailService.sendEmail({
            to: admin.email,
            subject: `License ${action === 'add' ? 'Added' : 'Removed'} - Subscription Updated`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4F46E5;">Subscription Updated</h2>
                <p>Hi ${admin.first_name},</p>
                <p>Your subscription for <strong>${org.name}</strong> has been updated.</p>

                <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #059669;">License Change</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">Previous Licenses:</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold;">${currentMaxUsers} users</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB;">${action === 'add' ? 'Added' : 'Removed'}:</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #E5E7EB; text-align: right; font-weight: bold;">${action === 'add' ? '+' : '-'}${quantity} users</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-weight: bold;">New Licenses:</td>
                      <td style="padding: 12px 0; text-align: right; font-weight: bold; color: #059669;">${newMaxUsers} users</td>
                    </tr>
                  </table>
                </div>

                <div style="background-color: #EFF6FF; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #3B82F6;">Pricing Update</h3>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #DBEAFE;">Previous Monthly Cost:</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #DBEAFE; text-align: right;">$${oldMonthlyPrice}/month</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; border-bottom: 1px solid #DBEAFE;">New Monthly Cost:</td>
                      <td style="padding: 8px 0; border-bottom: 1px solid #DBEAFE; text-align: right; font-weight: bold;">$${newMonthlyPrice}/month</td>
                    </tr>
                    <tr>
                      <td style="padding: 12px 0; font-weight: bold;">Difference:</td>
                      <td style="padding: 12px 0; text-align: right; font-weight: bold; color: ${priceDifference > 0 ? '#DC2626' : '#059669'};">
                        ${priceDifference > 0 ? '+' : ''}$${priceDifference}/month
                      </td>
                    </tr>
                  </table>
                  <p style="font-size: 14px; color: #6B7280; margin-top: 12px;">
                    Price calculation: ${newMaxUsers} users × $${pricePerUser}/user = $${newMonthlyPrice}/month
                  </p>
                </div>

                <p style="margin-top: 30px;">
                  <a href="${process.env.FRONTEND_URL || 'https://uppalcrm.com'}/subscription"
                     style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Subscription Details
                  </a>
                </p>

                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">

                <p style="color: #6B7280; font-size: 14px;">
                  Questions? Contact our support team at support@uppalcrm.com
                </p>
              </div>
            `
          });
          console.log(`✅ License change notification sent to ${admin.email}`);
        } catch (emailError) {
          console.error('⚠️  Failed to send license change notification:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.json({
        message: `Successfully ${action === 'add' ? 'added' : 'removed'} ${quantity} license(s)`,
        licenses: {
          previous_max_users: currentMaxUsers,
          new_max_users: newMaxUsers,
          current_active_users: currentUsers,
          available_seats: newMaxUsers - currentUsers
        },
        pricing: {
          price_per_user: pricePerUser,
          previous_monthly_cost: oldMonthlyPrice,
          new_monthly_cost: newMonthlyPrice,
          monthly_difference: priceDifference
        }
      });

    } catch (error) {
      console.error('❌ Error managing licenses:', error);
      console.error('Error details:', error.stack);
      res.status(500).json({
        error: 'License management failed',
        message: 'Unable to update licenses',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * DELETE /organizations/current
 * Deactivate organization (admin only) - Use with extreme caution
 */
router.delete('/current',
  requireAdmin,
  async (req, res) => {
    try {
      const { confirm } = req.body;

      if (confirm !== 'DELETE_ORGANIZATION') {
        return res.status(400).json({
          error: 'Confirmation required',
          message: 'Must provide confirmation string "DELETE_ORGANIZATION"'
        });
      }

      const success = await Organization.deactivate(req.organizationId);

      if (!success) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Organization does not exist'
        });
      }

      res.json({
        message: 'Organization deactivated successfully'
      });
    } catch (error) {
      console.error('Deactivate organization error:', error);
      res.status(500).json({
        error: 'Organization deactivation failed',
        message: 'Unable to deactivate organization'
      });
    }
  }
);

module.exports = router;