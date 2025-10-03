const express = require('express');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { validateLogin, validateRegister } = require('../middleware/validation');
const { resolveOrganization, authenticateToken } = require('../middleware/auth');
const { createRateLimiters, preventTimingAttacks } = require('../middleware/security');
const emailService = require('../services/emailService');

const router = express.Router();
const rateLimiters = createRateLimiters();

// Initialize email service
emailService.initialize().catch(err => {
  console.warn('Email service initialization failed:', err.message);
});

/**
 * POST /auth/register
 * Register a new organization with admin user
 */
router.post('/register', 
  rateLimiters.registration,
  validateRegister,
  async (req, res) => {
    try {
      const { organization, admin } = req.body;

      // Create organization with admin user
      const result = await Organization.create(organization, admin);

      // Generate token for the admin user
      const user = await User.findById(result.admin_user_id, result.organization.id);
      const tokenData = await user.generateToken(req.ip, req.get('User-Agent'));

      // Send welcome email with login credentials (non-blocking)
      const sendWelcomeEmail = async () => {
        try {
          const loginUrl = `${process.env.FRONTEND_URL || 'https://uppalcrm-frontend.onrender.com'}/login?org=${result.organization.slug}`;
          
          await emailService.sendWelcomeEmail({
            organizationName: result.organization.name,
            adminEmail: admin.email,
            adminName: `${admin.first_name} ${admin.last_name}`,
            loginUrl: loginUrl,
            temporaryPassword: admin.password, // Original password before hashing
            organizationSlug: result.organization.slug
          });
          
          console.log(`✅ Welcome email sent to ${admin.email} for organization ${result.organization.name}`);
        } catch (emailError) {
          console.error('Failed to send welcome email:', {
            error: emailError.message,
            organizationId: result.organization.id,
            adminEmail: admin.email,
            organizationName: result.organization.name
          });
          // Don't throw error - email failure shouldn't prevent registration success
        }
      };

      // Send lead notification email to admin (non-blocking)
      const sendLeadNotification = async () => {
        try {
          await emailService.sendLeadNotification({
            leadName: `${admin.first_name} ${admin.last_name}`,
            leadEmail: admin.email,
            leadCompany: result.organization.name,
            leadPhone: null, // Phone not captured in basic registration
            leadMessage: `New trial signup via marketing site registration form`,
            organizationName: result.organization.name,
            utmSource: 'marketing-site',
            utmMedium: 'registration',
            utmCampaign: 'trial-signup'
          });
          
          console.log(`✅ Lead notification sent to uppalcrm1@gmail.com for ${admin.first_name} ${admin.last_name}`);
        } catch (emailError) {
          console.error('Failed to send lead notification:', {
            error: emailError.message,
            organizationId: result.organization.id,
            adminEmail: admin.email,
            organizationName: result.organization.name
          });
          // Don't throw error - email failure shouldn't prevent registration success
        }
      };

      // Send emails asynchronously (don't wait for them)
      sendWelcomeEmail();
      sendLeadNotification();

      res.status(201).json({
        message: 'Organization created successfully',
        organization: result.organization.toJSON(),
        user: tokenData.user,
        token: tokenData.token,
        expires_at: tokenData.expiresAt
      });
    } catch (error) {
      console.error('Registration error:', error);
      
      if (error.message.includes('already exists')) {
        return res.status(409).json({
          error: 'Registration failed',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Registration failed',
        message: 'Unable to create organization'
      });
    }
  }
);

/**
 * POST /auth/login
 * Authenticate user with email and password only
 */
router.post('/login',
  rateLimiters.auth,
  validateLogin,
  preventTimingAttacks,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Authenticate user globally (no organization context needed)
      const user = await User.authenticate(email, password);

      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Get user's organization
      const Organization = require('../models/Organization');
      const organization = await Organization.findById(user.organization_id);

      if (!organization) {
        return res.status(500).json({
          error: 'Organization not found',
          message: 'User organization no longer exists'
        });
      }

      // Generate token
      const tokenData = await user.generateToken(req.ip, req.get('User-Agent'));

      res.json({
        message: 'Login successful',
        user: tokenData.user,
        token: tokenData.token,
        expires_at: tokenData.expiresAt,
        organization: organization.toJSON()
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Login failed',
        message: 'Unable to authenticate user'
      });
    }
  }
);

/**
 * POST /auth/logout
 * Logout current user (revoke token)
 */
router.post('/logout',
  authenticateToken,
  async (req, res) => {
    try {
      const token = req.headers['authorization']?.split(' ')[1];
      
      if (token) {
        await User.revokeToken(token);
      }

      res.json({
        message: 'Logout successful'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed',
        message: 'Unable to logout user'
      });
    }
  }
);

/**
 * POST /auth/logout-all
 * Logout from all devices (revoke all tokens)
 */
