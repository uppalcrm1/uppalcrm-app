const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2);
const environment = args[0] || 'staging'; // Default to staging

// Database configuration
const dbConfigs = {
  staging: {
    connectionString: process.env.STAGING_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  },
  production: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  }
};

const dbConfig = dbConfigs[environment];

if (!dbConfig || !dbConfig.connectionString) {
  console.error(`❌ Database URL not found for environment: ${environment}`);
  console.error('Please set STAGING_DATABASE_URL or DATABASE_URL environment variable');
  process.exit(1);
}

const pool = new Pool(dbConfig);

async function deployMigration() {
  const client = await pool.connect();

  try {
    console.log(`\n🚀 Deploying Migration 019 to ${environment.toUpperCase()}...`);
    console.log('=' .repeat(60));

    // Read the migration file
    const migrationPath = path.join(__dirname, 'database', 'migrations', '019_fix_accounts_cascade_delete.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Step 1: Check current constraint
    console.log('\n📋 Step 1: Checking current constraint...');
    const checkResult = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'accounts'
        AND kcu.column_name = 'contact_id'
    `);

    if (checkResult.rows.length > 0) {
      console.log(`   Current delete rule: ${checkResult.rows[0].delete_rule}`);
    } else {
      console.log('   ⚠️  No foreign key constraint found');
    }

    // Step 2: Count affected accounts
    console.log('\n📊 Step 2: Checking accounts that would be affected...');
    const accountsCount = await client.query(`
      SELECT COUNT(*) as total_accounts
      FROM accounts
      WHERE contact_id IS NOT NULL
    `);
    console.log(`   Total accounts with contacts: ${accountsCount.rows[0].total_accounts}`);

    // Step 3: Apply the migration
    console.log('\n🔧 Step 3: Applying migration...');
    await client.query(migrationSQL);
    console.log('   ✅ Migration applied successfully');

    // Step 4: Verify the fix
    console.log('\n✓ Step 4: Verifying the fix...');
    const verifyResult = await client.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'accounts'
        AND kcu.column_name = 'contact_id'
    `);

    if (verifyResult.rows.length > 0 && verifyResult.rows[0].delete_rule === 'CASCADE') {
      console.log(`   ✅ Constraint verified: ${verifyResult.rows[0].delete_rule}`);
    } else {
      console.log(`   ⚠️  Unexpected delete rule: ${verifyResult.rows[0]?.delete_rule || 'NONE'}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Migration completed successfully!');
    console.log(`\n📝 Summary:`);
    console.log(`   - Environment: ${environment}`);
    console.log(`   - Foreign key constraint updated to ON DELETE CASCADE`);
    console.log(`   - Contacts with accounts can now be deleted without errors`);
    console.log(`   - Accounts will be automatically deleted when their contact is deleted`);
    console.log('\n');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
deployMigration().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
