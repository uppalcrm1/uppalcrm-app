const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging',
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  try {
    console.log('🔍 CHECKING STAGING SCHEMA DIFFERENCES:');
    
    console.log('\n1. Checking users table columns...');
    const userColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    userColumns.rows.forEach(col => {
      console.log(`   ${col.column_name} (${col.data_type}) ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });
    
    const hasTimezone = userColumns.rows.find(col => col.column_name === 'timezone');
    console.log(`\n🕐 Timezone column exists: ${hasTimezone ? '✅ YES' : '❌ NO'}`);
    
    console.log('\n2. Checking RLS policies...');
    const rlsPolicies = await pool.query(`
      SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
      FROM pg_policies 
      WHERE tablename IN ('users', 'user_sessions', 'organizations')
      ORDER BY tablename, policyname
    `);
    
    console.log('RLS Policies:');
    rlsPolicies.rows.forEach(policy => {
      console.log(`   ${policy.tablename}.${policy.policyname}: ${policy.cmd} - ${policy.qual}`);
    });
    
  } catch (error) {
    console.error('Schema check error:', error.message);
  } finally {
    await pool.end();
  }
}

checkSchema();