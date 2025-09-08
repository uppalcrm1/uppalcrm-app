const express = require('express');
const cors = require('cors');
const path = require('path');
const { testConnection } = require('./database/connection');
const { 
  securityHeaders, 
  sanitizeInput, 
  securityLogger, 
  validateRequestSize,
  configureCORS,
  createRateLimiters
} = require('./middleware/security');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const leadRoutes = require('./routes/leads');
const contactRoutes = require('./routes/contacts');
const trialRoutes = require('./routes/trials');
const superAdminRoutes = require('./routes/super-admin');
// Public leads routes (simplified for production deployment)
let publicLeadRoutes;
try {
  // Try the full version first
  publicLeadRoutes = require('./routes/public-leads');
  console.log('✅ Full public leads routes loaded');
} catch (error) {
  console.warn('⚠️ Full public leads routes failed, trying simple version:', error.message);
  try {
    publicLeadRoutes = require('./routes/public-leads-simple');
    console.log('✅ Simple public leads routes loaded');
  } catch (simpleError) {
    console.error('❌ All public leads routes failed:', simpleError.message);
    publicLeadRoutes = null;
  }
}

// Load environment variables
require('dotenv').config();

// Import background jobs
const EngagementTracker = require('./jobs/engagementTracking');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy settings (for rate limiting and IP detection)
app.set('trust proxy', 1);

// Rate limiters
const rateLimiters = createRateLimiters();

// Security middleware
app.use(securityHeaders);
app.use(validateRequestSize);
app.use(securityLogger);

// CORS configuration
app.use(cors(configureCORS()));

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Input sanitization
app.use(sanitizeInput);

// Debug: Log all incoming requests
app.use((req, res, next) => {
  console.log(`📝 ${req.method} ${req.url} (path: ${req.path})`);
  next();
});

