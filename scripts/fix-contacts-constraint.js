#!/usr/bin/env node

/**
 * Fix Contacts Lead Constraint
 *
 * Runs migration 009 to allow lead deletion when referenced by contacts
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function runMigration() {
  try {
    console.log('🔧 Fixing contacts → leads foreign key constraint...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '009_fix_contacts_lead_constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration: 009_fix_contacts_lead_constraint.sql');
    console.log('='.repeat(60));

    // Execute the migration
    const result = await db.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 What changed:');
    console.log('  - Found foreign key constraint from contacts to leads');
    console.log('  - Dropped old constraint');
    console.log('  - Added new constraint with ON DELETE SET NULL');
    console.log('  - Leads can now be deleted even if converted to contacts');
    console.log('  - Contact reference will be set to NULL when lead is deleted\n');

    console.log('🧪 Test it now:');
    console.log('  Try deleting the lead again - it should work!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

// Run the migration
runMigration();
