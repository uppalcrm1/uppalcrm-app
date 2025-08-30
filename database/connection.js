const { Pool } = require('pg');
require('dotenv').config();

// Database connection configuration
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections in pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 15000, // Increase timeout for cloud connections
  ssl: { rejectUnauthorized: false }, // Required for Supabase and other cloud providers
  // Force IPv4 for better compatibility
  options: '-c default_transaction_isolation=read_committed'
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  ssl: false
};

// Create connection pool
const pool = new Pool(dbConfig);

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('Database connected successfully at:', result.rows[0].now);
    client.release();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }
};

/**
 * Execute query with tenant isolation
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @param {string} organizationId - Organization ID for tenant isolation
 * @returns {Object} Query result
 */
const query = async (text, params = [], organizationId = null) => {
  const client = await pool.connect();
  
  try {
    // Set organization context for RLS if provided
    if (organizationId) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_organization_id',
        organizationId
      ]);
    }
    
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

/**
 * Execute transaction with tenant isolation
 * @param {Function} callback - Function to execute within transaction
 * @param {string} organizationId - Organization ID for tenant isolation
 * @returns {*} Result from callback
 */
const transaction = async (callback, organizationId = null) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Set organization context for RLS if provided
    if (organizationId) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_organization_id',
        organizationId
      ]);
    }
    
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get a client with organization context set
 * @param {string} organizationId - Organization ID for tenant isolation
 * @returns {Object} Database client with context
 */
const getClientWithContext = async (organizationId) => {
  const client = await pool.connect();
  
  if (organizationId) {
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_organization_id',
      organizationId
    ]);
  }
  
  return client;
};

/**
 * Execute multiple queries in sequence with tenant isolation
 * @param {Array} queries - Array of {text, params} objects
 * @param {string} organizationId - Organization ID for tenant isolation
 * @returns {Array} Array of query results
 */
const multiQuery = async (queries, organizationId = null) => {
  const client = await pool.connect();
  
  try {
    // Set organization context for RLS if provided
    if (organizationId) {
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_organization_id',
        organizationId
      ]);
    }
    
    const results = [];
    for (const { text, params = [] } of queries) {
      const result = await client.query(text, params);
      results.push(result);
    }
    
    return results;
  } finally {
    client.release();
  }
};

/**
 * Gracefully close all connections
 */
const closePool = async () => {
  try {
    await pool.end();
    console.log('Database connections closed');
  } catch (err) {
    console.error('Error closing database connections:', err);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', closePool);
process.on('SIGINT', closePool);

module.exports = {
  query,
  transaction,
  getClientWithContext,
  multiQuery,
  testConnection,
  closePool,
  pool
};