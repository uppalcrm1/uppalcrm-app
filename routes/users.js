const express = require('express');
const User = require('../models/User');
const Organization = require('../models/Organization');
// const { checkLicenseLimit } = require('../controllers/licenseController');
const { 
  validateCreateUser, 
  validateUpdateUser, 
  validateChangePassword, 
  validateUuidParam,
  validateListUsers
} = require('../middleware/validation');
const { 
  authenticateToken, 
  requireAdmin, 
  canManageUsers,
  validateOrganizationContext 
} = require('../middleware/auth');

const router = express.Router();

// Apply authentication and organization validation to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

/**
 * GET /users
 * Get all users in organization (with pagination and filtering)
 */
router.get('/',
  validateListUsers,
  async (req, res) => {
    try {
      const { 
        page = 1, 
        limit = 20, 
        role, 
        search,
        sort = 'created_at',
        order = 'desc'
      } = req.query;

      const offset = (page - 1) * limit;
      
      const users = await User.findByOrganization(req.organizationId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        role,
        search
      });

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total FROM users 
        WHERE organization_id = $1 AND is_active = true
      `;
      const countParams = [req.organizationId];
      let paramCount = 1;

      if (role) {
        countQuery += ` AND role = $${++paramCount}`;
        countParams.push(role);
      }

      if (search) {
        countQuery += ` AND (
          first_name ILIKE $${++paramCount} OR 
          last_name ILIKE $${++paramCount} OR 
          email ILIKE $${++paramCount}
        )`;
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern);
      }

      const { query } = require('../database/connection');
      const countResult = await query(countQuery, countParams, req.organizationId);
      const total = parseInt(countResult.rows[0].total);

      res.json({
        users: users.map(user => user.toJSON()),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
          has_next: page * limit < total,
          has_prev: page > 1
        }
      });
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        error: 'Failed to retrieve users',
        message: 'Unable to get users list'
      });
    }
  }
);

/**
 * GET /users/stats
 * Get user statistics for the organization
 * MUST come before /:id route to avoid matching "stats" as an ID
 */
router.get('/stats',
  requireAdmin,
  async (req, res) => {
    try {
      const { query } = require('../database/connection');

      const stats = await query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(CASE WHEN is_active THEN 1 END) as active_users,
          COUNT(CASE WHEN role = 'admin' THEN 1 END) as admin_users,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as regular_users,
          COUNT(CASE WHEN role = 'viewer' THEN 1 END) as viewer_users,
          COUNT(CASE WHEN last_login > NOW() - INTERVAL '7 days' THEN 1 END) as active_last_week,
          COUNT(CASE WHEN last_login > NOW() - INTERVAL '30 days' THEN 1 END) as active_last_month,
          COUNT(CASE WHEN email_verified THEN 1 END) as verified_users
        FROM users
        WHERE organization_id = $1
      `, [req.organizationId], req.organizationId);

      const orgStats = await Organization.getStats(req.organizationId);

      res.json({
        user_stats: stats.rows[0],
        organization_stats: orgStats
      });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        message: 'Unable to get user statistics'
      });
    }
  }
);

/**
 * GET /users/:id
 * Get specific user by ID
 */
router.get('/:id',
  validateUuidParam,
  canManageUsers,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id, req.organizationId);

      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in this organization'
        });
      }

      res.json({
        user: user.toJSON()
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        error: 'Failed to retrieve user',
        message: 'Unable to get user information'
      });
    }
  }
);

/**
 * POST /users
 * Create new user in organization (admin only)
 */