router.post('/logout-all',
  authenticateToken,
  async (req, res) => {
    try {
      await User.revokeAllTokens(req.user.id, req.organizationId);

      res.json({
        message: 'Logged out from all devices'
      });
    } catch (error) {
      console.error('Logout all error:', error);
      res.status(500).json({
        error: 'Logout failed',
        message: 'Unable to logout from all devices'
      });
    }
  }
);

/**
 * GET /auth/me
 * Get current user profile
 */
router.get('/me',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id, req.organizationId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'Current user not found'
        });
      }

      const organization = await Organization.findById(req.organizationId);

      res.json({
        user: user.toJSON(),
        organization: organization?.toJSON()
      });
    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        error: 'Failed to get user profile',
        message: 'Unable to retrieve user information'
      });
    }
  }
);

/**
 * GET /auth/verify
 * Verify if current token is valid
 */
router.get('/verify',
  authenticateToken,
  (req, res) => {
    res.json({
      valid: true,
      user: req.user.toJSON(),
      organization_id: req.organizationId
    });
  }
);

/**
 * POST /auth/refresh
 * Refresh the current token (extend expiration)
 */
router.post('/refresh',
  authenticateToken,
  async (req, res) => {
    try {
      const user = await User.findById(req.user.id, req.organizationId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found',
          message: 'User account no longer exists'
        });
      }

      // Revoke current token
      const currentToken = req.headers['authorization']?.split(' ')[1];
      if (currentToken) {
        await User.revokeToken(currentToken);
      }

      // Generate new token
      const tokenData = await user.generateToken(req.ip, req.get('User-Agent'));

      res.json({
        message: 'Token refreshed successfully',
        token: tokenData.token,
        expires_at: tokenData.expiresAt,
        user: tokenData.user
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        error: 'Token refresh failed',
        message: 'Unable to refresh token'
      });
    }
  }
);

/**
 * POST /auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password',
  rateLimiters.passwordReset,
  async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          error: 'Email is required'
        });
      }

      // Find user by email globally (no org context needed)
      const user = await User.findByEmailGlobal(email.toLowerCase());

      // Always return success to prevent email enumeration
      if (!user) {
        console.log(`Password reset requested for non-existent email: ${email}`);
        return res.json({
          message: 'If an account with that email exists, a password reset link has been sent.'
        });
      }

      // Generate reset token
      const crypto = require('crypto');
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

      // Store reset token in database
      const { query } = require('../database/connection');
      await query(`
        UPDATE users
        SET reset_token_hash = $1,
            reset_token_expiry = $2,
            updated_at = NOW()
        WHERE id = $3
      `, [resetTokenHash, resetTokenExpiry, user.id]);

      // Get organization for email
      const organization = await Organization.findById(user.organization_id);

      // Send reset email
      const resetUrl = `${process.env.FRONTEND_URL || 'https://uppalcrm-frontend.onrender.com'}/reset-password/${resetToken}`;

      try {
        await emailService.sendPasswordResetEmail({
          email: user.email,
          name: user.name || `${user.first_name} ${user.last_name}`,
          resetToken,
          resetUrl,
          organizationName: organization?.name || 'UppalCRM'
        });

        console.log(`✅ Password reset email sent to ${user.email}`);
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
        // Don't fail the request if email fails
      }

      res.json({
        message: 'If an account with that email exists, a password reset link has been sent.'
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        error: 'Failed to process password reset request'
      });
    }
  }
);

/**
 * POST /auth/reset-password/:token
 * Reset password with token
 */
router.post('/reset-password/:token',
  rateLimiters.passwordReset,
  async (req, res) => {
    try {
      const { token } = req.params;
      const { password } = req.body;

      if (!password || password.length < 8) {
        return res.status(400).json({
          error: 'Password must be at least 8 characters long'
        });
      }

      // Hash the token to match database
      const crypto = require('crypto');
      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with valid reset token
      const { query } = require('../database/connection');
      const result = await query(`
        SELECT * FROM users
        WHERE reset_token_hash = $1
        AND reset_token_expiry > NOW()
        AND is_active = true
      `, [resetTokenHash]);

      if (result.rows.length === 0) {
        return res.status(400).json({
          error: 'Invalid or expired reset token'
        });
      }

      const user = new User(result.rows[0]);

      // Hash new password
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      // Update password and clear reset token
      await query(`
        UPDATE users
        SET password_hash = $1,
            reset_token_hash = NULL,
            reset_token_expiry = NULL,
            failed_login_attempts = 0,
            updated_at = NOW()
        WHERE id = $2
      `, [passwordHash, user.id]);

      console.log(`✅ Password reset successful for user: ${user.email}`);

      res.json({
        message: 'Password has been reset successfully. You can now login with your new password.'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        error: 'Failed to reset password'
      });
    }
  }
);

module.exports = router;