const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Database configuration
const dbConfig = process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
};

const pool = new Pool(dbConfig);

async function applyLeadEnhancement() {
  try {
    console.log('🚀 Applying lead activity enhancement schema...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'backend', 'database', 'lead_activity_enhancement.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 Executing lead enhancement schema...');

    // Execute the schema
    await pool.query(schemaSql);

    console.log('✅ Lead activity enhancement schema applied successfully!');

    // Test that tables were created
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'lead_change_history', 'lead_followers', 'lead_duplicates', 'lead_status_history'
      )
      ORDER BY table_name;
    `);

    console.log('📋 Created/enhanced tables:', tablesResult.rows.map(row => row.table_name));

    // Check if triggers were created
    const triggersResult = await pool.query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name LIKE '%lead%'
      ORDER BY trigger_name;
    `);

    console.log('🔧 Active triggers:', triggersResult.rows.map(row => `${row.trigger_name} on ${row.event_object_table}`));

  } catch (error) {
    console.error('❌ Error applying schema:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some objects already exist, which is expected');
    } else {
      console.error(error.stack);
    }
  } finally {
    await pool.end();
  }
}

applyLeadEnhancement();