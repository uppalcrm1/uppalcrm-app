#!/usr/bin/env node

/**
 * Migration Script for Staging Environment - Migration 039
 * Standardizes field naming to snake_case in default_field_configurations
 *
 * Usage:
 * node migrate-staging-039.js
 */

const { Pool } = require('pg');
const fs = require('fs');

// Staging database URL
const stagingDbUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';

const pool = new Pool({
  connectionString: stagingDbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Migration 039 on staging database...');
    console.log('Database: uppalcrm_database_staging');
    console.log('');

    // Read the migration file
    const migrationSQL = fs.readFileSync('database/migrations/039_standardize_field_naming.sql', 'utf8');

    console.log('📋 Running Migration 039: Standardize Field Naming...');
    console.log('');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Changes applied:');
    console.log('  - firstName/FirstName → first_name');
    console.log('  - lastName/LastName → last_name');
    console.log('  - assignedTo/AssignedTo → assigned_to');
    console.log('  - potentialValue/PotentialValue → potential_value');
    console.log('  - nextFollowUp/NextFollowUp → next_follow_up');
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
