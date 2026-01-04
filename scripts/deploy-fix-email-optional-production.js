const { Pool } = require('pg');
require('dotenv').config();

/**
 * Deploy fix to production: Make email optional for contacts
 */
async function deployFix() {
  // Use production DATABASE_URL from environment
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('🚀 Deploying email optional fix to PRODUCTION...\n');
    console.log('Database:', process.env.DATABASE_URL ? 'Connected to production DB' : 'ERROR: No DATABASE_URL found');

    await client.query('BEGIN');

    // Step 1: Drop old UNIQUE constraint
    console.log('Step 1: Dropping old UNIQUE constraint (contacts_organization_id_email_key)...');
    await client.query(`
      ALTER TABLE contacts
      DROP CONSTRAINT IF EXISTS contacts_organization_id_email_key
    `);
    console.log('✓ Constraint dropped (if it existed)');

    // Step 2: Drop old UNIQUE constraint with "1" suffix
    console.log('Step 2: Dropping old UNIQUE constraint (contacts_organization_id_email_key1)...');
    await client.query(`
      ALTER TABLE contacts
      DROP CONSTRAINT IF EXISTS contacts_organization_id_email_key1
    `);
    console.log('✓ Constraint dropped (if it existed)');

    // Step 3: Drop constraint on backup table first (if it exists)
    console.log('Step 3: Dropping constraint on backup table...');
    await client.query(`
      ALTER TABLE contacts_broken_backup
      DROP CONSTRAINT IF EXISTS contacts_organization_id_email_key
    `);
    await client.query(`
      ALTER TABLE contacts_broken_backup
      DROP CONSTRAINT IF EXISTS contacts_organization_id_email_key1
    `);
    console.log('✓ Backup table constraints dropped');

    // Step 4: Drop old unique index
    console.log('Step 4: Dropping old unique index...');
    await client.query(`
      DROP INDEX IF EXISTS contacts_organization_id_email_key
    `);
    await client.query(`
      DROP INDEX IF EXISTS contacts_organization_id_email_key1
    `);
    console.log('✓ Old indexes dropped');

    // Step 5: Make email column nullable
    console.log('Step 5: Making email column nullable...');
    await client.query(`
      ALTER TABLE contacts
      ALTER COLUMN email DROP NOT NULL
    `);
    console.log('✓ Email column is now nullable');

    // Step 6: Create partial unique index (only for non-NULL emails)
    console.log('Step 6: Creating partial UNIQUE index for non-NULL emails...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS contacts_organization_email_unique
      ON contacts (organization_id, email)
      WHERE email IS NOT NULL
    `);
    console.log('✓ Partial unique index created');

    await client.query('COMMIT');

    console.log('\n✅ ✅ ✅ PRODUCTION DEPLOYMENT SUCCESSFUL! ✅ ✅ ✅');
    console.log('\n📋 Summary:');
    console.log('   - Email field is now OPTIONAL');
    console.log('   - Contacts can be imported WITHOUT email addresses');
    console.log('   - Duplicate email checking still works for contacts WITH emails');
    console.log('\n🎉 You can now retry your contact import!');

    process.exit(0);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ❌ ❌ DEPLOYMENT FAILED! ❌ ❌ ❌');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run deployment
console.log('=' .repeat(60));
console.log('PRODUCTION DEPLOYMENT: Make Contact Email Optional');
console.log('=' .repeat(60));
console.log('');

deployFix().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
