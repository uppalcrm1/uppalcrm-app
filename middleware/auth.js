const User = require('../models/User');
const Organization = require('../models/Organization');
const Trial = require('../models/Trial');
const jwt = require('jsonwebtoken');
const { query } = require('../database/connection');

/**
 * Middleware to authenticate JWT token and set user context
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Verify and get user from token
    const user = await User.verifyToken(token);
    if (!user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid or expired token. Please log in again.'
      });
    }

    // Strict validation: Ensure user has required fields and they are not empty strings
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!user.id || typeof user.id !== 'string' || user.id.trim() === '' || !uuidRegex.test(user.id)) {
      console.error('Invalid user ID in token:', {
        userId: user.id,
        userIdType: typeof user.id,
        email: user.email
      });
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid user ID. Please log in again.'
      });
    }

    if (!user.organization_id || typeof user.organization_id !== 'string' ||
        user.organization_id.trim() === '' || !uuidRegex.test(user.organization_id)) {
      console.error('Invalid organization ID in token:', {
        organizationId: user.organization_id,
        orgIdType: typeof user.organization_id,
        userId: user.id,
        email: user.email
      });
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid organization ID. Please log in again.'
      });
    }

    // Set user and organization context (now guaranteed to be valid UUIDs)
    req.user = user;
    req.userId = user.id;
    req.organizationId = user.organization_id;

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: 'Access denied',
      message: 'Authentication failed. Please log in again.'
    });
  }
};

/**
 * Middleware to check if user has required role
 * @param {Array|string} requiredRoles - Required roles
 */
const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has specific permission
 * @param {string} permission - Required permission
 */
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    if (!req.user.hasPermission(permission)) {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Middleware to resolve organization from subdomain or header
 */
const resolveOrganization = async (req, res, next) => {
  try {
    let organization = null;
    
    // Try to get organization from subdomain
    const hostname = req.get('host');
    if (hostname) {
      const subdomain = hostname.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        organization = await Organization.findBySlug(subdomain);
      }
    }

    // Try to get organization from custom domain
    if (!organization && hostname) {
      organization = await Organization.findByDomain(hostname);
    }

    // Try to get organization from header (for API requests)
    if (!organization) {
      const orgSlug = req.headers['x-organization-slug'];
      const orgId = req.headers['x-organization-id'];
      
      if (orgSlug) {
        organization = await Organization.findBySlug(orgSlug);
      } else if (orgId) {
        organization = await Organization.findById(orgId);
      }
    }

    if (!organization) {
      return res.status(400).json({
        error: 'Organization not found',
        message: 'Unable to determine organization context'
      });
    }

    req.organization = organization;
    req.organizationId = organization.id;
    
    next();
  } catch (error) {
    console.error('Organization resolution error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to resolve organization'
    });
  }
};

/**
 * Middleware for admin-only routes
 */
const requireAdmin = requireRole('admin');

/**
 * Middleware to check if user can manage other users
 */
const canManageUsers = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  // Admin can manage all users
  if (req.user.role === 'admin') {
    return next();
  }

  // Users can only access their own data
  const targetUserId = req.params.id || req.params.userId;
  if (targetUserId && targetUserId !== req.user.id) {
    return res.status(403).json({
      error: 'Access forbidden',
      message: 'Can only access your own data'
    });
  }

  next();
};

/**
 * Middleware to validate organization context matches token
 */
const validateOrganizationContext = (req, res, next) => {
  if (!req.user || !req.organizationId) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  if (req.user.organization_id !== req.organizationId) {
    return res.status(403).json({
      error: 'Organization mismatch',
      message: 'Token does not match organization context'
    });
  }

  next();
};

/**
 * Optional authentication middleware - sets user if token is valid but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const user = await User.verifyToken(token);
      if (user) {
        req.user = user;
        req.organizationId = user.organization_id;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Middleware to require organization context
 */
const requireOrganization = (req, res, next) => {
  if (!req.user || !req.user.organization_id) {
    return res.status(403).json({
      error: 'Organization required',
      message: 'This endpoint requires organization context'
    });
  }
  next();
};

/**
 * Middleware to check subscription access
 * Ensures organization has valid trial or paid subscription
 */
const checkSubscriptionAccess = async (req, res, next) => {
  try {
    if (!req.user || !req.user.organization_id) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    // Get trial status for the organization
    const trialStatus = await Trial.getTrialStatus(req.user.organization_id);
    
    if (!trialStatus) {
      return res.status(403).json({
        error: 'Subscription required',
        message: 'Organization not found'
      });
    }

    // Check if organization has valid access
    const hasValidAccess = 
      trialStatus.trial_status === 'active' ||           // Active trial
      trialStatus.trial_status === 'converted' ||        // Converted to paid
      trialStatus.payment_status === 'active';           // Active subscription

    if (!hasValidAccess) {
      return res.status(403).json({
        error: 'Subscription required',
        message: 'Your trial has expired. Please upgrade to continue using this feature.',
        trial_status: trialStatus.trial_status,
        payment_status: trialStatus.payment_status,
        can_upgrade: true
      });
    }

    // Add trial info to request for use in routes
    req.trialStatus = trialStatus;
    next();
  } catch (error) {
    console.error('Subscription access check error:', error);
    res.status(500).json({
      error: 'Server error',
      message: 'Failed to verify subscription access'
    });
  }
};

/**
 * Middleware to authenticate and authorize super admin users
 * Super admins are NOT tied to any organization and have platform-wide access
 */
const requireSuperAdmin = async (req, res, next) => {
  try {
    // Check for authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if token is marked as super admin
    if (!decoded.is_super_admin) {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'Super admin access required'
      });
    }

    // Verify super admin user exists in database and is active
    const result = await query(
      'SELECT * FROM super_admin_users WHERE id = $1 AND is_active = true',
      [decoded.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'Invalid super admin user or account is inactive'
      });
    }

    const superAdmin = result.rows[0];

    // Check if role is super_admin
    if (superAdmin.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Access forbidden',
        message: 'User is not a super admin'
      });
    }

    // Set super admin context on request
    req.superAdmin = {
      id: superAdmin.id,
      email: superAdmin.email,
      first_name: superAdmin.first_name,
      last_name: superAdmin.last_name,
      role: superAdmin.role,
      permissions: superAdmin.permissions,
      is_super_admin: true
    };

    // For backward compatibility with routes that check req.user
    req.user = req.superAdmin;

    next();
  } catch (error) {
    console.error('Super admin authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Token has expired'
      });
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Failed to authenticate super admin'
    });
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireAdmin,
  requireOrganization,
  resolveOrganization,
  canManageUsers,
  validateOrganizationContext,
  optionalAuth,
  checkSubscriptionAccess,
  requireSuperAdmin
};