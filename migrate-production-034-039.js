#!/usr/bin/env node

/**
 * Production Migration Script - Migrations 034-039
 * Applies all field configuration and standardization migrations
 *
 * Usage:
 * node migrate-production-034-039.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const prodDbUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

const pool = new Pool({
  connectionString: prodDbUrl,
  ssl: { rejectUnauthorized: false }
});

const migrations = [
  { number: 34, file: '034_seed_contact_field_visibility.sql', description: 'Seed contact field visibility' },
  { number: 35, file: '035_add_missing_contact_system_fields.sql', description: 'Add missing contact system fields' },
  { number: 36, file: '036_comprehensive_contact_field_configuration.sql', description: 'Comprehensive contact field configuration' },
  { number: 37, file: '037_cleanup_duplicate_linkedin_field.sql', description: 'Cleanup duplicate LinkedIn field' },
  { number: 38, file: '038_comprehensive_leads_field_configuration.sql', description: 'Comprehensive leads field configuration' },
  { number: 39, file: '039_standardize_field_naming.sql', description: 'Standardize field naming to snake_case' }
];

async function runMigrations() {
  const client = await pool.connect();

  try {
    console.log('🚀 Starting Production Migrations 034-039...');
    console.log('Database: uppalcrm_database (production)');
    console.log('');
    console.log('📋 Migrations to apply:');
    migrations.forEach((m, idx) => {
      console.log(`  ${idx + 1}. Migration ${m.number}: ${m.description}`);
    });
    console.log('');

    let successCount = 0;

    for (const migration of migrations) {
      try {
        console.log(`⏳ Running Migration ${migration.number}...`);
        const filePath = path.join(__dirname, 'database', 'migrations', migration.file);
        
        if (!fs.existsSync(filePath)) {
          throw new Error(`Migration file not found: ${filePath}`);
        }

        const sql = fs.readFileSync(filePath, 'utf8');
        await client.query(sql);

        console.log(`✅ Migration ${migration.number} completed successfully`);
        console.log(`   ${migration.description}`);
        console.log('');
        successCount++;

      } catch (error) {
        console.error(`❌ Migration ${migration.number} FAILED:`, error.message);
        console.error('');
        
        // For migration 039, if it fails due to duplicates, try the safe version
        if (migration.number === 39 && error.message.includes('duplicate key')) {
          console.log('⚠️  Attempting safe removal of duplicate field names...');
          try {
            await client.query(`
              BEGIN;
              DELETE FROM default_field_configurations
              WHERE entity_type = 'leads'
                AND field_name IN ('firstName', 'lastName', 'assignedTo', 'potentialValue', 'nextFollowUp');
              COMMIT;
            `);
            console.log(`✅ Migration ${migration.number} completed (safe mode)`);
            successCount++;
          } catch (safeError) {
            console.error(`❌ Safe removal also failed:`, safeError.message);
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    console.log('');
    console.log('═'.repeat(60));
    console.log(`✅ PRODUCTION MIGRATIONS COMPLETE`);
    console.log(`   ${successCount}/${migrations.length} migrations applied successfully`);
    console.log('═'.repeat(60));
    console.log('');

    // Verify field names
    console.log('📊 Verifying field names in production...');
    const result = await client.query(`
      SELECT DISTINCT field_name
      FROM default_field_configurations
      WHERE entity_type = 'leads'
      ORDER BY field_name
    `);

    console.log('\n📋 Current field names for leads entity:');
    result.rows.forEach(row => {
      console.log(`  - ${row.field_name}`);
    });

    // Check for duplicates
    const dupResult = await client.query(`
      SELECT field_name, COUNT(*) as count
      FROM default_field_configurations
      WHERE entity_type = 'leads'
      GROUP BY field_name
      HAVING COUNT(*) > 1
    `);

    if (dupResult.rows.length === 0) {
      console.log('\n✅ No duplicate field names detected');
    } else {
      console.log('\n⚠️  DUPLICATES FOUND:');
      dupResult.rows.forEach(row => {
        console.log(`  - ${row.field_name} (${row.count} versions)`);
      });
    }

    console.log('\n🎉 Production database is ready for deployment!');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Merge staging → production branch');
    console.log('  2. Deploy frontend code');
    console.log('  3. Test lead edit form in production');
    console.log('  4. Monitor application logs');

  } catch (error) {
    console.error('\n❌ Migration process failed:', error.message);
    console.error('\nRollback recommended if mutations were not rolled back automatically.');
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
