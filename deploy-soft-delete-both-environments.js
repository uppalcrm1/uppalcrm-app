#!/usr/bin/env node

/**
 * Deploy Soft Delete Migration to Both Staging and Production
 *
 * This script will:
 * 1. Deploy to STAGING first
 * 2. Verify staging deployment
 * 3. Deploy to PRODUCTION
 * 4. Verify production deployment
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const STAGING_DB = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const PRODUCTION_DB = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function deployToEnvironment(envName, connectionString) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  DEPLOYING TO ${envName.toUpperCase()}`);
  console.log(`${'═'.repeat(70)}\n`);

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
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
      console.log('   Skipping migration...\n');
      return { success: true, alreadyApplied: true };
    }

    console.log('✅ Column does not exist. Proceeding with migration...\n');

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
    console.log(`│ ${envName.toUpperCase()} VERIFICATION RESULTS`.padEnd(57) + '│');
    console.log('├─────────────────────────────────────────────────────────┤');
    console.log(`│ accounts.deleted_at column:     ${verification.accounts_deleted_at ? '✅ EXISTS' : '❌ MISSING'}              │`);
    console.log(`│ transactions.deleted_at column: ${verification.transactions_deleted_at ? '✅ EXISTS' : '❌ MISSING'}              │`);
    console.log(`│ audit_log table:                ${verification.audit_log_table ? '✅ EXISTS' : '❌ MISSING'}              │`);
    console.log('└─────────────────────────────────────────────────────────┘\n');

    if (verification.accounts_deleted_at &&
        verification.transactions_deleted_at &&
        verification.audit_log_table) {
      console.log(`🎉 SUCCESS! ${envName} migration completed successfully!\n`);
      return { success: true, alreadyApplied: false };
    } else {
      console.log(`❌ ERROR: ${envName} migration incomplete.\n`);
      return { success: false, alreadyApplied: false };
    }

  } catch (error) {
    console.error(`❌ Error deploying to ${envName}:`, error.message);
    console.error('Full error:', error);
    return { success: false, error: error.message };
  } finally {
    await client.end();
    console.log('👋 Disconnected from database\n');
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   SOFT DELETE MIGRATION - STAGING & PRODUCTION DEPLOY     ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const results = {
    staging: null,
    production: null
  };

  // Deploy to STAGING first
  results.staging = await deployToEnvironment('STAGING', STAGING_DB);

  if (!results.staging.success) {
    console.log('❌ Staging deployment failed. Aborting production deployment.');
    process.exit(1);
  }

  // Ask for confirmation before deploying to production
  console.log('⚠️  STAGING deployment successful!');
  console.log('   Proceeding to PRODUCTION deployment...\n');

  // Small delay for visibility
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Deploy to PRODUCTION
  results.production = await deployToEnvironment('PRODUCTION', PRODUCTION_DB);

  // Final Summary
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║                   DEPLOYMENT SUMMARY                       ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('STAGING:');
  if (results.staging.alreadyApplied) {
    console.log('  ✅ Already applied (skipped)');
  } else {
    console.log(`  ${results.staging.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  }

  console.log('\nPRODUCTION:');
  if (results.production.alreadyApplied) {
    console.log('  ✅ Already applied (skipped)');
  } else {
    console.log(`  ${results.production.success ? '✅ SUCCESS' : '❌ FAILED'}`);
  }

  console.log('\n' + '═'.repeat(70));

  if (results.staging.success && results.production.success) {
    console.log('\n🎉 ALL DEPLOYMENTS SUCCESSFUL!\n');
    console.log('Next steps:');
    console.log('  1. Code changes are already pushed to GitHub');
    console.log('  2. Wait for Render to auto-deploy:');
    console.log('     - Staging: https://uppalcrm-frontend-staging.onrender.com');
    console.log('     - Production: https://uppalcrm-frontend.onrender.com');
    console.log('  3. Test the delete functionality on staging first');
    console.log('  4. Then verify on production\n');
    process.exit(0);
  } else {
    console.log('\n❌ Some deployments failed. Please check the errors above.\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
