const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const { 
  authenticateToken, 
  requireRole,
  validateOrganizationContext 
} = require('../middleware/auth');
const { 
  validateUuidParam,
  validate,
  schemas 
} = require('../middleware/validation');
const { sendEmail } = require('../services/email');
const AuditLog = require('../models/AuditLog');
const Joi = require('joi');

const router = express.Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateToken);
router.use(validateOrganizationContext);

// Validation schemas
const userManagementSchemas = {
  createUser: {
    body: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().required(),
      role: Joi.string().valid('admin', 'user').default('user')
    })
  },
  
  updateUser: {
    body: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      email: Joi.string().email().optional(),
      role: Joi.string().valid('admin', 'user').optional(),
      status: Joi.string().valid('active', 'inactive').optional()
    })
  },
  
  bulkOperation: {
    body: Joi.object({
      userIds: Joi.array().items(Joi.string().uuid()).min(1).required(),
      operation: Joi.string().valid('activate', 'deactivate', 'delete', 'reset_password').required(),
      role: Joi.string().valid('admin', 'user').optional()
    })
  }
};

/**
 * GET /user-management
 * Get all users in the organization with pagination and filtering
 */
router.get('/', 
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        search = '',
        role = '',
        status = '',
        sort = 'created_at',
        order = 'desc'
      } = req.query;

      console.log('Getting users for organization:', req.organizationId);

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Build search conditions
      let searchCondition = 'WHERE organization_id = $1';
      const queryParams = [req.organizationId];
      let paramIndex = 2;

      if (search) {
        searchCondition += ` AND (CONCAT(first_name, ' ', last_name) ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (role) {
        searchCondition += ` AND role = $${paramIndex}`;
        queryParams.push(role);
        paramIndex++;
      }

      if (status) {
        searchCondition += ` AND status = $${paramIndex}`;
        queryParams.push(status);
        paramIndex++;
      }

      // Valid sort columns
      const validSorts = ['name', 'email', 'role', 'status', 'created_at', 'last_login'];
      const sortColumn = validSorts.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const query = `
        SELECT DISTINCT
          users.id,
          CONCAT(first_name, ' ', last_name) as name,
          users.email,
          COALESCE(users.role, 'user') as role,
          COALESCE(users.status, 'active') as status,
          users.last_login,
          users.created_at,
          users.updated_at,
          COALESCE(users.is_first_login, false) as is_first_login,
          COALESCE(users.failed_login_attempts, 0) as failed_login_attempts
        FROM users 
        ${searchCondition}
        ORDER BY ${sortColumn === 'name' ? 'CONCAT(first_name, \' \', last_name)' : `users.${sortColumn}`} ${sortOrder}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM users 
        ${searchCondition}
      `;

      const { query: dbQuery } = require('../database/connection');
      
      const [usersResult, countResult] = await Promise.all([
        dbQuery(query, [...queryParams, parseInt(limit), offset], req.organizationId),
        dbQuery(countQuery, queryParams, req.organizationId)
      ]);

      const users = usersResult.rows.map(user => ({
        ...user,
        // Don't expose password-related fields
        password: undefined,
        reset_token: undefined,
        reset_token_expires: undefined
      }));

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / parseInt(limit));

      res.json({
        users,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_users: total,
          per_page: parseInt(limit),
          has_next: parseInt(page) < totalPages,
          has_prev: parseInt(page) > 1
        }
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        error: 'Failed to retrieve users',
        message: 'Unable to get users list',
        details: {
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * POST /user-management
 * Create new user with auto-generated password
 */
router.post('/',
  requireRole('admin'),
  validate(userManagementSchemas.createUser),
  async (req, res) => {
    try {
      const { name, email, role } = req.body;

      console.log('Creating new user:', { name, email, role });

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'User already exists',
          message: 'A user with this email address already exists'
        });
      }

      // Generate secure password
      const tempPassword = crypto.randomBytes(8).toString('hex') + 
                          crypto.randomBytes(2).toString('hex').toUpperCase() + 
                          '!@#'[Math.floor(Math.random() * 3)];

      // Create user - User model will handle name splitting internally
      const userData = {
        name,
        email,
        password: tempPassword,
        role,
        organization_id: req.organizationId,
        created_by: req.user.id,
        is_first_login: true,
        status: 'active'
      };

      const newUser = await User.create(userData);

      // Log the action
      await AuditLog.create({
        user_id: req.user.id,
        organization_id: req.organizationId,
        action: 'USER_CREATED',
        resource_type: 'user',
        resource_id: newUser.id,
        details: {
          target_user: { name, email, role },
          created_by: req.user.name
        }
      });

      // Send welcome email with credentials
      try {
        await sendEmail({
          to: email,
          subject: 'Welcome to Uppal CRM - Your Account Details',
          template: 'user-welcome',
          data: {
            name,
            email,
            password: tempPassword,
            loginUrl: process.env.FRONTEND_URL || 'https://your-crm-domain.com',
            organizationName: 'Uppal Solutions',
            createdBy: req.user.name
          }
        });

        console.log(`Welcome email sent to ${email}`);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
        // Don't fail the user creation if email fails
      }

      // Return user data without password
      const userResponse = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        created_at: newUser.created_at,
        is_first_login: true
      };

      res.status(201).json({
        message: 'User created successfully',
        user: userResponse,
        email_sent: true
      });

    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({
        error: 'Failed to create user',
        message: 'Unable to create new user',
        details: {
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * PUT /user-management/:id
 * Update user details
 */
router.put('/:id',
  requireRole('admin'),
  validateUuidParam,
  validate(userManagementSchemas.updateUser),
  async (req, res) => {
    try {
      const userId = req.params.id;
      const updates = req.body;

      console.log('Updating user:', userId, updates);

      // Get current user data
      const currentUser = await User.findById(userId, req.organizationId);
      if (!currentUser) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in this organization'
        });
      }

      // Prevent admin from changing their own role
      if (userId === req.user.id && updates.role && updates.role !== currentUser.role) {
        return res.status(403).json({
          error: 'Cannot change own role',
          message: 'You cannot change your own role'
        });
      }

      // Check if email is being changed and if it's already taken
      if (updates.email && updates.email !== currentUser.email) {
        const existingUser = await User.findByEmail(updates.email);
        if (existingUser && existingUser.id !== userId) {
          return res.status(409).json({
            error: 'Email already exists',
            message: 'Another user with this email already exists'
          });
        }
      }

      // Update user
      const updatedUser = await User.update(userId, updates, req.organizationId);

      // Log the action
      await AuditLog.create({
        user_id: req.user.id,
        organization_id: req.organizationId,
        action: 'USER_UPDATED',
        resource_type: 'user',
        resource_id: userId,
        details: {
          changes: updates,
          target_user: currentUser.name,
          updated_by: req.user.name
        }
      });

      // Return updated user without sensitive fields
      const userResponse = {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
        updated_at: updatedUser.updated_at
      };

      res.json({
        message: 'User updated successfully',
        user: userResponse
      });

    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({
        error: 'Failed to update user',
        message: 'Unable to update user',
        details: {
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * POST /user-management/:id/reset-password
 * Reset user password
 */
router.post('/:id/reset-password',
  requireRole('admin'),
  validateUuidParam,
  async (req, res) => {
    try {
      const userId = req.params.id;

      console.log('Resetting password for user:', userId);

      // Get user data
      const user = await User.findById(userId, req.organizationId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in this organization'
        });
      }

      // Generate new password
      const newPassword = crypto.randomBytes(8).toString('hex') + 
                         crypto.randomBytes(2).toString('hex').toUpperCase() + 
                         '!@#'[Math.floor(Math.random() * 3)];

      // Update user with new password and force password change
      await User.update(userId, {
        password: await bcrypt.hash(newPassword, 12),
        is_first_login: true,
        failed_login_attempts: 0
      }, req.organizationId);

      // Log the action
      await AuditLog.create({
        user_id: req.user.id,
        organization_id: req.organizationId,
        action: 'PASSWORD_RESET',
        resource_type: 'user',
        resource_id: userId,
        details: {
          target_user: user.name,
          reset_by: req.user.name
        }
      });

      // Send password reset email
      try {
        await sendEmail({
          to: user.email,
          subject: 'Password Reset - Uppal CRM',
          template: 'password-reset',
          data: {
            name: user.name,
            password: newPassword,
            loginUrl: process.env.FRONTEND_URL || 'https://your-crm-domain.com',
            resetBy: req.user.name
          }
        });

        console.log(`Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't fail the password reset if email fails
      }

      res.json({
        message: 'Password reset successfully',
        email_sent: true
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        error: 'Failed to reset password',
        message: 'Unable to reset user password',
        details: {
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * DELETE /user-management/:id
 * Delete user (soft delete by setting status to inactive)
 */
router.delete('/:id',
  requireRole('admin'),
  validateUuidParam,
  async (req, res) => {
    try {
      const userId = req.params.id;

      console.log('Deleting user:', userId);

      // Prevent admin from deleting themselves
      if (userId === req.user.id) {
        return res.status(403).json({
          error: 'Cannot delete own account',
          message: 'You cannot delete your own account'
        });
      }

      // Get user data
      const user = await User.findById(userId, req.organizationId);
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User does not exist in this organization'
        });
      }

      // Soft delete - set status to inactive
      await User.update(userId, {
        status: 'inactive',
        deleted_at: new Date()
      }, req.organizationId);

      // Log the action
      await AuditLog.create({
        user_id: req.user.id,
        organization_id: req.organizationId,
        action: 'USER_DELETED',
        resource_type: 'user',
        resource_id: userId,
        details: {
          target_user: user.name,
          deleted_by: req.user.name
        }
      });

      res.json({
        message: 'User removed successfully'
      });

    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({
        error: 'Failed to delete user',
        message: 'Unable to remove user',
        details: {
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * POST /user-management/bulk
 * Perform bulk operations on multiple users
 */
router.post('/bulk',
  requireRole('admin'),
  validate(userManagementSchemas.bulkOperation),
  async (req, res) => {
    try {
      const { userIds, operation, role } = req.body;

      console.log('Bulk operation:', { operation, userIds: userIds.length, role });

      // Validate that current user is not in the list for destructive operations
      if (['delete', 'deactivate'].includes(operation) && userIds.includes(req.user.id)) {
        return res.status(403).json({
          error: 'Cannot perform operation on own account',
          message: 'You cannot delete or deactivate your own account'
        });
      }

      const results = {
        successful: [],
        failed: []
      };

      for (const userId of userIds) {
        try {
          // Get user data
          const user = await User.findById(userId, req.organizationId);
          if (!user) {
            results.failed.push({ id: userId, error: 'User not found' });
            continue;
          }

          let updateData = {};
          let actionType = '';

          switch (operation) {
            case 'activate':
              updateData = { status: 'active' };
              actionType = 'USER_ACTIVATED';
              break;
            case 'deactivate':
              updateData = { status: 'inactive' };
              actionType = 'USER_DEACTIVATED';
              break;
            case 'delete':
              updateData = { status: 'inactive', deleted_at: new Date() };
              actionType = 'USER_DELETED';
              break;
            case 'reset_password':
              const newPassword = crypto.randomBytes(8).toString('hex') + 
                                 crypto.randomBytes(2).toString('hex').toUpperCase() + 
                                 '!@#'[Math.floor(Math.random() * 3)];
              updateData = {
                password: await bcrypt.hash(newPassword, 12),
                is_first_login: true,
                failed_login_attempts: 0
              };
              actionType = 'PASSWORD_RESET';
              
              // Send password reset email
              try {
                await sendEmail({
                  to: user.email,
                  subject: 'Password Reset - Uppal CRM',
                  template: 'password-reset',
                  data: {
                    name: user.name,
                    password: newPassword,
                    loginUrl: process.env.FRONTEND_URL || 'https://your-crm-domain.com',
                    resetBy: req.user.name
                  }
                });
              } catch (emailError) {
                console.error(`Failed to send email to ${user.email}:`, emailError);
              }
              break;
          }

          if (role && ['activate', 'deactivate'].includes(operation)) {
            updateData.role = role;
          }

          // Update user
          await User.update(userId, updateData, req.organizationId);

          // Log the action
          await AuditLog.create({
            user_id: req.user.id,
            organization_id: req.organizationId,
            action: actionType,
            resource_type: 'user',
            resource_id: userId,
            details: {
              target_user: user.name,
              bulk_operation: true,
              performed_by: req.user.name
            }
          });

          results.successful.push({
            id: userId,
            name: user.name,
            email: user.email
          });

        } catch (userError) {
          console.error(`Failed to process user ${userId}:`, userError);
          results.failed.push({
            id: userId,
            error: userError.message
          });
        }
      }

      res.json({
        message: `Bulk operation completed`,
        operation,
        results: {
          total: userIds.length,
          successful: results.successful.length,
          failed: results.failed.length,
          details: results
        }
      });

    } catch (error) {
      console.error('Bulk operation error:', error);
      res.status(500).json({
        error: 'Failed to perform bulk operation',
        message: 'Unable to complete bulk operation',
        details: {
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

/**
 * GET /user-management/audit-log
 * Get audit log for user management actions
 */
router.get('/audit-log',
  requireRole('admin'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 50,
        action = '',
        user_id = '',
        days = 30
      } = req.query;

      const offset = (parseInt(page) - 1) * parseInt(limit);
      
      // Build filter conditions
      let filterCondition = 'WHERE organization_id = $1 AND action IN ($2, $3, $4, $5, $6)';
      const queryParams = [
        req.organizationId,
        'USER_CREATED',
        'USER_UPDATED',
        'USER_DELETED',
        'PASSWORD_RESET',
        'USER_ACTIVATED',
        'USER_DEACTIVATED'
      ];
      let paramIndex = 7;

      if (days) {
        filterCondition += ` AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'`;
      }

      if (action) {
        filterCondition += ` AND action = $${paramIndex}`;
        queryParams.push(action);
        paramIndex++;
      }

      if (user_id) {
        filterCondition += ` AND user_id = $${paramIndex}`;
        queryParams.push(user_id);
        paramIndex++;
      }

      const query = `
        SELECT 
          al.*,
          u.name as performed_by_name,
          u.email as performed_by_email
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${filterCondition}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs
        ${filterCondition}
      `;

      const { query: dbQuery } = require('../database/connection');
      
      const [logsResult, countResult] = await Promise.all([
        dbQuery(query, [...queryParams, parseInt(limit), offset], req.organizationId),
        dbQuery(countQuery, queryParams, req.organizationId)
      ]);

      const logs = logsResult.rows;
      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / parseInt(limit));

      res.json({
        audit_logs: logs,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_logs: total,
          per_page: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('Get audit log error:', error);
      res.status(500).json({
        error: 'Failed to retrieve audit log',
        message: 'Unable to get audit log',
        details: {
          message: error.message,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
);

module.exports = router;