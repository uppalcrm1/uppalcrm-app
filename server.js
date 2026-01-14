const express = require('express');
const cors = require('cors');
const path = require('path');
const { version } = require('./package.json');
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
const leadInteractionsRoutes = require('./routes/leadInteractions');
const tasksRoutes = require('./routes/tasks');
const contactRoutes = require('./routes/contacts');
const trialRoutes = require('./routes/trials');
const superAdminRoutes = require('./routes/super-admin');
const notifyAdminRoutes = require('./routes/notify-admin');
const adminRoutes = require('./routes/admin');
const webhooksRoutes = require('./routes/webhooks');
const apiKeysRoutes = require('./routes/api-keys');
const aiSettingsRoutes = require('./routes/ai-settings');
const customFieldsRoutes = require('./routes/customFields');
const productFieldCustomizationRoutes = require('./routes/productFieldCustomization');
const productsRoutes = require('./routes/products');
const subscriptionRoutes = require('./routes/subscription');
const platformAdminRoutes = require('./routes/platformAdmin');
const adminFixTrialsRoutes = require('./routes/admin-fix-trials');
const transactionsRoutes = require('./routes/transactions');
const twilioRoutes = require('./routes/twilio');
const reportingRoutes = require('./routes/reporting');
const reportsRoutes = require('./routes/reports');
const dashboardsRoutes = require('./routes/dashboards');

// Field Mapping System Routes
const fieldMappingsRoutes = require('./routes/fieldMappings');

// Import scheduled jobs
const scheduledJobs = require('./services/scheduledJobs');

// Account Management Routes
const accountRoutes = require('./routes/accounts-simple'); // Simple accounts for CRM
const accountSubscriptionRoutes = require('./routes/accounts'); // Legacy licensing system
const licenseRoutes = require('./routes/licenses'); // Legacy support
const deviceRoutes = require('./routes/devices');
const softwareEditionRoutes = require('./routes/softwareEditions');
const downloadRoutes = require('./routes/downloads');

// Import Routes
const importRoutes = require('./routes/import');
const contactImportRoutes = require('./routes/contactImportRoutes');
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

// Validate environment configuration
const { validateEnvironment } = require('./utils/envValidation');
const envConfig = validateEnvironment();

// Import background jobs
const EngagementTracker = require('./jobs/engagementTracking');

const app = express();
const PORT = envConfig.port;

// Trust proxy settings (for rate limiting and IP detection)
app.set('trust proxy', 1);

// Rate limiters
const rateLimiters = createRateLimiters(envConfig);

// Security middleware
app.use(securityHeaders);
app.use(validateRequestSize);
app.use(securityLogger);

// CORS configuration
app.use(cors(configureCORS()));

// Body parsing middleware
app.use(express.json({ limit: '20mb' })); // Increased for large CSV imports
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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
    version
  });
});