router.post('/',
  requireAdmin,
  validateCreateUser,
  // checkLicenseLimit,
  async (req, res) => {
    const { query: dbQuery } = require('../database/connection');

    try {
      // Start transaction
      await dbQuery('BEGIN');

      // Get current org state
      const orgResult = await dbQuery(`
        SELECT id, max_users,
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) as current_user_count
        FROM organizations
        WHERE id = $1
      `, [req.organizationId]);

      const org = orgResult.rows[0];
      const currentUserCount = parseInt(org.current_user_count);
      const currentMaxUsers = org.max_users;

      console.log(`📊 User creation check: ${currentUserCount} active users, max_users: ${currentMaxUsers}`);

      // Check if we need to auto-increment max_users
      let newMaxUsers = currentMaxUsers;
      if (currentUserCount >= currentMaxUsers) {
        // Auto-increment max_users to accommodate new user
        newMaxUsers = currentUserCount + 1;

        console.log(`🔄 Auto-incrementing max_users: ${currentMaxUsers} → ${newMaxUsers}`);

        await dbQuery(`
          UPDATE organizations
          SET max_users = $1, updated_at = NOW()
          WHERE id = $2
        `, [newMaxUsers, req.organizationId]);

        // Update subscription price if exists
        const pricePerUser = 15;
        const newMonthlyPrice = newMaxUsers * pricePerUser;

        await dbQuery(`
          UPDATE organization_subscriptions
          SET updated_at = NOW()
          WHERE organization_id = $1
        `, [req.organizationId]).catch(() => {
          console.log('No subscription record to update');
        });

        console.log(`💰 Updated pricing: ${currentMaxUsers} users × $${pricePerUser} = $${currentMaxUsers * pricePerUser} → ${newMaxUsers} users × $${pricePerUser} = $${newMonthlyPrice}`);
      }

      // Create the user
      const user = await User.create(req.body, req.organizationId, req.user.id);

      // Verify final state
      const verifyResult = await dbQuery(`
        SELECT
          max_users,
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) as actual_user_count
        FROM organizations
        WHERE id = $1
      `, [req.organizationId]);

      const finalState = verifyResult.rows[0];
      const actualUsers = parseInt(finalState.actual_user_count);
      const finalMaxUsers = finalState.max_users;

      if (actualUsers > finalMaxUsers) {
        throw new Error(`Data sync error: ${actualUsers} users but max_users is ${finalMaxUsers}`);
      }

      console.log(`✅ Verification passed: ${actualUsers} users <= ${finalMaxUsers} max_users`);

      await dbQuery('COMMIT');

      res.status(201).json({
        message: 'User created successfully',
        user: user.toJSON(),
        license_info: {
          max_users: finalMaxUsers,
          current_users: actualUsers,
          remaining_seats: finalMaxUsers - actualUsers,
          auto_incremented: newMaxUsers > currentMaxUsers
        }
      });
    } catch (error) {
      await dbQuery('ROLLBACK');
      console.error('❌ Create user error:', error);

      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'User creation failed',
          message: error.message
        });
      }

      if (error.message.includes('License limit exceeded')) {
        return res.status(403).json({
          error: 'License limit exceeded',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'User creation failed',
        message: error.message || 'Unable to create user'
      });
    }
  }
);

/**
 * PUT /users/:id
 * Update user information
 */
router.put('/:id',
  validateUuidParam,
  validateUpdateUser,
  canManageUsers,
  async (req, res) => {
    try {
      // Only admins can change roles
      if (req.body.role && req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access forbidden',
          message: 'Only administrators can change user roles'
        });
      }

      const user = await User.update(req.params.id, req.body, req.organizationId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in this organization'
        });
      }

      res.json({
        message: 'User updated successfully',
        user: user.toJSON()
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        error: 'User update failed',
        message: 'Unable to update user'
      });
    }
  }
);

/**
 * PUT /users/:id/password
 * Change user password
 */
router.put('/:id/password',
  validateUuidParam,
  validateChangePassword,
  canManageUsers,
  async (req, res) => {
    try {
      const { current_password, new_password } = req.body;
      const targetUserId = req.params.id;

      // If user is changing their own password, verify current password
      if (targetUserId === req.user.id) {
        const user = await User.findById(targetUserId, req.organizationId);
        const bcrypt = require('bcryptjs');
        
        if (!user || !(await bcrypt.compare(current_password, user.password_hash))) {
          return res.status(400).json({
            error: 'Invalid password',
            message: 'Current password is incorrect'
          });
        }
      }

      const success = await User.changePassword(targetUserId, new_password, req.organizationId);
      
      if (!success) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in this organization'
        });
      }

      // Revoke all sessions for the user whose password was changed
      await User.revokeAllTokens(targetUserId, req.organizationId);

      res.json({
        message: 'Password changed successfully'
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        error: 'Password change failed',
        message: 'Unable to change password'
      });
    }
  }
);

/**
 * DELETE /users/:id
 * Deactivate user (soft delete)
 */
router.delete('/:id',
  validateUuidParam,
  requireAdmin,
  async (req, res) => {
    const { query: dbQuery } = require('../database/connection');

    try {
      const targetUserId = req.params.id;

      // Prevent admin from deactivating themselves
      if (targetUserId === req.user.id) {
        return res.status(400).json({
          error: 'Action not allowed',
          message: 'Cannot deactivate your own account'
        });
      }

      const success = await User.deactivate(targetUserId, req.organizationId);

      if (!success) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in this organization'
        });
      }

      // Verify consistency after deactivation
      const verifyResult = await dbQuery(`
        SELECT
          max_users,
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = true) as actual_user_count
        FROM organizations
        WHERE id = $1
      `, [req.organizationId]);

      const state = verifyResult.rows[0];
      const actualUsers = parseInt(state.actual_user_count);
      const maxUsers = state.max_users;

      console.log(`📊 After user deactivation: ${actualUsers} active users, max_users: ${maxUsers}`);

      if (actualUsers > maxUsers) {
        console.error(`⚠️  DATA SYNC WARNING: ${actualUsers} users but max_users is ${maxUsers}`);
      } else {
        console.log(`✅ Verification passed: ${actualUsers} users <= ${maxUsers} max_users`);
      }

      res.json({
        message: 'User deactivated successfully',
        license_info: {
          max_users: maxUsers,
          current_users: actualUsers,
          remaining_seats: maxUsers - actualUsers
        }
      });
    } catch (error) {
      console.error('Deactivate user error:', error);
      res.status(500).json({
        error: 'User deactivation failed',
        message: 'Unable to deactivate user'
      });
    }
  }
);

module.exports = router;