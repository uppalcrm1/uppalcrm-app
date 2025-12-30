require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use staging database URL if available, otherwise use default
const pool = new Pool({
  connectionString: process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Transaction Alignment - Staging Deployment');
    console.log('================================================\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/019_enforce_account_required_in_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded: 019_enforce_account_required_in_transactions.sql\n');

    // Check for orphaned transactions first
    console.log('🔍 Checking for orphaned transactions...');
    const orphanedCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM transactions
      WHERE account_id IS NULL OR contact_id IS NULL;
    `);

    const orphanedCount = parseInt(orphanedCheck.rows[0].count);
    if (orphanedCount > 0) {
      console.log(`⚠️  Found ${orphanedCount} orphaned transaction(s) (will be deleted)`);
    } else {
      console.log('✅ No orphaned transactions found');
    }

    // Execute migration
    console.log('\n🔄 Running migration...');
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!\n');

    // Verify migration
    console.log('🔍 Verifying migration...');
    const verification = await client.query(`
      SELECT
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      AND column_name IN ('account_id', 'contact_id')
      ORDER BY column_name;
    `);

    console.log('\n📊 Verification Results:');
    verification.rows.forEach(row => {
      const status = row.is_nullable === 'NO' ? '✅ NOT NULL (REQUIRED)' : '❌ NULL (OPTIONAL)';
      console.log(`  ${row.column_name}: ${status}`);
    });

    // Check foreign key constraints
    console.log('\n🔗 Checking foreign key constraints...');
    const fkCheck = await client.query(`
      SELECT
        conname as constraint_name,
        confdeltype as delete_action
      FROM pg_constraint
      WHERE conname LIKE 'transactions_%_fkey'
      AND conrelid = 'transactions'::regclass;
    `);

    fkCheck.rows.forEach(row => {
      const action = row.delete_action === 'c' ? 'CASCADE' : 'SET NULL';
      console.log(`  ${row.constraint_name}: ON DELETE ${action}`);
    });

    // Count total transactions
    const countCheck = await client.query(`
      SELECT COUNT(*) as total FROM transactions;
    `);
    console.log(`\n📊 Total transactions: ${countCheck.rows[0].total}`);

    console.log('\n================================================');
    console.log('✅ DEPLOYMENT SUCCESSFUL!');
    console.log('================================================\n');

    console.log('📝 Next Steps:');
    console.log('  1. Render will auto-deploy from main branch');
    console.log('  2. Monitor deployment at https://dashboard.render.com');
    console.log('  3. Run manual tests (see checklist in deployment script)');
    console.log('  4. Verify transactions can only be created with accounts\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('\n📋 Error Details:', error);

    console.error('\n🔧 Troubleshooting:');
    console.error('  1. Check database connection credentials');
    console.error('  2. Verify you have permissions to ALTER TABLE');
    console.error('  3. Check if any transactions have NULL account_id');
    console.error('  4. Review the SQL file for syntax errors\n');

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

console.log('\n🎯 Starting deployment...\n');
runMigration()
  .then(() => {
    console.log('✨ Deployment completed successfully!');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Deployment failed!');
    process.exit(1);
  });
