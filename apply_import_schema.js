const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Use the same database configuration as the main app
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') ? { rejectUnauthorized: false } : false,
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
};

const pool = new Pool(dbConfig);

async function applySchema() {
  try {
    console.log('Connecting to database...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'backend', 'database', 'import_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Applying import schema...');

    // Execute the schema
    await pool.query(schemaSql);

    console.log('✅ Import schema applied successfully!');

    // Test that tables were created
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('import_jobs', 'import_errors', 'import_field_mappings')
      ORDER BY table_name;
    `);

    console.log('📋 Created tables:', tablesResult.rows.map(row => row.table_name));

  } catch (error) {
    console.error('❌ Error applying schema:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

applySchema();