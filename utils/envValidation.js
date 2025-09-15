/**
 * Environment variable validation utilities
 */

const crypto = require('crypto');

/**
 * Validate required environment variables
 */
const validateRequiredEnvVars = () => {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'SESSION_SECRET'
  ];

  const missing = required.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};

/**
 * Validate webhook-specific environment variables
 */
const validateWebhookEnvVars = () => {
  const webhookRequired = [
    'WEBHOOK_BASE_URL',
    'API_KEY_ENCRYPTION_KEY'
  ];

  const missing = webhookRequired.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    console.warn(`⚠️  Missing webhook environment variables: ${missing.join(', ')}`);
    console.warn('   Webhook functionality may be limited. Please set these variables for production.');
    return false;
  }

  // Validate API_KEY_ENCRYPTION_KEY length
  if (process.env.API_KEY_ENCRYPTION_KEY && process.env.API_KEY_ENCRYPTION_KEY.length < 32) {
    console.warn('⚠️  API_KEY_ENCRYPTION_KEY should be at least 32 characters long for security');
  }

  // Validate WEBHOOK_BASE_URL format
  if (process.env.WEBHOOK_BASE_URL) {
    try {
      new URL(process.env.WEBHOOK_BASE_URL);
    } catch (error) {
      console.warn('⚠️  WEBHOOK_BASE_URL is not a valid URL format');
    }
  }

  return true;
};

/**
 * Generate a secure encryption key if one doesn't exist
 */
const generateEncryptionKey = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validate security-related environment variables
 */
const validateSecurityEnvVars = () => {
  // Check JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters long for security');
  }

  // Check SESSION_SECRET strength
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    console.warn('⚠️  SESSION_SECRET should be at least 32 characters long for security');
  }

  // Check if default values are being used
  const defaultValues = [
    'your-super-secret-jwt-key-change-this',
    'your-session-secret-change-this',
    'your-32-character-encryption-key-change-this'
  ];

  const usingDefaults = [
    process.env.JWT_SECRET,
    process.env.SESSION_SECRET,
    process.env.API_KEY_ENCRYPTION_KEY
  ].some(value => defaultValues.includes(value));

  if (usingDefaults && process.env.NODE_ENV === 'production') {
    throw new Error('❌ Default security keys detected in production! Please change all default values in your environment variables.');
  }

  if (usingDefaults) {
    console.warn('⚠️  Using default security keys. Please change these for production deployment.');
  }
};

/**
 * Get environment-specific configuration
 */
const getEnvConfig = () => {
  return {
    // Database
    databaseUrl: process.env.DATABASE_URL,
    
    // Server
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    
    // Security
    jwtSecret: process.env.JWT_SECRET,
    sessionSecret: process.env.SESSION_SECRET,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
    
    // Rate Limiting
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    
    // Webhook Configuration
    webhookBaseUrl: process.env.WEBHOOK_BASE_URL,
    apiKeyEncryptionKey: process.env.API_KEY_ENCRYPTION_KEY,
    webhookRateLimitWindowMs: parseInt(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    webhookRateLimitMax: parseInt(process.env.WEBHOOK_RATE_LIMIT_MAX) || 5,
    
    // CORS
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
    frontendUrl: process.env.FRONTEND_URL,
    
    // Email
    emailService: process.env.EMAIL_SERVICE,
    emailUser: process.env.EMAIL_USER,
    emailPassword: process.env.EMAIL_PASSWORD
  };
};

/**
 * Comprehensive environment validation
 */
const validateEnvironment = () => {
  console.log('🔍 Validating environment configuration...');
  
  try {
    // Validate required variables
    validateRequiredEnvVars();
    console.log('✅ Required environment variables validated');
    
    // Validate security variables
    validateSecurityEnvVars();
    console.log('✅ Security configuration validated');
    
    // Validate webhook variables
    const webhookConfigValid = validateWebhookEnvVars();
    if (webhookConfigValid) {
      console.log('✅ Webhook configuration validated');
    }
    
    // Log environment summary
    const config = getEnvConfig();
    console.log(`📋 Environment: ${config.nodeEnv}`);
    console.log(`🚀 Server will start on port: ${config.port}`);
    console.log(`🔗 Webhook base URL: ${config.webhookBaseUrl || 'Not configured'}`);
    console.log(`🌐 Frontend URL: ${config.frontendUrl || 'Not configured'}`);
    
    return config;
  } catch (error) {
    console.error('❌ Environment validation failed:', error.message);
    process.exit(1);
  }
};

module.exports = {
  validateEnvironment,
  validateRequiredEnvVars,
  validateWebhookEnvVars,
  validateSecurityEnvVars,
  generateEncryptionKey,
  getEnvConfig
};