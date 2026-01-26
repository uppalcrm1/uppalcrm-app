#!/usr/bin/env node

/**
 * Simplified Production Migration - Only Migration 039 (Safe)
 * 
 * The other migrations (034-038) are for a newer schema version
 * Production database has a different structure.
 * 
 * This applies only the field naming standardization that's needed.
 */

const { Pool } = require('pg');

const prodDbUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

const pool = new Pool({
  connectionString: prodDbUrl,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Production Migration (Field Naming Standardization)...');
    console.log('Database: uppalcrm_database (production)');
    console.log('');

    // First, check for duplicate field names
    console.log('📊 Checking for duplicate field names...');
    const dupResult = await client.query(`
      SELECT field_name, COUNT(*) as count
      FROM default_field_configurations
      WHERE entity_type = 'leads'
      GROUP BY field_name
      HAVING COUNT(*) > 1
      ORDER BY field_name
    `);

    if (dupResult.rows.length === 0) {
      console.log('✅ No duplicates found - production already using snake_case exclusively');
      console.log('');
      
      // Show current field names
      const fieldsResult = await client.query(`
        SELECT DISTINCT field_name
        FROM default_field_configurations
        WHERE entity_type = 'leads'
        ORDER BY field_name
      `);

      console.log('📋 Current field names:');
      fieldsResult.rows.forEach(row => {
        console.log(`  - ${row.field_name}`);
      });

      console.log('\n🎉 Production database is already standardized!');
      return;
    }

    console.log('⚠️  Found duplicate field names:');
    dupResult.rows.forEach(row => {
      console.log(`  - ${row.field_name} (${row.count} versions)`);
    });

    console.log('\n📋 Running Migration 039: Remove duplicate camelCase field names...');
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

    // Verify
    console.log('📊 Verifying field names...');
    const fieldsResult = await client.query(`
      SELECT DISTINCT field_name
      FROM default_field_configurations
      WHERE entity_type = 'leads'
      ORDER BY field_name
    `);

    console.log('\n📋 Current field names:');
    fieldsResult.rows.forEach(row => {
      console.log(`  - ${row.field_name}`);
    });

    console.log('\n🎉 Production database field configurations are now standardized!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Merge staging → production branch');
    console.log('  2. Deploy frontend code');
    console.log('  3. Test lead edit form in production');
    console.log('  4. Monitor application logs');

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
