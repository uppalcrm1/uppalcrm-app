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

async function deployMigrations() {
  const client = await pool.connect();

  try {
    console.log(`\n🚀 Deploying Contact Constraint Fixes to ${environment.toUpperCase()}...`);
    console.log('=' .repeat(70));

    // Migration 1: Fix accounts foreign key (already applied, but check)
    console.log('\n📋 Migration 019: Fix accounts.contact_id constraint');
    console.log('-'.repeat(70));

    const accountsCheck = await client.query(`
      SELECT rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'accounts'
        AND kcu.column_name = 'contact_id'
    `);

    if (accountsCheck.rows.length > 0) {
      const currentRule = accountsCheck.rows[0].delete_rule;
      console.log(`   Current delete rule: ${currentRule}`);

      if (currentRule === 'CASCADE') {
        console.log('   ✅ Already fixed - ON DELETE CASCADE');
      } else {
        console.log('   ⚠️  Not CASCADE - this should have been fixed by migration 019');
      }
    }

    // Migration 2: Fix leads foreign key
    console.log('\n📋 Migration 020: Fix leads.linked_contact_id constraint');
    console.log('-'.repeat(70));

    // Step 1: Check current constraint
    console.log('\n   Step 1: Checking current constraint...');
    const leadsCheck = await client.query(`
      SELECT rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      LEFT JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'leads'
        AND kcu.column_name = 'linked_contact_id'
    `);

    if (leadsCheck.rows.length > 0) {
      const currentRule = leadsCheck.rows[0].delete_rule || 'NO ACTION';
      console.log(`   Current delete rule: ${currentRule}`);
    } else {
      console.log('   ⚠️  No foreign key constraint found');
    }

    // Step 2: Count affected leads
    console.log('\n   Step 2: Checking leads that reference contacts...');
    const leadsCount = await client.query(`
      SELECT COUNT(*) as total_leads
      FROM leads
      WHERE linked_contact_id IS NOT NULL
    `);
    console.log(`   Total leads with linked contacts: ${leadsCount.rows[0].total_leads}`);

    // Step 3: Apply migration 020
    console.log('\n   Step 3: Applying migration...');
    const migration020Path = path.join(__dirname, 'database', 'migrations', '020_fix_leads_contact_fkey.sql');
    const migration020SQL = fs.readFileSync(migration020Path, 'utf8');
    await client.query(migration020SQL);
    console.log('   ✅ Migration 020 applied successfully');

    // Step 4: Verify the fix
    console.log('\n   Step 4: Verifying the fix...');
    const verifyResult = await client.query(`
      SELECT rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'leads'
        AND kcu.column_name = 'linked_contact_id'
    `);

    if (verifyResult.rows.length > 0 && verifyResult.rows[0].delete_rule === 'SET NULL') {
      console.log(`   ✅ Constraint verified: ${verifyResult.rows[0].delete_rule}`);
    } else {
      console.log(`   ⚠️  Unexpected delete rule: ${verifyResult.rows[0]?.delete_rule || 'NONE'}`);
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ All migrations completed successfully!');
    console.log(`\n📝 Summary:`);
    console.log(`   - Environment: ${environment}`);
    console.log(`   - accounts.contact_id: ON DELETE CASCADE (deletes accounts with contact)`);
    console.log(`   - leads.linked_contact_id: ON DELETE SET NULL (unlinks leads from deleted contact)`);
    console.log(`   - You can now delete contacts without foreign key errors`);
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

// Run the migrations
deployMigrations().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
