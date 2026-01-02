/**
 * Deploy Migration 022 to Production
 * Adds payment_method as a configurable system field in custom_field_definitions
 *
 * IMPORTANT: Run this AFTER successful testing in staging environment
 */

const { query } = require('../database/connection');
const fs = require('fs');
const path = require('path');

async function deployMigration() {
  console.log('\n🚀 Deploying Migration 022 to PRODUCTION...\n');
  console.log('⚠️  PRODUCTION DEPLOYMENT - Please verify you want to proceed');
  console.log('📋 This migration will:');
  console.log('   - Add payment_method as a system field for transactions');
  console.log('   - Create field definitions for all organizations');
  console.log('   - Set default payment method options\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/022_add_payment_method_system_field.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('📁 Migration file loaded');
    console.log('🔗 Connecting to database...');

    // Get organization count
    const orgCountResult = await query('SELECT COUNT(*) as count FROM organizations');
    const orgCount = orgCountResult.rows[0].count;
    console.log(`📊 Found ${orgCount} organization(s) in database`);

    // Get first organization ID for RLS context
    const orgResult = await query('SELECT id FROM organizations LIMIT 1');
    const orgId = orgResult.rows[0]?.id;

    if (orgId) {
      console.log(`✅ Using organization context: ${orgId}`);
    }

    // Check if payment_method field already exists
    console.log('\n🔍 Checking for existing payment_method fields...');
    const existingCheck = await query(`
      SELECT COUNT(*) as count
      FROM custom_field_definitions
      WHERE field_name = 'payment_method'
        AND entity_type = 'transactions'
    `, [], orgId);

    const existingCount = existingCheck.rows[0].count;
    if (existingCount > 0) {
      console.warn(`\n⚠️  Found ${existingCount} existing payment_method field(s)`);
      console.log('    Migration will use ON CONFLICT DO UPDATE to update existing records\n');
    }

    // Execute the migration
    console.log('⚙️  Executing migration...\n');
    console.log('⏳ This may take a moment if there are many organizations...\n');

    const startTime = Date.now();
    await query(sql, [], orgId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ Migration 022 executed successfully in ${duration}s!\n`);

    // Comprehensive verification
    console.log('🔍 Running verification checks...\n');

    // 1. Count total payment_method fields created
    const totalCheck = await query(`
      SELECT COUNT(*) as count
      FROM custom_field_definitions
      WHERE field_name = 'payment_method'
        AND entity_type = 'transactions'
    `, [], orgId);

    console.log(`✅ Total payment_method fields: ${totalCheck.rows[0].count}`);

    if (totalCheck.rows[0].count !== orgCount) {
      console.warn(`⚠️  Warning: Expected ${orgCount} fields (one per org), found ${totalCheck.rows[0].count}`);
    }

    // 2. Verify field structure for each organization
    const fieldDetails = await query(`
      SELECT
        o.name as org_name,
        cfd.organization_id,
        cfd.field_label,
        cfd.field_type,
        cfd.is_required,
        cfd.is_active,
        array_length(cfd.field_options, 1) as options_count
      FROM custom_field_definitions cfd
      JOIN organizations o ON o.id = cfd.organization_id
      WHERE cfd.field_name = 'payment_method'
        AND cfd.entity_type = 'transactions'
      ORDER BY o.name
    `, [], orgId);

    console.log(`\n📊 Field details by organization:\n`);
    fieldDetails.rows.forEach(row => {
      console.log(`   • ${row.org_name}:`);
      console.log(`     - Label: ${row.field_label}`);
      console.log(`     - Type: ${row.field_type}`);
      console.log(`     - Required: ${row.is_required}`);
      console.log(`     - Active: ${row.is_active}`);
      console.log(`     - Options count: ${row.options_count || 0}\n`);
    });

    // 3. Test field options structure
    console.log('🧪 Testing field options structure...');

    const optionsTest = await query(`
      SELECT
        organization_id,
        field_options
      FROM custom_field_definitions
      WHERE field_name = 'payment_method'
        AND entity_type = 'transactions'
      LIMIT 1
    `, [], orgId);

    if (optionsTest.rows.length > 0) {
      const options = optionsTest.rows[0].field_options;
      console.log('\n✅ Sample field options structure:');
      console.log(JSON.stringify(options, null, 2));

      // Verify it's an array with expected options
      if (Array.isArray(options) && options.length > 0) {
        console.log(`\n✅ Field options are properly formatted (${options.length} options)`);
      } else {
        console.warn('\n⚠️  Warning: Field options may not be properly formatted');
      }
    }

    // 4. Summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Migration 022 deployment COMPLETE!\n');
    console.log('📊 Summary:');
    console.log(`   ✅ Organizations processed: ${orgCount}`);
    console.log(`   ✅ Fields created/updated: ${totalCheck.rows[0].count}`);
    console.log(`   ✅ Execution time: ${duration}s\n`);

    console.log('📝 Post-deployment checklist:');
    console.log('   1. ✓ Test field configuration in Settings UI');
    console.log('   2. ✓ Test payment method dropdown in lead conversion');
    console.log('   3. ✓ Test payment method dropdown in Create Transaction');
    console.log('   4. ✓ Test payment method dropdown in Edit Transaction');
    console.log('   5. ✓ Verify payment methods are customizable per organization');
    console.log('   6. ✓ Test that changes persist and appear in all forms\n');

    console.log('💡 To customize payment methods for an organization:');
    console.log('   - Go to Settings → Field Configuration');
    console.log('   - Select "Transactions" entity type');
    console.log('   - Find "Payment Method" field');
    console.log('   - Edit options as needed\n');

    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    console.error('\n🔧 Troubleshooting steps:');
    console.error('   1. Check database connection');
    console.error('   2. Verify custom_field_definitions table exists');
    console.error('   3. Check migration file syntax');
    console.error('   4. Review database logs for detailed error info\n');
    process.exit(1);
  }
}

// Run the migration
deployMigration();
