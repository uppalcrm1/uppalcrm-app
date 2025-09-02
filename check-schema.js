const { query } = require('./database/connection');

async function checkSchema() {
  try {
    console.log('📋 Checking current database schema...\n');
    
    // Check contacts table structure
    const contactsResult = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    if (contactsResult.rows.length > 0) {
      console.log('📊 Contacts table columns:');
      contactsResult.rows.forEach(col => {
        console.log(`   • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ Contacts table not found');
    }
    
    console.log('');
    
    // Check if leads table exists
    const leadsResult = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'leads' AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    if (leadsResult.rows.length > 0) {
      console.log('📊 Leads table columns:');
      leadsResult.rows.forEach(col => {
        console.log(`   • ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ Leads table not found');
    }
    
    console.log('');
    
    // Check what tables we have
    const tablesResult = await query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
    `);
    console.log('📋 Available tables:');
    tablesResult.rows.forEach(table => {
      console.log(`   • ${table.tablename}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSchema();