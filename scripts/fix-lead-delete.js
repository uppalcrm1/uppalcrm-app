#!/usr/bin/env node

/**
 * Fix Lead Delete Constraint
 *
 * Runs migration 008 to allow lead deletion even when converted to contacts
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function runMigration() {
  try {
    console.log('🔧 Starting lead delete constraint fix...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '008_fix_lead_delete_constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration: 008_fix_lead_delete_constraint.sql');
    console.log('='.repeat(60));

    // Execute the migration
    await db.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - Dropped old foreign key constraint on contacts.lead_id');
    console.log('  - Added new constraint with ON DELETE SET NULL');
    console.log('  - Leads can now be deleted even if converted to contacts');
    console.log('  - Contact lead_id will be set to NULL when lead is deleted\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();
