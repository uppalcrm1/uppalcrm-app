#!/usr/bin/env node

/**
 * Deploy Soft Delete Migration to Production
 *
 * This script will:
 * 1. Connect to the database
 * 2. Run the soft delete migration (018)
 * 3. Verify the migration completed successfully
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function deployMigration() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       SOFT DELETE MIGRATION DEPLOYMENT                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('render.com')
      ? { rejectUnauthorized: false }
      : false
  });

  try {
    console.log('📡 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database\n');

    // Step 1: Check if migration already applied
    console.log('🔍 Checking if deleted_at column already exists...');
    const checkResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'accounts' AND column_name = 'deleted_at'
      ) as column_exists
    `);

    if (checkResult.rows[0].column_exists) {
      console.log('⚠️  Migration already applied! The deleted_at column already exists.');
      console.log('   Skipping migration to prevent errors.\n');
      return;
    }

    console.log('✅ Column does not exist yet. Proceeding with migration...\n');

    // Step 2: Read migration file
    console.log('📖 Reading migration file...');
    const migrationPath = path.join(__dirname, 'database', 'migrations', '018_add_soft_delete_columns.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded\n');

    // Step 3: Run migration
    console.log('⚙️  Running migration...');
    console.log('   This may take a few moments...\n');

    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Step 4: Verify migration
    console.log('🔍 Verifying migration...\n');

    const verifyResult = await client.query(`
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
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'audit_log'
        ) as audit_log_table
    `);

    const verification = verifyResult.rows[0];

    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│ VERIFICATION RESULTS                                    │');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ accounts.deleted_at column:     ${verification.accounts_deleted_at ? '✅ EXISTS' : '❌ MISSING'} │`);
    console.log(`│ transactions.deleted_at column: ${verification.transactions_deleted_at ? '✅ EXISTS' : '❌ MISSING'} │`);
    console.log(`│ audit_log table:                ${verification.audit_log_table ? '✅ EXISTS' : '❌ MISSING'} │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    if (verification.accounts_deleted_at &&
        verification.transactions_deleted_at &&
        verification.audit_log_table) {
      console.log('🎉 SUCCESS! Soft delete migration completed successfully!\n');
      console.log('Next steps:');
      console.log('  1. Test the delete functionality in your application');
      console.log('  2. Try deleting an account from the Accounts page');
      console.log('  3. Verify the account is marked as deleted (not permanently removed)\n');
    } else {
      console.log('❌ ERROR: Migration incomplete. Some components are missing.\n');
      console.log('Please check the database logs for errors.');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('👋 Disconnected from database\n');
  }
}

// Run the deployment
deployMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
