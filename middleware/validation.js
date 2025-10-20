const Joi = require('joi');

/**
 * Middleware factory to validate request data using Joi schemas
 * @param {Object} schema - Joi schema object with body, params, query properties
 */
const validate = (schema) => {
  return (req, res, next) => {
    const errors = {};

    // Validate request body
    if (schema.body) {
      const { error } = schema.body.validate(req.body);
      if (error) {
        errors.body = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
      }
    }

    // Validate request parameters
    if (schema.params) {
      const { error } = schema.params.validate(req.params);
      if (error) {
        errors.params = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
      }
    }

    // Validate query parameters
    if (schema.query) {
      const { error } = schema.query.validate(req.query);
      if (error) {
        errors.query = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));
      }
    }

    // Return validation errors if any
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Request data is invalid',
        details: errors
      });
    }

    next();
  };
};

// Common validation schemas
const schemas = {
  // Organization schemas
  createOrganization: {
    body: Joi.object({
      name: Joi.string().min(2).max(255).required(),
      slug: Joi.string().alphanum().min(2).max(100).optional(),
      domain: Joi.string().domain().optional(),
      admin: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        first_name: Joi.string().min(1).max(100).required(),
        last_name: Joi.string().min(1).max(100).required()
      }).required()
    })
  },

  updateOrganization: {
    body: Joi.object({
      name: Joi.string().min(2).max(255).optional(),
      domain: Joi.string().domain().optional(),
      settings: Joi.object().optional(),
      subscription_plan: Joi.string().valid('starter', 'professional', 'business', 'enterprise').optional(),
      max_users: Joi.number().integer().min(1).max(10000).optional()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  // User schemas
  createUser: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).optional(), // Optional for invitation-based creation
      first_name: Joi.string().min(1).max(100).required(),
      last_name: Joi.string().min(1).max(100).required(),
      role: Joi.string().valid('admin', 'manager', 'user', 'viewer').default('user'),
      send_invitation: Joi.boolean().optional()
    })
  },

  updateUser: {
    body: Joi.object({
      first_name: Joi.string().min(1).max(100).optional(),
      last_name: Joi.string().min(1).max(100).optional(),
      role: Joi.string().valid('admin', 'manager', 'user', 'viewer').optional(),
      permissions: Joi.array().items(Joi.string()).optional(),
      email_verified: Joi.boolean().optional()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  changePassword: {
    body: Joi.object({
      current_password: Joi.string().required(),
      new_password: Joi.string().min(8).required(),
      confirm_password: Joi.string().valid(Joi.ref('new_password')).required()
    }),
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  // Authentication schemas
  login: {
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required()
    })
  },

  register: {
    body: Joi.object({
      organization: Joi.object({
        name: Joi.string().min(2).max(255).required(),
        slug: Joi.string().alphanum().min(2).max(100).optional(),
        domain: Joi.string().domain().optional()
      }).required(),
      admin: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
        first_name: Joi.string().min(1).max(100).required(),
        last_name: Joi.string().min(1).max(100).required()
      }).required()
    })
  },

  // Common parameter schemas
  uuidParam: {
    params: Joi.object({
      id: Joi.string().guid({ version: 'uuidv4' }).required()
    })
  },

  // Pagination and search schemas
  listUsers: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      role: Joi.string().valid('admin', 'manager', 'user', 'viewer').optional(),
      search: Joi.string().min(1).max(100).optional(),
      sort: Joi.string().valid('created_at', 'updated_at', 'email', 'first_name', 'last_name').default('created_at'),
      order: Joi.string().valid('asc', 'desc').default('desc')
    })
  }
};

/**
 * Validation middleware for creating organization
 */
const validateCreateOrganization = validate(schemas.createOrganization);

/**
 * Validation middleware for updating organization
 */
const validateUpdateOrganization = validate(schemas.updateOrganization);

/**
 * Validation middleware for creating user
 */
const validateCreateUser = validate(schemas.createUser);

/**
 * Validation middleware for updating user
 */
const validateUpdateUser = validate(schemas.updateUser);

/**
 * Validation middleware for changing password
 */
const validateChangePassword = validate(schemas.changePassword);

/**
 * Validation middleware for login
 */
const validateLogin = validate(schemas.login);

/**
 * Validation middleware for registration
 */
const validateRegister = validate(schemas.register);

/**
 * Validation middleware for UUID parameters
 */
const validateUuidParam = validate(schemas.uuidParam);

/**
 * Validation middleware for listing users
 */
const validateListUsers = validate(schemas.listUsers);

/**
 * Custom validation for password strength
 * @param {string} password - Password to validate
 * @returns {Object} Validation result
 */
const validatePasswordStrength = (password) => {
  const result = {
    isValid: true,
    errors: []
  };

  if (password.length < 8) {
    result.isValid = false;
    result.errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    result.isValid = false;
    result.errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    result.isValid = false;
    result.errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    result.isValid = false;
    result.errors.push('Password must contain at least one number');
  }

  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    result.isValid = false;
    result.errors.push('Password must contain at least one special character');
  }

  return result;
};

/**
 * Middleware to validate password strength
 */
const requireStrongPassword = (req, res, next) => {
  const password = req.body.password || req.body.new_password;
  
  if (!password) {
    return next(); // Let other validators handle missing password
  }

  const validation = validatePasswordStrength(password);
  
  if (!validation.isValid) {
    return res.status(400).json({
      error: 'Password validation failed',
      message: 'Password does not meet strength requirements',
      details: validation.errors
    });
  }

  next();
};

module.exports = {
  validate,
  schemas,
  validateCreateOrganization,
  validateUpdateOrganization,
  validateCreateUser,
  validateUpdateUser,
  validateChangePassword,
  validateLogin,
  validateRegister,
  validateUuidParam,
  validateListUsers,
  validatePasswordStrength,
  requireStrongPassword
};