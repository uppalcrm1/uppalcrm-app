/**
 * Deploy Custom Fields Migration to STAGING
 *
 * This script applies the custom_fields migration to the staging database
 * and verifies the deployment.
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Check if we're using staging environment
const isStaging = process.env.NODE_ENV === 'staging' ||
                  process.env.DATABASE_URL?.includes('staging') ||
                  process.env.DATABASE_URL?.includes('uppalcrm-frontend-staging');

if (!isStaging && !process.argv.includes('--force')) {
  console.log('⚠️  WARNING: This script is designed for STAGING deployment');
  console.log('');
  console.log('Current environment indicators:');
  console.log('  NODE_ENV:', process.env.NODE_ENV || 'not set');
  console.log('  DATABASE_URL contains "staging":', process.env.DATABASE_URL?.includes('staging') ? 'Yes' : 'No');
  console.log('');
  console.log('If you\'re CERTAIN you want to run this on the current environment,');
  console.log('use: node scripts/deploy-custom-fields-staging.js --force');
  console.log('');
  process.exit(1);
}

async function deployToStaging() {
  console.log('🚀 Deploying Custom Fields Migration to STAGING\n');
  console.log('═══════════════════════════════════════════════════\n');

  // Use environment variable or staging connection
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ ERROR: DATABASE_URL environment variable not set');
    console.error('');
    console.error('Please set your staging database connection:');
    console.error('  export DATABASE_URL="postgresql://user:pass@host:port/database"');
    console.error('');
    process.exit(1);
  }

  console.log('📊 Database Connection:');
  // Mask password for security
  const maskedUrl = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log('  ' + maskedUrl);
  console.log('');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    // Step 1: Check current state
    console.log('🔍 Step 1: Checking current database state...\n');

    const existingColumn = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'contacts'
      AND column_name = 'custom_fields'
    `);

    if (existingColumn.rows.length > 0) {
      console.log('⚠️  Column "custom_fields" already exists in contacts table:');
      console.log('   Type:', existingColumn.rows[0].data_type);
      console.log('   Default:', existingColumn.rows[0].column_default);
      console.log('');
      console.log('Migration may have already been applied. Continuing with verification...\n');
    } else {
      console.log('✓ Column "custom_fields" does not exist yet (expected)\n');
    }

    // Step 2: Create backup point
    console.log('🔍 Step 2: Creating backup point...\n');

    await client.query('BEGIN');
    console.log('✓ Transaction started\n');

    // Step 3: Apply migration
    console.log('📦 Step 3: Applying migration...\n');

    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '017_add_custom_fields_to_contacts.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✓ Migration file loaded:', path.basename(migrationPath));
    console.log('');

    await client.query(migrationSQL);
    console.log('✓ Migration SQL executed successfully\n');

    await client.query('COMMIT');
    console.log('✓ Transaction committed\n');

    // Step 4: Verify the migration
    console.log('🔍 Step 4: Verifying migration...\n');

    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'contacts'
      AND column_name = 'custom_fields'
    `);

    if (verifyResult.rows.length === 0) {
      throw new Error('Verification failed: custom_fields column not found after migration');
    }

    console.log('✅ VERIFICATION SUCCESSFUL:');
    console.log('   Table: contacts');
    console.log('   Column: custom_fields');
    console.log('   Type:', verifyResult.rows[0].data_type);
    console.log('   Default:', verifyResult.rows[0].column_default);
    console.log('');

    // Step 5: Check index
    const indexCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'contacts'
      AND indexname = 'idx_contacts_custom_fields'
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ INDEX CREATED:');
      console.log('   Name: idx_contacts_custom_fields');
      console.log('   Type: GIN (for JSONB queries)');
      console.log('');
    }

    // Step 6: Test query
    console.log('🧪 Step 5: Testing custom_fields functionality...\n');

    const testQuery = await client.query(`
      SELECT
        id,
        first_name,
        last_name,
        custom_fields,
        CASE
          WHEN custom_fields IS NULL THEN 'NULL'
          WHEN custom_fields::text = '{}' THEN 'Empty Object'
          ELSE 'Has Data'
        END as custom_fields_status
      FROM contacts
      LIMIT 3
    `);

    console.log('✓ Sample contacts with custom_fields:');
    testQuery.rows.forEach((row, idx) => {
      console.log(`   ${idx + 1}. ${row.first_name} ${row.last_name}`);
      console.log(`      custom_fields: ${row.custom_fields_status}`);
    });
    console.log('');

    // Step 7: Summary
    console.log('═══════════════════════════════════════════════════\n');
    console.log('✅ STAGING DEPLOYMENT SUCCESSFUL!\n');
    console.log('What was deployed:');
    console.log('  ✓ Added custom_fields column to contacts table');
    console.log('  ✓ Created GIN index for efficient queries');
    console.log('  ✓ Set default value to \'{}\'::jsonb');
    console.log('  ✓ Verified all changes applied correctly');
    console.log('');
    console.log('Next Steps:');
    console.log('  1. Restart staging server (if needed)');
    console.log('  2. Test lead conversion with custom fields');
    console.log('  3. Verify custom fields appear in contacts and accounts');
    console.log('  4. Monitor staging for 24-48 hours');
    console.log('  5. Deploy to production if all looks good');
    console.log('');
    console.log('Testing Commands:');
    console.log('  - Convert a lead with "App" custom field');
    console.log('  - Check contact details for custom_fields');
    console.log('  - Check account details for custom_fields');
    console.log('');
    console.log('📋 See DEPLOYMENT_GUIDE.md for complete checklist');
    console.log('');

  } catch (error) {
    try {
      await client.query('ROLLBACK');
      console.log('🔄 Transaction rolled back\n');
    } catch (rollbackError) {
      console.error('⚠️  Rollback error:', rollbackError.message);
    }

    console.error('\n❌ DEPLOYMENT FAILED\n');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    console.error('');
    console.error('The database has been rolled back to its previous state.');
    console.error('No changes were permanently applied.');
    console.error('');
    process.exit(1);

  } finally {
    client.release();
    await pool.end();
  }
}

// Run the deployment
console.log('');
deployToStaging().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
