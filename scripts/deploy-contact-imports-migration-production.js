/**
 * Deploy Contact Imports Migration to Production
 * Creates tables for contact import functionality
 */

require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runProductionMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to production database');

    // Check if tables already exist
    const existingTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('contact_imports', 'contact_import_mappings', 'contact_import_records')
    `);

    if (existingTables.rows.length === 3) {
      console.log('⚠️  All contact import tables already exist. Migration not needed.');
      return;
    }

    if (existingTables.rows.length > 0) {
      console.log('⚠️  Some contact import tables already exist:', existingTables.rows.map(r => r.table_name));
    }

    console.log('🔄 Running contact imports migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/import-contacts.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('📁 Migration file loaded');

    // Execute the migration
    console.log('⚙️  Creating tables...');
    await client.query(sql);

    console.log('✅ Migration executed successfully!');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tableCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('contact_imports', 'contact_import_mappings', 'contact_import_records')
      ORDER BY table_name
    `);

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
    const indexCheck = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname LIKE 'idx_contact_import%'
      ORDER BY indexname
    `);

    if (indexCheck.rows.length > 0) {
      console.log(`\n✅ Found ${indexCheck.rows.length} indexes:\n`);
      indexCheck.rows.forEach(row => {
        console.log(`   • ${row.indexname}`);
      });
    }

    console.log('\n🎉 Production contact imports migration completed successfully!');

  } catch (error) {
    console.error('❌ Production migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

// Run migration
console.log('🚀 Starting production contact imports migration...');
console.log('Environment:', process.env.NODE_ENV);
runProductionMigration();
