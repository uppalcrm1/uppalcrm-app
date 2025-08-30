const { Pool } = require('pg');
require('dotenv').config();

/**
 * Check database tables and run migrations if needed
 */

const checkAndSetupDatabase = async () => {
  console.log('🔍 Checking database setup...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Check if leads table exists
    console.log('Checking for leads table...');
    const tableCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'leads'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('❌ Leads table not found!');
      console.log('📋 Available tables:');
      
      const allTables = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      allTables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });

      console.log('\n💡 You need to run migrations to create the leads table:');
      console.log('   npm run migrate');
      console.log('   Or for production: npm run migrate:production');
      
      process.exit(1);
    } else {
      console.log('✅ Leads table exists');
      
      // Check leads table structure
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'leads'
        ORDER BY ordinal_position
      `);
      
      console.log('📋 Leads table columns:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });

      // Check if there are any leads
      const leadCount = await pool.query('SELECT COUNT(*) as count FROM leads');
      console.log(`📊 Total leads in database: ${leadCount.rows[0].count}`);

      console.log('\n🎉 Database is properly set up for leads management!');
    }

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    
    if (error.message.includes('does not exist')) {
      console.log('\n💡 Run migrations first:');
      console.log('   npm run migrate');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  checkAndSetupDatabase();
}

module.exports = { checkAndSetupDatabase };