// Public debug endpoint (no auth required)
app.get('/debug', async (req, res) => {
  try {
    const { query } = require('./database/connection');
    const debug = {
      timestamp: new Date().toISOString(),
      steps: []
    };

    // Step 1: Test basic query
    debug.steps.push({ step: 1, name: 'Testing basic database connection' });
    const basicTest = await query('SELECT NOW() as current_time');
    debug.steps.push({ step: 1, result: 'SUCCESS', data: basicTest.rows[0] });

    // Step 2: Check if organizations table exists
    debug.steps.push({ step: 2, name: 'Checking organizations table' });
    const orgCheck = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'organizations'
    `);
    debug.steps.push({ step: 2, result: 'SUCCESS', exists: orgCheck.rows.length > 0 });

    // Step 3: Check if contacts table exists
    debug.steps.push({ step: 3, name: 'Checking contacts table' });
    const contactsCheck = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'contacts'
    `);
    debug.steps.push({ step: 3, result: 'SUCCESS', exists: contactsCheck.rows.length > 0 });

    // Step 4: Check UUID extension
    debug.steps.push({ step: 4, name: 'Checking UUID extension' });
    const uuidCheck = await query(`
      SELECT extname FROM pg_extension WHERE extname = 'uuid-ossp'
    `);
    debug.steps.push({ step: 4, result: 'SUCCESS', exists: uuidCheck.rows.length > 0 });

    // Step 5: Test UUID generation
    debug.steps.push({ step: 5, name: 'Testing UUID generation' });
    const uuidTest = await query('SELECT uuid_generate_v4() as test_uuid');
    debug.steps.push({ step: 5, result: 'SUCCESS', uuid: uuidTest.rows[0].test_uuid });

    res.json(debug);
  } catch (error) {
    res.status(500).json({
      error: 'Debug failed',
      details: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        name: error.name,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// API routes with rate limiting
app.use('/api/auth', rateLimiters.general, authRoutes);
app.use('/api/users', rateLimiters.general, userRoutes);
app.use('/api/user-management', rateLimiters.general, require('./routes/user-management'));
app.use('/api/organizations', rateLimiters.general, organizationRoutes);

// Debug: Log routes registered in leadRoutes
console.log('🔍 Registering leadRoutes...');
if (leadRoutes && leadRoutes.stack) {
  const routes = leadRoutes.stack
    .filter(layer => layer.route)
    .map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  console.log('📋 leadRoutes registered routes:', routes.slice(0, 20));
}

app.use('/api/leads', rateLimiters.general, leadRoutes);
app.use('/api/leads', rateLimiters.general, leadInteractionsRoutes);
app.use('/api/tasks', rateLimiters.general, tasksRoutes);
app.use('/api/contacts', rateLimiters.general, contactRoutes);
app.use('/api/trials', rateLimiters.general, trialRoutes);
app.use('/api/super-admin', rateLimiters.general, superAdminRoutes);
app.use('/api/notify-admin', rateLimiters.general, notifyAdminRoutes);
app.use('/api/admin', rateLimiters.general, adminRoutes);
app.use('/api/platform', rateLimiters.general, platformAdminRoutes);
app.use('/api/platform/admin', rateLimiters.general, adminFixTrialsRoutes);

// Account Management API routes
app.use('/api/accounts', rateLimiters.general, accountRoutes);
app.use('/api/transactions', rateLimiters.general, transactionsRoutes);

// Reporting & Analytics API routes
app.use('/api/reporting', rateLimiters.general, reportingRoutes);
app.use('/api/reports', rateLimiters.general, reportsRoutes);
app.use('/api/dashboards', rateLimiters.general, dashboardsRoutes);
// Legacy License Management API routes (for backward compatibility)
app.use('/api/licenses', rateLimiters.general, licenseRoutes);
app.use('/api/devices', rateLimiters.general, deviceRoutes);
app.use('/api/software-editions', rateLimiters.general, softwareEditionRoutes);
app.use('/api/downloads', rateLimiters.general, downloadRoutes);

// Import API routes
app.use('/api/import', rateLimiters.general, importRoutes);
app.use('/api/imports/contacts', rateLimiters.general, contactImportRoutes);

// Webhook routes (external integrations - use webhook-specific rate limiting)
app.use('/api/webhooks', rateLimiters.webhook, webhooksRoutes);

// API Keys management routes (admin functionality)
app.use('/api/organizations/current/api-keys', rateLimiters.general, apiKeysRoutes);

// AI Settings management routes (admin functionality)
app.use('/api/organizations/current', rateLimiters.general, aiSettingsRoutes);

// Custom Fields management routes
app.use('/api/custom-fields', rateLimiters.general, customFieldsRoutes);

// Product Field Customization routes
app.use('/api/organizations/:organizationId/field-customization/product', rateLimiters.general, productFieldCustomizationRoutes);

// Products management routes
app.use('/api/products', rateLimiters.general, productsRoutes);

// Subscription management routes
app.use('/api/subscription', rateLimiters.general, subscriptionRoutes);

// Field Mapping System routes
app.use('/api/field-mappings', rateLimiters.general, fieldMappingsRoutes);

// Twilio integration routes
app.use('/api/twilio', twilioRoutes);

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
    version,
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
      },
      'user-management': {
        'GET /api/user-management': 'List users with pagination and filtering (admin only)',
        'POST /api/user-management': 'Create new user with auto-generated password (admin only)',
        'PUT /api/user-management/:id': 'Update user details (admin only)',
        'POST /api/user-management/:id/reset-password': 'Reset user password (admin only)',
        'DELETE /api/user-management/:id': 'Delete/deactivate user (admin only)',
        'POST /api/user-management/bulk': 'Perform bulk operations on users (admin only)',
        'GET /api/user-management/audit-log': 'Get user management audit log (admin only)'
      },
      webhooks: {
        'POST /api/webhooks/:webhookId': 'Generic webhook endpoint for integrations (API key required)',
        'POST /api/webhooks/leads': 'Direct lead creation webhook for Zapier (API key required)',
        'GET /api/webhooks/test/:webhookId': 'Test webhook endpoint for validation (API key required)'
      },
      'api-keys': {
        'GET /api/organizations/current/api-keys': 'List organization API keys (admin only)',
        'POST /api/organizations/current/api-keys': 'Create new API key (admin only)',
        'DELETE /api/organizations/current/api-keys/:id': 'Deactivate API key (admin only)',
        'GET /api/organizations/current/api-keys/:id/usage': 'Get API key usage statistics (admin only)',
        'PUT /api/organizations/current/api-keys/:id/permissions': 'Update API key permissions (admin only)',
        'PUT /api/organizations/current/api-keys/:id/rate-limit': 'Update API key rate limit (admin only)'
      },
      'custom-fields': {
        'GET /api/custom-fields': 'Get all custom fields and configuration',
        'POST /api/custom-fields': 'Create new custom field (rate limited: 10/day)',
        'PUT /api/custom-fields/:fieldId': 'Update custom field',
        'DELETE /api/custom-fields/:fieldId': 'Delete custom field',
        'PUT /api/custom-fields/default/:fieldName': 'Update default field configuration'
      },
      'product-field-customization': {
        'GET /api/organizations/:organizationId/field-customization/product': 'Get all product custom fields (admin only)',
        'POST /api/organizations/:organizationId/field-customization/product': 'Create new product custom field (admin only)',
        'PATCH /api/organizations/:organizationId/field-customization/product/:fieldId': 'Update product custom field (admin only)',
        'DELETE /api/organizations/:organizationId/field-customization/product/:fieldId': 'Delete product custom field (admin only)'
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
      version,
      status: 'API service running',
      super_admin: '/api/super-admin/login'
    });
  }
});

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  console.error('❌ 404 Handler Hit:', {
    method: req.method,
    originalUrl: req.originalUrl,
    url: req.url,
    path: req.path,
    baseUrl: req.baseUrl
  });
  res.status(404).json({
    error: 'Endpoint not found',
    message: `API endpoint ${req.method} ${req.originalUrl} does not exist`,
    available_endpoints: '/api',
    debug: {
      url: req.url,
      path: req.path,
      originalUrl: req.originalUrl
    }
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

    // Fix lead creation trigger (run once on startup)
    try {
      const { fixLeadCreationTrigger } = require('./scripts/fix-lead-creation-trigger');
      await fixLeadCreationTrigger();
      console.log('✅ Lead creation trigger verified/updated');
    } catch (triggerError) {
      console.error('⚠️  Lead creation trigger update failed:', triggerError.message);
      // Don't stop server if this fails
    }

    // Initialize email service
    const emailService = require('./services/emailService');
    await emailService.initialize();
    console.log('📧 Email service initialization complete');

    // Initialize background jobs
    EngagementTracker.init();
    console.log('📊 Background jobs initialized');
    
    // One-time license field sync on startup
    try {
      const { query } = require('./database/connection');
      const checkResult = await query(`
        SELECT COUNT(*) as discrepant_count
        FROM organizations 
        WHERE max_users != purchased_licenses
      `);
      
      const discrepantCount = parseInt(checkResult.rows[0].discrepant_count);
      
      if (discrepantCount > 0) {
        console.log(`🔧 STARTUP SYNC: Found ${discrepantCount} organizations with license field discrepancies - syncing...`);
        
        const updateResult = await query(`
          UPDATE organizations 
          SET max_users = purchased_licenses, updated_at = NOW() 
          WHERE max_users != purchased_licenses
          RETURNING name, max_users, purchased_licenses
        `);
        
        console.log('✅ License field sync completed:');
        updateResult.rows.forEach(org => {
          console.log(`  - ${org.name}: max_users = ${org.max_users}, purchased_licenses = ${org.purchased_licenses}`);
        });
      } else {
        console.log('✅ License fields are already synchronized');
      }
    } catch (error) {
      console.error('⚠️  License field sync failed:', error.message);
    }
    
    app.listen(PORT, () => {
      console.log(`🚀 UppalCRM Server running on port ${PORT}`);
      console.log(`📊 API Documentation: http://localhost:${PORT}/api`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🌐 Marketing Site: http://localhost:${PORT}`);
      console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`👑 Super Admin: http://localhost:${PORT}/super-admin`);

      // Start scheduled billing jobs
      try {
        scheduledJobs.start();
        console.log('✅ Billing automation jobs started successfully');
      } catch (error) {
        console.error('❌ Failed to start billing jobs:', error.message);
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
