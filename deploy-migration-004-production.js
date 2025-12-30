/**
 * Deploy Migration 004 to Production
 * Renames completed_by to last_modified_by in lead_interactions table
 *
 * This migration was already run on staging and is working correctly.
 * Now deploying to production to fix task completion errors.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const PRODUCTION_DB = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function runMigration() {
  const client = new Client({
    connectionString: PRODUCTION_DB,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 DEPLOYING MIGRATION 004 TO PRODUCTION');
    console.log('='.repeat(70));
    console.log('\n📋 Migration: Rename completed_by → last_modified_by');
    console.log('📦 Environment: PRODUCTION');
    console.log('🗄️  Database: uppalcrm_database\n');

    await client.connect();
    console.log('✅ Connected to production database\n');

    // Check current state BEFORE migration
    console.log('🔍 Checking current state...');
    const beforeCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'lead_interactions'
      AND column_name IN ('completed_by', 'last_modified_by')
      ORDER BY column_name
    `);

    console.log('Current columns:');
    beforeCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });

    if (beforeCheck.rows.some(r => r.column_name === 'last_modified_by')) {
      console.log('\n⚠️  WARNING: last_modified_by already exists!');
      console.log('Migration may have already been run. Continuing anyway for safety...\n');
    }

    // Read and execute migration
    const migrationPath = path.join(__dirname, 'database', 'migrations', '004-rename-completed-by-to-last-modified-by.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Executing migration SQL...\n');
    console.log('-'.repeat(70));

    // Set up notice listener to capture RAISE NOTICE messages
    client.on('notice', (msg) => {
      if (msg.message) {
        console.log('   📝', msg.message);
      }
    });

    // Execute the migration
    await client.query(migrationSQL);

    console.log('-'.repeat(70));
    console.log('\n✅ Migration SQL executed successfully!\n');

    // Verify the migration
    console.log('🔍 Verifying migration results...\n');

    const afterCheck = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'lead_interactions'
      AND column_name IN ('completed_by', 'last_modified_by')
      ORDER BY column_name
    `);

    console.log('Columns after migration:');
    afterCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check results
    const hasCompletedBy = afterCheck.rows.some(r => r.column_name === 'completed_by');
    const hasLastModifiedBy = afterCheck.rows.some(r => r.column_name === 'last_modified_by');

    console.log('\n📊 Migration Result:');
    if (!hasCompletedBy && hasLastModifiedBy) {
      console.log('   ✅ SUCCESS: Column renamed to last_modified_by');
    } else if (hasCompletedBy && !hasLastModifiedBy) {
      console.log('   ❌ FAILED: Column still named completed_by');
      process.exit(1);
    } else if (hasCompletedBy && hasLastModifiedBy) {
      console.log('   ⚠️  WARNING: Both columns exist (unexpected)');
    } else {
      console.log('   ❌ ERROR: Neither column found!');
      process.exit(1);
    }

    // Check index
    const indexCheck = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'lead_interactions'
      AND (indexname LIKE '%completed_by%' OR indexname LIKE '%modified_by%')
    `);

    console.log('\n📇 Indexes:');
    indexCheck.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    console.log('\n' + '='.repeat(70));
    console.log('✅ MIGRATION 004 DEPLOYED SUCCESSFULLY TO PRODUCTION!');
    console.log('='.repeat(70));
    console.log('\n💡 Next steps:');
    console.log('   1. Test task completion in production');
    console.log('   2. Verify no errors in application logs');
    console.log('   3. Monitor for any issues\n');

  } catch (error) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ ERROR DEPLOYING MIGRATION');
    console.error('='.repeat(70));
    console.error('\nError message:', error.message);
    console.error('\nFull error:');
    console.error(error);
    console.error('\n⚠️  MIGRATION FAILED - Database unchanged\n');
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed\n');
  }
}

runMigration();
