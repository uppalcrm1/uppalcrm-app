const express = require('express');
const Organization = require('../models/Organization');
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

      res.json({
        basic_stats: stats,
        detailed_stats: detailedStats.rows[0],
        session_stats: sessionStats.rows[0],
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