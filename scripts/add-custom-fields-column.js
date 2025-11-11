/**
 * Add custom_fields column to leads table
 * Run this script to add JSONB column for storing custom field values
 */

const db = require('../database/connection');
const fs = require('fs');
const path = require('path');

async function addCustomFieldsColumn() {
  console.log('🔧 Adding custom_fields column to leads table...');

  try {
    // Read the migration SQL
    const migrationPath = path.join(__dirname, '../database/migrations/015_add_custom_fields_to_leads.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await db.query(sql);

    console.log('✅ Successfully added custom_fields column to leads table');

    // Verify the column was added
    const result = await db.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name = 'custom_fields'
    `);

    if (result.rows.length > 0) {
      console.log('✅ Verified: custom_fields column exists');
      console.log('   Column details:', result.rows[0]);
    } else {
      console.log('⚠️ Warning: Column check returned no results');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding custom_fields column:', error.message);
    console.error('   Full error:', error);
    process.exit(1);
  }
}

// Run the migration
addCustomFieldsColumn();
