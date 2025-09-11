require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runLicenseCompatibilityMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to production database');
    
    console.log('🔄 Running license compatibility migration...');
    
    // Read and execute the migration file
    const migration = fs.readFileSync('./database/migrations/006_license_compatibility.sql', 'utf8');
    await client.query(migration);
    
    console.log('✅ License compatibility migration completed successfully!');
    
    // Verify the migration
    console.log('\n📋 Verifying migration results...');
    
    // Check organizations table columns
    const orgColumns = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'organizations'
      AND column_name IN ('purchased_licenses', 'license_price_per_user', 'billing_cycle', 'converted_at', 'billing_notes', 'payment_status')
      ORDER BY column_name
    `);
    
    console.log('Organizations table license columns:');
    orgColumns.rows.forEach(col => {
      console.log(`  ✅ ${col.column_name} (${col.data_type}) default: ${col.column_default || 'NULL'}`);
    });
    
    // Check audit_logs table
    const auditTableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'audit_logs' AND table_schema = 'public'
    `);
    
    if (auditTableCheck.rows.length > 0) {
      console.log('  ✅ audit_logs table exists');
    } else {
      console.log('  ❌ audit_logs table not found');
    }
    
    // Check license function
    const functionCheck = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name = 'license_tables_exist' AND routine_schema = 'public'
    `);
    
    if (functionCheck.rows.length > 0) {
      console.log('  ✅ license_tables_exist() function created');
      
      // Test the function
      const functionTest = await client.query('SELECT license_tables_exist()');
      console.log(`  📊 License tables exist: ${functionTest.rows[0].license_tables_exist}`);
    }
    
    // Check constraints
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'organizations' 
      AND constraint_name LIKE '%license%' OR constraint_name LIKE '%billing%' OR constraint_name LIKE '%payment%'
    `);
    
    console.log('License-related constraints:');
    constraints.rows.forEach(constraint => {
      console.log(`  ✅ ${constraint.constraint_name} (${constraint.constraint_type})`);
    });
    
    console.log('\n🎉 Migration verification completed!');
    console.log('🚀 Trial-to-paid conversion should now work with license support.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

// Run migration
console.log('🚀 Starting license compatibility migration...');
console.log('Environment:', process.env.NODE_ENV || 'development');
runLicenseCompatibilityMigration();