const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');

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
        message: 'Invalid or expired token'
      });
    }

    // Set user and organization context
    req.user = user;
    req.organizationId = user.organization_id;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: 'Access denied',
      message: 'Invalid token'
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

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireAdmin,
  requireOrganization,
  resolveOrganization,
  canManageUsers,
  validateOrganizationContext,
  optionalAuth
};