// Serve static files only if frontend dist exists (for local dev)
const frontendDistPath = path.join(__dirname, 'frontend/dist');
if (require('fs').existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API routes with rate limiting
app.use('/api/auth', rateLimiters.general, authRoutes);
app.use('/api/users', rateLimiters.general, userRoutes);
app.use('/api/organizations', rateLimiters.general, organizationRoutes);
app.use('/api/leads', rateLimiters.general, leadRoutes);
app.use('/api/contacts', rateLimiters.general, contactRoutes);
app.use('/api/trials', rateLimiters.general, trialRoutes);
app.use('/api/super-admin', rateLimiters.general, superAdminRoutes);

// Public routes (no authentication required)
console.log('🔍 DEBUG: publicLeadRoutes type:', typeof publicLeadRoutes, 'value:', !!publicLeadRoutes);
console.log('🔍 DEBUG: rateLimiters.strict type:', typeof rateLimiters.strict);
if (publicLeadRoutes && typeof publicLeadRoutes === 'function') {
  app.use('/api/public/leads', rateLimiters.general, publicLeadRoutes);
  console.log('✅ Public leads API enabled with general rate limiting');
} else {
  console.log('⚠️ Public leads API disabled. Type:', typeof publicLeadRoutes);
  // Create a simple placeholder route
  app.get('/api/public/leads/test', (req, res) => {
    res.json({
      message: 'Public leads API placeholder - full version failed to load',
      timestamp: new Date().toISOString(),
      debug: {
        routeType: typeof publicLeadRoutes,
        routeExists: !!publicLeadRoutes
      }
    });
  });
}

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'UppalCRM API',
    version: '1.0.0',
    description: 'Multi-tenant CRM API for software licensing businesses',
    endpoints: {
      auth: {
        'POST /api/auth/register': 'Register new organization with admin user',
        'POST /api/auth/login': 'Login to organization',
        'POST /api/auth/logout': 'Logout current session',
        'POST /api/auth/logout-all': 'Logout all sessions',
        'GET /api/auth/me': 'Get current user profile',
        'GET /api/auth/verify': 'Verify token validity',
        'POST /api/auth/refresh': 'Refresh authentication token'
      },
      users: {
        'GET /api/users': 'List users in organization',
        'GET /api/users/:id': 'Get specific user',
        'POST /api/users': 'Create new user (admin only)',
        'PUT /api/users/:id': 'Update user information',
        'PUT /api/users/:id/password': 'Change user password',
        'DELETE /api/users/:id': 'Deactivate user (admin only)',
        'GET /api/users/stats': 'Get user statistics (admin only)'
      },
      organizations: {
        'GET /api/organizations/current': 'Get current organization info',
        'PUT /api/organizations/current': 'Update organization (admin only)',
        'GET /api/organizations/current/stats': 'Get detailed organization statistics with leads and contacts',
        'GET /api/organizations/current/dashboard': 'Get comprehensive dashboard metrics including licensing',
        'GET /api/organizations/current/usage': 'Get usage metrics',
        'PUT /api/organizations/current/settings': 'Update organization settings',
        'DELETE /api/organizations/current': 'Deactivate organization (admin only)'
      },
      leads: {
        'GET /api/leads': 'List leads with filtering and pagination',
        'GET /api/leads/stats': 'Get lead statistics',
        'GET /api/leads/:id': 'Get specific lead',
        'POST /api/leads': 'Create new lead',
        'PUT /api/leads/:id': 'Update lead information',
        'PUT /api/leads/:id/assign': 'Assign lead to team member',
        'DELETE /api/leads/:id': 'Delete lead'
      },
      contacts: {
        'GET /api/contacts': 'List contacts with filtering and pagination',
        'GET /api/contacts/stats': 'Get contact statistics',
        'GET /api/contacts/software-editions': 'Get software editions catalog',
        'POST /api/contacts/software-editions': 'Create new software edition',
        'POST /api/contacts/convert-from-lead/:leadId': 'Convert lead to contact',
        'GET /api/contacts/:id': 'Get specific contact',
        'POST /api/contacts': 'Create new contact',
        'PUT /api/contacts/:id': 'Update contact information',
        'DELETE /api/contacts/:id': 'Delete contact',
        'GET /api/contacts/:id/accounts': 'Get contact accounts',
        'POST /api/contacts/:id/accounts': 'Create account for contact',
        'GET /api/contacts/:id/devices': 'Get contact devices',
        'POST /api/contacts/:id/devices': 'Register device for contact',
        'GET /api/contacts/:id/licenses': 'Get contact licenses',
        'POST /api/contacts/:id/licenses': 'Generate license for contact',
        'GET /api/contacts/:id/trials': 'Get contact trials',
        'POST /api/contacts/:id/trials': 'Create trial for contact',
        'POST /api/contacts/licenses/:licenseId/transfer': 'Transfer license between contacts',
        'POST /api/contacts/downloads/record': 'Record software download',
        'POST /api/contacts/activations/record': 'Record software activation'
      }
    },
    authentication: 'Bearer token required for authenticated endpoints',
    organization_context: 'Set via subdomain, custom domain, or X-Organization-Slug header'
  });
});

// Serve React app for root requests (if frontend exists)
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'frontend/dist/index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({
      name: 'UppalCRM API',
      version: '1.0.0',
      status: 'API service running',
      super_admin: '/api/super-admin/login'
    });
  }
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `API endpoint ${req.method} ${req.path} does not exist`,
    available_endpoints: '/api'
  });
});

// Serve React app for all other routes (SPA fallback) - only if frontend exists
app.get('*', (req, res) => {
  const indexPath = path.join(__dirname, 'frontend/dist/index.html');
  if (require('fs').existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).json({
      error: 'Frontend not available',
      message: 'This is an API-only service. Use /api endpoints.',
      super_admin_api: '/api/super-admin/login'
    });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'Something went wrong',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize background jobs
    EngagementTracker.init();
    console.log('📊 Background jobs initialized');
    
    app.listen(PORT, () => {
      console.log(`🚀 UppalCRM Server running on port ${PORT}`);
      console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🌐 Marketing Site: http://localhost:${PORT}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`👑 Super Admin: http://localhost:${PORT}/super-admin`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();