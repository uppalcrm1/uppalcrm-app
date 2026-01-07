/**
 * Deploy Database Migration to Staging
 * 
 * This script runs the field conversion migration on the staging database
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Staging database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  console.log('🚀 Deploying Field Conversion Migration to Staging');
  console.log('═'.repeat(60));
  console.log('');

  const client = await pool.connect();
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'database/migrations/024_add_field_conversion_config.sql');
    console.log('📄 Reading migration file...');
    console.log(`   Path: ${migrationPath}`);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded');
    console.log('');

    // Run the migration
    console.log('🔄 Executing migration...');
    console.log('─'.repeat(60));
    
    await client.query(migrationSQL);
    
    console.log('─'.repeat(60));
    console.log('✅ Migration executed successfully!');
    console.log('');

    // Verify the migration
    console.log('🔍 Verifying migration...');
    console.log('─'.repeat(60));
    
    const verifyColumns = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'custom_field_definitions' 
        AND column_name IN ('is_system_field', 'copy_on_conversion')
      ORDER BY column_name
    `);

    if (verifyColumns.rows.length === 2) {
      console.log('✅ Columns added:');
      verifyColumns.rows.forEach(col => {
        console.log(`   ✓ ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.error('❌ Column verification failed!');
      process.exit(1);
    }

    // Check native fields seeded
    const nativeFields = await client.query(`
      SELECT 
        entity_type,
        COUNT(*) as count
      FROM custom_field_definitions
      WHERE is_system_field = true
      GROUP BY entity_type
      ORDER BY entity_type
    `);

    if (nativeFields.rows.length > 0) {
      console.log('');
      console.log('✅ Native fields seeded:');
      nativeFields.rows.forEach(row => {
        console.log(`   ✓ ${row.entity_type}: ${row.count} fields`);
      });
    }

    console.log('─'.repeat(60));
    console.log('');
    console.log('🎉 Migration deployment complete!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('   1. Push code changes to staging branch');
    console.log('   2. Render will auto-deploy the backend');
    console.log('   3. Test the feature in staging');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Migration failed!');
    console.error('─'.repeat(60));
    console.error(error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration();
