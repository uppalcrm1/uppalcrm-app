/**
 * Deploy Contact Imports Migration to Staging
 * Creates tables for contact import functionality
 */

const { query } = require('../database/connection');
const fs = require('fs');
const path = require('path');

async function deployMigration() {
  console.log('\n🚀 Deploying Contact Imports Migration to Staging...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/import-contacts.sql');

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

    console.log('\n✅ Migration deployed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');

    const tableCheck = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('contact_imports', 'contact_import_mappings', 'contact_import_records')
      ORDER BY table_name
    `, [], orgId);

    if (tableCheck.rows.length === 3) {
      console.log(`\n✅ All 3 tables created successfully:\n`);
      tableCheck.rows.forEach(row => {
        console.log(`   • ${row.table_name}`);
      });
    } else {
      console.warn(`\n⚠️  Expected 3 tables, found ${tableCheck.rows.length}`);
    }

    // Verify indexes were created
    console.log('\n🔍 Verifying indexes...');

    const indexCheck = await query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_contact_import%'
      ORDER BY indexname
    `, [], orgId);

    if (indexCheck.rows.length > 0) {
      console.log(`\n✅ Found ${indexCheck.rows.length} indexes:\n`);
      indexCheck.rows.forEach(row => {
        console.log(`   • ${row.indexname}`);
      });
    }

    console.log('\n🎉 Contact Imports migration deployment complete!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the migration
deployMigration();
