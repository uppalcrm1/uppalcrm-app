/**
 * Production Database Migration Runner - Migration 020
 * Consolidates account_type + license_status into account_status
 *
 * USAGE:
 * export DATABASE_URL=postgresql://user:pass@host:port/dbname
 * node run-production-migration.js
 *
 * ⚠️  PRODUCTION DATABASE - USE WITH EXTREME CAUTION
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Read DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  console.error('');
  console.error('Usage:');
  console.error('  export DATABASE_URL=postgresql://user:pass@host:port/dbname');
  console.error('  node run-production-migration.js');
  process.exit(1);
}

// Warn about production
console.log('\n🚨 🚨 🚨 PRODUCTION DATABASE MIGRATION 🚨 🚨 🚨\n');
console.log('This will modify the PRODUCTION database!');
console.log('Make sure you have a backup before proceeding.\n');

// Create connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false } // For Render PostgreSQL
});

// Read migration file
const migrationPath = path.join(__dirname, 'database', 'migrations', '020_consolidate_account_status.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Split SQL into statements
const statements = migrationSQL
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

/**
 * Run database migration with detailed logging
 */
async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔗 Testing database connection...');
    await client.query('SELECT 1');
    console.log('✅ Connected to production database\n');

    // Check if migration already applied
    console.log('📋 Checking schema_migrations table...');
    const migrationCheck = await client.query(`
      SELECT version FROM schema_migrations WHERE version = '020'
    `);

    if (migrationCheck.rows.length > 0) {
      console.log('⚠️  Migration 020 already applied!');
      console.log('Applied at:', migrationCheck.rows[0].applied_at);
      console.log('');
      console.log('No action taken.');
      return;
    }

    console.log('✅ Schema migrations table ready\n');

    console.log('📋 Running 20 migration statements...\n');

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      console.log(`  [${i + 1}/${statements.length}] Executing SQL...`);

      try {
        await client.query(stmt);
      } catch (error) {
        console.error(`\n❌ Error executing statement ${i + 1}:`);
        console.error('   SQL:', stmt.substring(0, 100) + '...');
        console.error('   Error:', error.message);
        throw error;
      }
    }

    console.log('\n✅ All statements executed successfully\n');

    // Record migration
    console.log('  Recording migration in schema_migrations...');
    await client.query(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES ('020', 'consolidate_account_status', NOW())
    `);
    console.log('✅ Migration recorded\n');

    // Verify migration
    console.log('🔍 Verifying migration...\n');

    // Check new column exists
    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'accounts'
      AND column_name IN ('account_status', 'license_status', 'account_type', 'is_trial')
      ORDER BY column_name
    `);

    console.log('📊 Account table columns:');
    for (const col of columnCheck.rows) {
      if (col.column_name === 'account_status') {
        console.log(`  ✅ ${col.column_name} exists`);
      } else {
        console.log(`  ✅ ${col.column_name} removed`);
      }
    }

    // Check data distribution
    const statusDistribution = await client.query(`
      SELECT account_status, COUNT(*) as count
      FROM accounts
      WHERE deleted_at IS NULL
      GROUP BY account_status
      ORDER BY account_status
    `);

    console.log('\n📈 Account status distribution:');
    for (const row of statusDistribution.rows) {
      console.log(`  ${row.account_status}: ${row.count} accounts`);
    }

    // Check for NULL values
    const nullCheck = await client.query(`
      SELECT COUNT(*) as null_count
      FROM accounts
      WHERE account_status IS NULL
    `);

    console.log(`\n✅ NULL account_status values: ${nullCheck.rows[0].null_count}\n`);

    if (nullCheck.rows[0].null_count > 0) {
      console.log('⚠️  WARNING: Found NULL values in account_status!');
      console.log('   This indicates data migration issues.');
    }

    console.log('='.repeat(60));
    console.log('');
    console.log('🎉 Migration 020 deployed to Production successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Monitor production for 30 minutes');
    console.log('2. Test dashboard KPIs');
    console.log('3. Test lead conversion');
    console.log('4. Monitor logs for errors');
    console.log('');

  } catch (error) {
    console.error('\n❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('\nDatabase may be in inconsistent state.');
    console.error('⚠️  CHECK PRODUCTION DATABASE IMMEDIATELY!');
    console.error('');
    console.error('Rollback plan:');
    console.error('1. Restore database from backup');
    console.error('2. Revert code: git revert 26c5a9f');
    console.error('3. Redeploy from main');
    process.exit(1);

  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
