#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// This script creates the lead tracking tables in the production database
console.log('🚀 Creating lead tracking tables...');

// Use environment DATABASE_URL if available, otherwise use local connection
const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function applyMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Reading SQL migration file...');

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '..', 'database', 'create-lead-history-tables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🔧 Applying migration...');

    // Execute the migration
    await client.query(sql);

    console.log('✅ Migration applied successfully!');
    console.log('   - lead_change_history table created');
    console.log('   - lead_status_history table created');
    console.log('   - Indexes created');
    console.log('   - Trigger function updated');
    console.log('   - Trigger created');

    // Verify tables were created
    const verifyQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('lead_change_history', 'lead_status_history')
      ORDER BY table_name;
    `;

    const result = await client.query(verifyQuery);
    console.log('\n✅ Verification - Tables created:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n🎉 Lead tracking tables are now ready!');
    console.log('   You can now convert leads without errors.');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
applyMigration().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
