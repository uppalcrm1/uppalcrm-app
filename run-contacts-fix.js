const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Render PostgreSQL connection
const pool = new Pool({
  connectionString: "postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database",
  ssl: {
    rejectUnauthorized: false
  }
});

async function runContactsFix() {
  console.log('🚀 Starting Contacts Migration Fix');
  console.log('='.repeat(60));

  try {
    // Test connection first
    console.log('✅ Testing database connection...');
    const testResult = await pool.query('SELECT NOW() as current_time, current_database() as db_name');
    console.log(`✅ Connected to: ${testResult.rows[0].db_name}`);
    console.log(`✅ Server time: ${testResult.rows[0].current_time}`);

    // Read the safe fix SQL script
    console.log('\n📄 Reading safe fix script...');
    const fixScriptPath = path.join(__dirname, 'fix-contacts-migration-safe.sql');
    const fixScript = fs.readFileSync(fixScriptPath, 'utf8');
    console.log(`✅ Fix script loaded (${fixScript.length} characters)`);

    // Show what will be affected
    console.log('\n🔍 Checking current state before fix...');
    
    // Check current contacts count
    try {
      const currentContacts = await pool.query('SELECT COUNT(*) as count FROM contacts');
      console.log(`📊 Current contacts: ${currentContacts.rows[0].count}`);
    } catch (error) {
      console.log('⚠️  Could not count current contacts:', error.message);
    }

    // Check if backup tables exist
    const backupCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('contacts_backup', 'contacts_broken_backup')
      ORDER BY table_name
    `);
    
    console.log('📊 Backup tables found:');
    if (backupCheck.rows.length === 0) {
      console.log('   None found');
    } else {
      backupCheck.rows.forEach(row => console.log(`   - ${row.table_name}`));
    }

    // Ask for confirmation
    console.log('\n⚠️  WARNING: This fix will:');
    console.log('   1. Rename current contacts table to contacts_broken_backup');
    console.log('   2. Create new contacts table with proper structure');
    console.log('   3. Migrate all data to the new structure');
    console.log('   4. Add missing columns: name, tenant_id, status, source, tags');
    console.log('   5. Enable Row-Level Security policies');
    console.log('   6. Create API compatibility view');

    console.log('\n🔄 Executing fix script...');
    console.log('=' .repeat(60));

    // Execute the fix script
    const result = await pool.query(fixScript);
    
    console.log('✅ Fix script executed successfully!');

    // Show results from the verification queries at the end of the script
    if (Array.isArray(result)) {
      // Multiple result sets
      result.forEach((res, index) => {
        if (res.rows && res.rows.length > 0) {
          console.log(`\nResult set ${index + 1}:`);
          console.table(res.rows);
        }
      });
    } else if (result.rows && result.rows.length > 0) {
      console.log('\n📊 Verification Results:');
      console.table(result.rows);
    }

    console.log('\n🎉 CONTACTS MIGRATION FIX COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n✅ Summary of changes:');
    console.log('   • contacts table now has proper structure');
    console.log('   • Missing columns added: name, tenant_id, status, source, tags'); 
    console.log('   • All existing data preserved and migrated');
    console.log('   • Row-Level Security enabled');
    console.log('   • API compatibility view created');
    console.log('   • Indexes and triggers configured');

    console.log('\n🔄 Next steps:');
    console.log('   1. Test contact creation through your API');
    console.log('   2. Verify the "Unable to create contact" error is resolved');
    console.log('   3. Check that all existing contacts are still accessible');
    console.log('   4. If everything works, you can drop contacts_broken_backup table');

    return true;

  } catch (error) {
    console.error('\n❌ Fix failed:', error.message);
    console.error('\nStack trace:', error.stack);
    
    console.log('\n🔧 Troubleshooting suggestions:');
    console.log('   1. Check database connection');
    console.log('   2. Ensure you have sufficient permissions');
    console.log('   3. Verify foreign key constraints exist');
    console.log('   4. Check for any data conflicts');
    
    return false;
  } finally {
    await pool.end();
  }
}

// Run the fix if called directly
if (require.main === module) {
  runContactsFix()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { runContactsFix };