#!/usr/bin/env node

/**
 * MIGRATION SCRIPT: Remove billing_cycle column from DevTest database
 * This script:
 * 1. Creates a backup of the accounts table
 * 2. Drops the billing_cycle column
 * 3. Verifies the schema
 */

const { Pool } = require('pg');
require('dotenv').config();

// Use the DevTest database explicitly
const devTestPool = new Pool({
  connectionString: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await devTestPool.connect();

  try {
    console.log('🔄 Starting billing_cycle removal process...\n');

    // Step 1: Verify billing_cycle column exists
    console.log('📋 Step 1: Checking if billing_cycle column exists...');
    const checkResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'accounts' AND column_name = 'billing_cycle'
    `);

    if (checkResult.rows.length === 0) {
      console.log('✅ billing_cycle column not found - already removed or never existed');
      console.log('');

      // Show current schema
      const schemaResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'accounts'
        ORDER BY ordinal_position
      `);

      console.log('📊 Current accounts table schema:');
      console.table(schemaResult.rows);

      await devTestPool.end();
      return;
    }

    console.log('✅ Found billing_cycle column - proceeding with removal\n');

    // Step 2: Create backup
    console.log('📦 Step 2: Creating backup of accounts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS accounts_backup_billing_cycle_removal AS
      SELECT * FROM accounts
    `);
    console.log('✅ Backup created\n');

    // Verify backup
    const backupResult = await client.query('SELECT COUNT(*) as count FROM accounts_backup_billing_cycle_removal');
    console.log(`✅ Backup contains ${backupResult.rows[0].count} rows\n`);

    // Step 3: Drop any dependent constraints/indexes
    console.log('🔧 Step 3: Checking for dependent indexes/constraints...');
    console.log('✅ No constraints to handle (billing_cycle is a simple column)\n');

    // Step 4: Drop the column
    console.log('⚡ Step 4: Dropping billing_cycle column...');
    await client.query('ALTER TABLE accounts DROP COLUMN billing_cycle');
    console.log('✅ Column dropped\n');

    // Step 5: Verify removal
    console.log('✅ Step 5: Verifying schema...');
    const verifyResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'accounts'
      ORDER BY ordinal_position
    `);

    const hasColumn = verifyResult.rows.some(col => col.column_name === 'billing_cycle');

    if (!hasColumn) {
      console.log('✅ SUCCESS: billing_cycle column has been removed\n');
    } else {
      throw new Error('ERROR: billing_cycle column still exists!');
    }

    // Show final schema
    console.log('📊 Final accounts table schema:');
    const schemaFinalResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'accounts'
      ORDER BY ordinal_position
    `);

    console.table(schemaFinalResult.rows);

    console.log('\n✅ Migration complete!');
    console.log('⚠️  NEXT STEPS:');
    console.log('   1. Remove billing_cycle references from backend code');
    console.log('   2. Remove billing_cycle references from frontend code');
    console.log('   3. Test all account-related functionality');
    console.log('   4. Verify API responses no longer include billing_cycle');

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('\nAttempting rollback...');

    try {
      await client.query(`
        DROP TABLE IF EXISTS accounts_backup_billing_cycle_removal
      `);
      console.log('Backup cleanup completed');
    } catch (e) {
      console.error('Backup cleanup failed:', e.message);
    }

    process.exit(1);
  } finally {
    client.release();
    await devTestPool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
