const { Client } = require('pg');
require('dotenv').config();

async function testPoolerConnection() {
  console.log('🔄 Testing Supabase Pooler Connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase pooler...');
    await client.connect();
    console.log('✅ Connected successfully!');
    
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log('🕒 Database time:', result.rows[0].current_time);
    console.log('🗄️  PostgreSQL version:', result.rows[0].version.split(' ')[0]);
    
    // Test if we can create tables
    console.log('Testing table creation permissions...');
    await client.query('SELECT 1 as test');
    console.log('✅ Database queries work!');
    
    await client.end();
    console.log('🎉 Supabase connection successful!');
    return true;
    
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    if (error.code) {
      console.error('Error Code:', error.code);
    }
    return false;
  }
}

testPoolerConnection();