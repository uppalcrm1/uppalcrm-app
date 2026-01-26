#!/usr/bin/env node

/**
 * Migration Script for Staging Environment - Migration 039 (Safe Version)
 * Removes duplicate camelCase field names from default_field_configurations
 *
 * Usage:
 * node migrate-staging-039-safe.js
 */

const { Pool } = require('pg');

const stagingDbUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';

const pool = new Pool({
  connectionString: stagingDbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Migration 039 (Safe) on staging database...');
    console.log('Database: uppalcrm_database_staging');
    console.log('');

    console.log('📋 Running Migration 039: Remove duplicate camelCase field names...');
    console.log('');

    // Remove duplicate camelCase field names since snake_case versions already exist
    await client.query(`
      BEGIN;

      -- Delete camelCase versions (keep snake_case)
      DELETE FROM default_field_configurations
      WHERE entity_type = 'leads'
        AND field_name IN ('firstName', 'lastName', 'assignedTo', 'potentialValue', 'nextFollowUp');

      COMMIT;
    `);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  ✓ Removed duplicate firstName (kept first_name)');
    console.log('  ✓ Removed duplicate lastName (kept last_name)');
    console.log('  ✓ Removed duplicate assignedTo (kept assigned_to)');
    console.log('  ✓ Removed duplicate potentialValue (kept potential_value)');
    console.log('  ✓ Removed duplicate nextFollowUp (kept next_follow_up)');
    console.log('');
    console.log('🎉 Staging database field configurations are now standardized!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
