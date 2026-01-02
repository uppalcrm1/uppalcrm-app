/**
 * Deploy Migration 022 to Staging
 * Adds payment_method as a configurable system field in custom_field_definitions
 */

const { query } = require('../database/connection');
const fs = require('fs');
const path = require('path');

async function deployMigration() {
  console.log('\n🚀 Deploying Migration 022 to Staging...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/022_add_payment_method_system_field.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📁 Migration file loaded');
    console.log('🔗 Connecting to database...');

    // Get current organization ID for RLS context (if needed)
    const orgResult = await query('SELECT id FROM organizations LIMIT 1');
    const orgId = orgResult.rows[0]?.id;

    if (orgId) {
      console.log(`✅ Using organization context: ${orgId}`);
    }

    // Execute the migration
    console.log('⚙️  Executing migration...\n');

    await query(sql, [], orgId);

    console.log('\n✅ Migration 022 deployed successfully!\n');

    // Verify payment_method field was created
    console.log('🔍 Verifying payment_method field creation...');

    const fieldCheck = await query(`
      SELECT
        organization_id,
        field_name,
        field_label,
        entity_type,
        field_type,
        array_length(field_options, 1) as options_count
      FROM custom_field_definitions
      WHERE field_name = 'payment_method'
        AND entity_type = 'transactions'
      ORDER BY created_at DESC
      LIMIT 5
    `, [], orgId);

    if (fieldCheck.rows.length > 0) {
      console.log(`\n✅ Found ${fieldCheck.rows.length} payment_method field(s):\n`);
      fieldCheck.rows.forEach(row => {
        console.log(`   • Org: ${row.organization_id}`);
        console.log(`     Label: ${row.field_label}`);
        console.log(`     Type: ${row.field_type}`);
        console.log(`     Options count: ${row.options_count || 0}\n`);
      });
    } else {
      console.warn('\n⚠️  No payment_method fields found - migration may have failed');
    }

    // Test that field options are properly stored
    console.log('🧪 Testing field options structure...');

    const optionsTest = await query(`
      SELECT
        field_name,
        field_options
      FROM custom_field_definitions
      WHERE field_name = 'payment_method'
        AND entity_type = 'transactions'
      LIMIT 1
    `, [], orgId);

    if (optionsTest.rows.length > 0) {
      const options = optionsTest.rows[0].field_options;
      console.log('✅ Field options structure:', JSON.stringify(options, null, 2));
    }

    console.log('\n🎉 Migration 022 deployment complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Test field configuration in Settings UI');
    console.log('   2. Test payment method dropdown in lead conversion');
    console.log('   3. Test payment method dropdown in transaction modals\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the migration
deployMigration();
