const express = require('express');
const User = require('../models/User');
const Organization = require('../models/Organization');
const { validateLogin, validateRegister } = require('../middleware/validation');
const { resolveOrganization, authenticateToken } = require('../middleware/auth');
const { createRateLimiters, preventTimingAttacks } = require('../middleware/security');

const router = express.Router();
const rateLimiters = createRateLimiters();

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
 * Authenticate user within organization context
 */
router.post('/login',
  resolveOrganization,
  rateLimiters.auth,
  validateLogin,
  preventTimingAttacks,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const organizationId = req.organizationId;

      // Authenticate user
      const user = await User.authenticate(email, password, organizationId);
      
      if (!user) {
        return res.status(401).json({
          error: 'Authentication failed',
          message: 'Invalid email or password'
        });
      }

      // Generate token
      const tokenData = await user.generateToken(req.ip, req.get('User-Agent'));

      res.json({
        message: 'Login successful',
        user: tokenData.user,
        token: tokenData.token,
        expires_at: tokenData.expiresAt,
        organization: req.organization.toJSON()
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

module.exports = router;