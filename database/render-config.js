const { Pool } = require('pg');

/**
 * Render-optimized PostgreSQL configuration
 * This configuration is specifically tuned for Render's PostgreSQL service
 */

const createRenderPool = () => {
  // Render PostgreSQL connection with optimized settings
  const config = {
    connectionString: process.env.DATABASE_URL,
    // Render-specific optimizations
    max: 10, // Reduced pool size for free tier
    idleTimeoutMillis: 20000, // Shorter idle timeout
    connectionTimeoutMillis: 10000, // Faster timeout for Render
    // SSL configuration for Render
    ssl: {
      rejectUnauthorized: false,
      // Additional SSL options for Render compatibility
      sslmode: 'require'
    },
    // No custom options - let Render handle all PostgreSQL settings
    // This prevents parameter conflicts with Render's managed PostgreSQL
  };

  const pool = new Pool(config);

  // Enhanced error handling for Render
  pool.on('error', (err) => {
    console.error('PostgreSQL pool error:', err);
    if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
      console.log('Connection reset - this is normal on Render free tier');
    }
  });

  // Connection monitoring for Render
  pool.on('connect', (client) => {
    console.log('New client connected to Render PostgreSQL');
  });

  pool.on('remove', (client) => {
    console.log('Client removed from pool');
  });

  return pool;
};

/**
 * Test connection specifically for Render PostgreSQL
 */
const testRenderConnection = async (pool) => {
  try {
    const client = await pool.connect();
    
    // Test basic connectivity
    const result = await client.query('SELECT NOW(), version()');
    console.log('✅ Render PostgreSQL connected at:', result.rows[0].now);
    console.log('📊 PostgreSQL version:', result.rows[0].version.split(' ').slice(0, 2).join(' '));
    
    // Test current settings
    const settings = await client.query(`
      SELECT 
        current_setting('default_transaction_isolation') as isolation_level,
        current_setting('timezone') as timezone,
        current_database() as database_name
    `);
    console.log('🔧 Database settings:', settings.rows[0]);
    
    client.release();
    return true;
  } catch (err) {
    console.error('❌ Render PostgreSQL connection failed:', err.message);
    
    // Provide specific troubleshooting for common Render issues
    if (err.message.includes('invalid value for parameter')) {
      console.log('💡 This appears to be a parameter configuration issue.');
      console.log('   Try removing custom PostgreSQL options from connection string.');
    }
    
    if (err.code === 'ENOTFOUND') {
      console.log('💡 DNS resolution failed. Check if DATABASE_URL is correct.');
    }
    
    if (err.code === 'ECONNREFUSED') {
      console.log('💡 Connection refused. Database might be starting up on Render.');
    }
    
    throw err;
  }
};

module.exports = {
  createRenderPool,
  testRenderConnection
};