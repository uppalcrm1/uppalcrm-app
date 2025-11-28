#!/usr/bin/env node

/**
 * Migration Script for Staging Environment
 * Run this directly on Render to add source column to transactions table
 *
 * Usage on Render:
 * 1. Go to Render Dashboard > Your Backend Service > Shell
 * 2. Run: node migrate-staging.js
 */

const { Pool } = require('pg');
const fs = require('fs');

// Use DATABASE_URL from environment (Render sets this automatically)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🚀 Starting migration on staging database...');
    console.log('Database:', process.env.DATABASE_URL ? process.env.DATABASE_URL.split('@')[1]?.split('?')[0] : 'unknown');
    console.log('');

    // First, check if source column already exists
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      AND column_name = 'source'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Source column already exists! No migration needed.');
      await pool.end();
      return;
    }

    console.log('📋 Source column not found. Adding it now...');

    // Read and run the migration file
    const migrationSQL = fs.readFileSync('database/migrations/018_add_source_to_transactions.sql', 'utf8');

    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  - Added source column (VARCHAR(50)) to transactions table');
    console.log('  - Added index idx_transactions_source for performance');
    console.log('  - Set default value "website" for existing records');
    console.log('');
    console.log('🎉 Staging database is now ready!');
    console.log('The Transactions page should now work correctly.');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Full error:', error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
