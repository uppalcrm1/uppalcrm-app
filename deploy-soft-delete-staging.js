/**
 * Deploy Soft Delete Migration to Staging
 * Runs migration 018 to add deleted_at and is_void columns
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment
require('dotenv').config();

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  options: '-c timezone=UTC'
};

const pool = new Pool(dbConfig);

async function deploy() {
  console.log('\n=== DEPLOYING SOFT DELETE MIGRATION TO STAGING ===\n');

  try {
    // Test connection
    console.log('1. Testing database connection...');
    const connTest = await pool.query('SELECT NOW() as time, current_database() as db');
    console.log('✓ Connected to:', connTest.rows[0].db);
    console.log('  Server time:', connTest.rows[0].time);

    // Check if migration is needed
    console.log('\n2. Checking current schema...');
    const colCheck = await pool.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'deleted_at'
        ) as has_deleted_at,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'is_void'
        ) as has_is_void
    `);

    const { has_deleted_at, has_is_void } = colCheck.rows[0];

    if (has_deleted_at && has_is_void) {
      console.log('✓ Soft delete columns already exist - no migration needed');
      console.log('  transactions.deleted_at: EXISTS');
      console.log('  transactions.is_void: EXISTS');
      console.log('\n=== DEPLOYMENT COMPLETE (NO CHANGES NEEDED) ===\n');
      return;
    }

    console.log('⚠ Soft delete columns missing:');
    console.log('  transactions.deleted_at:', has_deleted_at ? 'EXISTS' : 'MISSING');
    console.log('  transactions.is_void:', has_is_void ? 'EXISTS' : 'MISSING');

    // Read migration file
    console.log('\n3. Reading migration file...');
    const migrationPath = path.join(__dirname, 'database', 'migrations', '018_add_soft_delete_columns.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✓ Migration file loaded');
    console.log(`  Size: ${migrationSQL.length} bytes`);

    // Run migration
    console.log('\n4. Running migration...');
    await pool.query(migrationSQL);
    console.log('✓ Migration executed successfully');

    // Verify migration
    console.log('\n5. Verifying migration...');
    const verifyCheck = await pool.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'accounts' AND column_name = 'deleted_at'
        ) as accounts_deleted_at,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'deleted_at'
        ) as transactions_deleted_at,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'is_void'
        ) as transactions_is_void,
        EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'audit_log'
        ) as audit_log_exists
    `);

    const verify = verifyCheck.rows[0];
    console.log('Migration verification:');
    console.log('  accounts.deleted_at:', verify.accounts_deleted_at ? '✓ EXISTS' : '✗ MISSING');
    console.log('  transactions.deleted_at:', verify.transactions_deleted_at ? '✓ EXISTS' : '✗ MISSING');
    console.log('  transactions.is_void:', verify.transactions_is_void ? '✓ EXISTS' : '✗ MISSING');
    console.log('  audit_log table:', verify.audit_log_exists ? '✓ EXISTS' : '✗ MISSING');

    if (!verify.transactions_deleted_at || !verify.transactions_is_void) {
      throw new Error('Migration verification failed - columns not created');
    }

    // Test a reporting query
    console.log('\n6. Testing reporting query...');
    const testQuery = await pool.query(`
      SELECT COUNT(*) as total_transactions
      FROM transactions
      WHERE deleted_at IS NULL
        AND is_void = FALSE
    `);
    console.log('✓ Reporting query successful');
    console.log(`  Active transactions: ${testQuery.rows[0].total_transactions}`);

    console.log('\n=== DEPLOYMENT SUCCESSFUL ===\n');
    console.log('The staging database now has soft delete support.');
    console.log('The reporting endpoints should now work correctly.');
    console.log('\nNext step: Test the reporting API at:');
    console.log('https://uppalcrm-api-staging.onrender.com/api/reporting/dashboard/kpis');
    console.log('\n');

  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED');
    console.error('Error:', error.message);
    if (error.code) {
      console.error('SQL Error Code:', error.code);
    }
    if (error.detail) {
      console.error('Detail:', error.detail);
    }
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

deploy().catch(console.error);
