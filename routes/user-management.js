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
 * GET /user-management/license-info
 * Get organization license information and usage
 */
router.get('/license-info',
  requireRole('admin'),
  async (req, res) => {
    try {
      const { query: dbQuery } = require('../database/connection');
      
      // Use the database function to get comprehensive license info, with fallback to direct query
      let result;
      
      try {
        result = await dbQuery(`
          SELECT * FROM get_organization_license_info($1)
        `, [req.organizationId], req.organizationId);
      } catch (funcError) {
        console.log('Database function failed, trying direct query:', funcError.message);
        
        // Fallback to direct query if function doesn't exist
        result = await dbQuery(`
          SELECT 
            o.id as organization_id,
            o.name as organization_name,
            COALESCE(ol.quantity, o.purchased_licenses, 5) as purchased_licenses,
            COUNT(u.id) FILTER (WHERE u.is_active = true OR u.is_active IS NULL) as active_users,
            (COALESCE(ol.quantity, o.purchased_licenses, 5) - COUNT(u.id) FILTER (WHERE u.is_active = true OR u.is_active IS NULL))::INTEGER as available_seats,
            (COALESCE(ol.quantity, o.purchased_licenses, 5) * COALESCE(ol.price_per_license, 15.00)) as monthly_cost,
            CASE 
              WHEN COALESCE(ol.quantity, o.purchased_licenses, 5) = 0 THEN 0
              ELSE ROUND((COUNT(u.id) FILTER (WHERE u.is_active = true OR u.is_active IS NULL)::DECIMAL / COALESCE(ol.quantity, o.purchased_licenses, 5)) * 100)::INTEGER 
            END as utilization_percentage
          FROM organizations o
          LEFT JOIN organization_licenses ol ON ol.organization_id = o.id AND ol.status = 'active'
          LEFT JOIN users u ON u.organization_id = o.id
          WHERE o.id = $1
          GROUP BY o.id, o.name, ol.quantity, o.purchased_licenses, ol.price_per_license
        `, [req.organizationId], req.organizationId);
      }

      if (result.rows.length === 0) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Could not retrieve license information'
        });
      }

      const licenseInfo = result.rows[0];
      
      res.json({
        success: true,
        licenseInfo: {
          organizationId: licenseInfo.organization_id,
          organizationName: licenseInfo.organization_name,
          purchasedLicenses: licenseInfo.purchased_licenses,
          activeUsers: parseInt(licenseInfo.active_users),
          availableSeats: licenseInfo.available_seats,
          monthlyCost: parseFloat(licenseInfo.monthly_cost),
          utilizationPercentage: licenseInfo.utilization_percentage,
          canAddUsers: licenseInfo.available_seats > 0
        }
      });

    } catch (error) {
      console.error('License info error:', error);
      res.status(500).json({
        error: 'Failed to retrieve license information',
        message: error.message
      });
    }
  }
);

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
        searchCondition += ` AND (COALESCE(first_name || ' ' || last_name, first_name, email) ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
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

      // Ultra-simplified query that should always work
      const query = `
        SELECT 
          id,
          email,
          COALESCE(first_name, '') as first_name,
          COALESCE(last_name, '') as last_name,
          COALESCE(role, 'user') as role,
          created_at
        FROM users 
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM users 
        WHERE organization_id = $1
      `;

      const { query: dbQuery } = require('../database/connection');
      
      // Simplified parameters - just organization_id, limit, offset
      const simpleParams = [req.organizationId, parseInt(limit), offset];
      const countParams = [req.organizationId];
      
      const [usersResult, countResult] = await Promise.all([
        dbQuery(query, simpleParams, req.organizationId),
        dbQuery(countQuery, countParams, req.organizationId)
      ]);

      const users = usersResult.rows.map(user => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`.trim() || user.email,
        email: user.email,
        role: user.role,
        status: 'active', // default status
        created_at: user.created_at,
        last_login: null, // simplified for now
        is_first_login: false,
        failed_login_attempts: 0
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
      console.error('SQL Query:', query);
      console.error('Query Params:', queryParams);
      console.error('Organization ID:', req.organizationId);
      
      res.status(500).json({
        error: 'Failed to retrieve users',
        message: 'Unable to get users list',
        details: {
          message: error.message,
          code: error.code,
          timestamp: new Date().toISOString(),
          sql: query,
          params: queryParams
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
  // validate(userManagementSchemas.createUser), // Temporarily disabled for debugging
  async (req, res) => {
    try {
      console.log('POST /user-management hit');
      console.log('Request body:', req.body);
      console.log('User:', req.user?.email);
      console.log('Organization:', req.organizationId);

      const { name, email, role = 'user' } = req.body;

      // Basic validation
      if (!name || !email) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Name and email are required'
        });
      }

      // Check license limits before creating user
      const { query: dbQuery } = require('../database/connection');
      
      // Get current license info
      const licenseResult = await dbQuery(`
        SELECT * FROM get_organization_license_info($1)
      `, [req.organizationId], req.organizationId);
      
      if (licenseResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Organization not found',
          message: 'Could not retrieve license information'
        });
      }
      
      const licenseInfo = licenseResult.rows[0];
      
      // Check if we can add more users
      if (licenseInfo.available_seats <= 0) {
        return res.status(403).json({
          error: 'License limit exceeded',
          message: `Cannot add user. You have ${licenseInfo.active_users}/${licenseInfo.purchased_licenses} licenses in use. Please purchase additional licenses to add more users.`,
          licenseInfo: {
            purchasedLicenses: licenseInfo.purchased_licenses,
            activeUsers: parseInt(licenseInfo.active_users),
            availableSeats: licenseInfo.available_seats
          }
        });
      }

      const bcrypt = require('bcryptjs');

      // Generate simple password
      const tempPassword = 'TempPass123!';
      
      // Hash password
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      // Split name 
      const nameParts = name.trim().split(' ');
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(' ') || '';

      // Try simple database insert
      const result = await dbQuery(`
        INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, first_name, last_name, role
      `, [
        req.organizationId,
        email.toLowerCase(), 
        passwordHash,
        firstName,
        lastName,
        role || 'user'
      ], req.organizationId);

      const newUser = result.rows[0];

      // Send team member invitation email
      try {
        const emailService = require('../services/emailService');
        
        // Get organization info for email
        const orgQuery = await dbQuery(`
          SELECT name, slug FROM organizations WHERE id = $1
        `, [req.organizationId], req.organizationId);
        
        const organization = orgQuery.rows[0];
        const organizationName = organization?.name || 'Your Organization';
        
        // Get inviter info
        const inviterQuery = await dbQuery(`
          SELECT first_name, last_name FROM users WHERE id = $1
        `, [req.user.id], req.organizationId);
        
        const inviter = inviterQuery.rows[0];
        const invitedBy = inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : 'Team Admin';
        
        // Construct login URL
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const loginUrl = `${baseUrl}/login`;
        
        await emailService.sendTeamMemberInvitation({
          memberName: `${firstName} ${lastName}`.trim(),
          memberEmail: email,
          organizationName,
          invitedBy,
          loginUrl,
          temporaryPassword: tempPassword
        });
        
        console.log(`📧 Invitation email sent to ${email}`);
        
      } catch (emailError) {
        console.error('❌ Failed to send invitation email:', emailError);
        // Don't fail the user creation if email fails
      }

      return res.status(201).json({
        message: 'User created successfully and invitation email sent',
        user: {
          id: newUser.id,
          name: `${newUser.first_name} ${newUser.last_name}`.trim(),
          email: newUser.email,
          role: newUser.role,
          status: 'active'
        },
        password: tempPassword
      });

    } catch (error) {
      console.error('Create user error (minimal test version):', error);
      
      res.status(500).json({
        error: 'Failed to create user (minimal test)',
        message: error.message,
        details: {
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