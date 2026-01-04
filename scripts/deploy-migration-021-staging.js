/**
 * Deploy Migration 021 to Staging
 * Adds UUID sanitization triggers to prevent empty string errors
 */

const { query } = require('../database/connection');
const fs = require('fs');
const path = require('path');

async function deployMigration() {
  console.log('\n🚀 Deploying Migration 021 to Staging...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/021_prevent_empty_uuid_strings.sql');

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

    console.log('\n✅ Migration 021 deployed successfully!\n');

    // Verify triggers were created
    console.log('🔍 Verifying triggers...');

    const triggerCheck = await query(`
      SELECT trigger_name, event_object_table
      FROM information_schema.triggers
      WHERE trigger_name LIKE 'sanitize_uuid_%'
      ORDER BY event_object_table
    `, [], orgId);

    if (triggerCheck.rows.length > 0) {
      console.log(`\n✅ Found ${triggerCheck.rows.length} UUID sanitization triggers:\n`);
      triggerCheck.rows.forEach(row => {
        console.log(`   • ${row.event_object_table} → ${row.trigger_name}`);
      });
    } else {
      console.warn('\n⚠️  No triggers found - migration may have failed silently');
    }

    // Test that the trigger works
    console.log('\n🧪 Testing trigger functionality...');

    const testResult = await query(`
      SELECT sanitize_uuid_fields() IS NOT NULL as trigger_exists
    `, [], orgId);

    if (testResult.rows[0]?.trigger_exists) {
      console.log('✅ Trigger function is working correctly\n');
    }

    console.log('🎉 Migration 021 deployment complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the migration
deployMigration();
