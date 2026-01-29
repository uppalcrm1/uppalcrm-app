const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

/**
 * Rate limiting configurations for different endpoints
 */
const createRateLimiters = (envConfig = {}) => {
  // General API rate limiting
  const generalLimiter = rateLimit({
    windowMs: envConfig.rateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
    max: envConfig.rateLimitMax || 300, // Increased from 100 to 300 requests per window
    message: {
      error: 'Too many requests',
      message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests for rate limiting
    skipSuccessfulRequests: false,
    // Custom key generator based on organization and IP
    keyGenerator: (req) => {
      const orgId = req.organizationId || 'unknown';
      const ip = req.ip;
      return `${orgId}:${ip}`;
    }
  });

  // Strict rate limiting for authentication endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per window per IP per organization
    message: {
      error: 'Too many login attempts',
      message: 'Please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    keyGenerator: (req) => {
      const orgId = req.organizationId || 'unknown';
      const ip = req.ip;
      const email = req.body?.email || 'unknown';
      return `auth:${orgId}:${ip}:${email}`;
    }
  });

  // Rate limiting for organization creation (registration)
  const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 registrations per hour per IP
    message: {
      error: 'Registration limit exceeded',
      message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return `registration:${req.ip}`;
    }
  });

  // Rate limiting for password reset requests
  const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 password reset attempts per window
    message: {
      error: 'Too many password reset requests',
      message: 'Please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const orgId = req.organizationId || 'unknown';
      const email = req.body?.email || 'unknown';
      return `password-reset:${orgId}:${email}`;
    }
  });

  // Webhook rate limiting (stricter for external integrations)
  const webhookLimiter = rateLimit({
    windowMs: envConfig.webhookRateLimitWindowMs || 15 * 60 * 1000, // 15 minutes
    max: envConfig.webhookRateLimitMax || 5, // 5 requests per window
    message: {
      error: 'Webhook rate limit exceeded',
      message: 'Too many webhook requests. Please check your integration settings.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false, // Count all webhook requests
    keyGenerator: (req) => {
      // Rate limit by API key if available, otherwise by IP
      const apiKey = req.headers['x-api-key'];
      const orgId = req.organizationId || 'unknown';
      const ip = req.ip;
      
      if (apiKey) {
        // Extract organization from API key for better rate limiting
        const keyPrefix = apiKey.split('_')[1] || 'unknown';
        return `webhook:${keyPrefix}:${apiKey.substring(0, 10)}`;
      }
      
      return `webhook:${orgId}:${ip}`;
    }
  });

  return {
    general: generalLimiter,
    auth: authLimiter,
    registration: registrationLimiter,
    passwordReset: passwordResetLimiter,
    webhook: webhookLimiter
  };
};

/**
 * Security headers middleware using helmet
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Middleware to sanitize request data and prevent injection attacks
 */
const sanitizeInput = (req, res, next) => {
  // Function to recursively sanitize objects
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Remove potential XSS patterns
      return obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    } else if (Array.isArray(obj)) {
      return obj.map(sanitize);
    } else if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize key names to prevent prototype pollution
        const cleanKey = key.replace(/^(__proto__|constructor|prototype)$/i, '_sanitized_key');
        sanitized[cleanKey] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  // Sanitize request body
  if (req.body) {
    req.body = sanitize(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    req.query = sanitize(req.query);
  }

  next();
};

/**
 * Middleware to validate and sanitize organization context
 */
const validateOrganizationContext = (req, res, next) => {
  // Ensure organization ID is valid UUID format
  if (req.organizationId) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.organizationId)) {
      return res.status(400).json({
        error: 'Invalid organization context',
        message: 'Organization ID format is invalid'
      });
    }
  }

  next();
};

/**
 * Middleware to log security events
 */
const securityLogger = (req, res, next) => {
  // Log suspicious activities
  const suspicious = [
    // SQL injection attempts
    /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
    // XSS attempts
    /<script/i,
    /javascript:/i,
    // Path traversal attempts
    /\.\.\//,
    // Command injection attempts
    /[;&|`]/
  ];

  const checkForSuspicious = (data) => {
    if (!data) return false;
    try {
      const str = JSON.stringify(data).toLowerCase();
      return suspicious.some(pattern => pattern.test(str));
    } catch (error) {
      return false;
    }
  };

  if (checkForSuspicious(req.body) || checkForSuspicious(req.query) || checkForSuspicious(req.params)) {
    console.warn('Suspicious request detected:', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      organization: req.organizationId,
      user: req.user?.id,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * Middleware to prevent timing attacks on authentication
 */
const preventTimingAttacks = async (req, res, next) => {
  // Add random delay to prevent timing attacks
  const randomDelay = Math.floor(Math.random() * 100) + 50; // 50-150ms delay
  
  setTimeout(() => {
    next();
  }, randomDelay);
};

/**
 * Middleware to validate request size limits
 */
const validateRequestSize = (req, res, next) => {
  const maxBodySize = 1024 * 1024; // 1MB limit
  
  if (req.get('content-length') && parseInt(req.get('content-length')) > maxBodySize) {
    return res.status(413).json({
      error: 'Request too large',
      message: 'Request body exceeds size limit'
    });
  }

  next();
};

/**
 * CORS configuration for multi-tenant setup
 */
const configureCORS = () => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
  const frontendUrl = process.env.FRONTEND_URL;
  
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, postman, etc.)
      if (!origin) return callback(null, true);
      
      // Always allow the configured frontend URL in production
      if (frontendUrl && origin === frontendUrl) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Check for subdomain patterns (e.g., *.uppalcrm.com)
      const isSubdomain = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin.startsWith('*.')) {
          const domain = allowedOrigin.slice(2);
          return origin.endsWith(domain);
        }
        return false;
      });
      
      if (isSubdomain) {
        return callback(null, true);
      }
      
      // Allow localhost in development
      if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
        return callback(null, true);
      }
      
      // Allow Render.com domains for deployment
      if (origin.includes('.onrender.com')) {
        return callback(null, true);
      }
      
      // Allow Netlify domains for marketing site
      if (origin.includes('.netlify.app')) {
        return callback(null, true);
      }
      
      // Allow specific Netlify domain
      if (origin === 'https://uppalcrmapp.netlify.app') {
        return callback(null, true);
      }
      
      // Allow Zapier domains for webhook functionality
      if (origin && (
        origin.includes('zapier.com') ||
        origin.includes('zapierusercontent.com') ||
        origin.includes('hooks.zapier.com')
      )) {
        return callback(null, true);
      }
      
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Organization-Slug',
      'X-Organization-ID',
      'X-API-Key',
      'X-Webhook-Id',
      'X-Webhook-Source',
      'X-User-Timezone'
    ]
  };
};

module.exports = {
  createRateLimiters,
  securityHeaders,
  sanitizeInput,
  validateOrganizationContext,
  securityLogger,
  preventTimingAttacks,
  validateRequestSize,
  configureCORS
};