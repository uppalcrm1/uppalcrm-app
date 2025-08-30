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

// Load environment variables
require('dotenv').config();

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

// Serve static files (marketing website)
app.use(express.static(path.join(__dirname, '.')));

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
        'GET /api/organizations/current/stats': 'Get organization statistics',
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
      }
    },
    authentication: 'Bearer token required for authenticated endpoints',
    organization_context: 'Set via subdomain, custom domain, or X-Organization-Slug header'
  });
});

// Serve marketing website for root requests
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `API endpoint ${req.method} ${req.path} does not exist`,
    available_endpoints: '/api'
  });
});

// Serve marketing website for all other routes (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
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
    
    app.listen(PORT, () => {
      console.log(`🚀 UppalCRM Server running on port ${PORT}`);
      console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🌐 Marketing Site: http://localhost:${PORT}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();