#!/usr/bin/env node

/**
 * Apply Comprehensive Lead History Tracking
 *
 * This script applies migration 010 which:
 * - Creates/ensures lead_change_history and lead_status_history tables exist
 * - Creates comprehensive triggers to track ALL lead field changes
 * - Tracks lead creation
 * - Tracks all updates (status, fields, assignments)
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function applyMigration() {
  try {
    console.log('🚀 Applying comprehensive lead history tracking...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'migrations', '010_comprehensive_lead_history.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration: 010_comprehensive_lead_history.sql');
    console.log('='.repeat(60));

    // Execute the migration
    await db.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 What changed:');
    console.log('  ✓ lead_change_history table created/verified');
    console.log('  ✓ lead_status_history table created/verified');
    console.log('  ✓ Indexes created for performance');
    console.log('  ✓ Comprehensive trigger installed - tracks ALL fields:');
    console.log('    - Status changes');
    console.log('    - Assignment changes');
    console.log('    - Contact info (first_name, last_name, email, phone, company, title)');
    console.log('    - Lead details (value, priority, source)');
    console.log('    - Address fields (address, city, state, postal_code, country)');
    console.log('    - Notes');
    console.log('    - Custom fields');
    console.log('  ✓ Lead creation tracking installed');

    // Verify tables exist
    const verifyQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('lead_change_history', 'lead_status_history')
      ORDER BY table_name;
    `;

    const result = await db.query(verifyQuery);
    console.log('\n✅ Verification - Tables exist:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Verify trigger exists
    const triggerQuery = `
      SELECT trigger_name, event_manipulation
      FROM information_schema.triggers
      WHERE event_object_table = 'leads'
      AND trigger_schema = 'public'
      ORDER BY trigger_name;
    `;

    const triggerResult = await db.query(triggerQuery);
    console.log('\n✅ Verification - Triggers installed:');
    triggerResult.rows.forEach(row => {
      console.log(`   ✓ ${row.trigger_name} (${row.event_manipulation})`);
    });

    console.log('\n🎉 Lead history tracking is now fully operational!');
    console.log('   All changes to leads will be automatically logged.');
    console.log('\n💡 Test it:');
    console.log('   1. Go to any lead detail page');
    console.log('   2. Change the stage or any field');
    console.log('   3. Check the History tab - changes should appear!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

// Run the migration
applyMigration();
