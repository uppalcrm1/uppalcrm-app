const { Client } = require('pg');
require('dotenv').config();

async function testCorrectPoolerFormat() {
  console.log('🔧 Testing Supabase with correct pooler format...\n');
  
  // For Supabase pooler, the username format is: postgres.[project-ref]
  const projectRef = 'smzamnifaboqkjulrtqj';
  const password = 'Beautifulmind611$$';
  
  const connections = [
    {
      name: 'Pooler Transaction Mode (Port 6543)',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 6543,
        database: 'postgres', 
        user: `postgres.${projectRef}`,
        password: password,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Pooler Session Mode (Port 5432)',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com', 
        port: 5432,
        database: 'postgres',
        user: `postgres.${projectRef}`,
        password: password,
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Connection String Format',
      config: {
        connectionString: `postgresql://postgres.${projectRef}:${password}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
        ssl: { rejectUnauthorized: false }
      }
    }
  ];

  for (const { name, config } of connections) {
    console.log(`🔄 Testing: ${name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const client = new Client({
      ...config,
      connectionTimeoutMillis: 10000
    });

    try {
      console.log('Connecting...');
      await client.connect();
      console.log('✅ CONNECTED SUCCESSFULLY!');
      
      // Test database functionality
      const timeResult = await client.query('SELECT NOW() as current_time');
      console.log('🕒 Database time:', timeResult.rows[0].current_time);
      
      const versionResult = await client.query('SELECT version() as version');
      console.log('🗄️  PostgreSQL:', versionResult.rows[0].version.split(' ')[0]);
      
      // Test table listing
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        LIMIT 5
      `);
      console.log('📊 Existing tables:', tablesResult.rows.length);
      
      await client.end();
      console.log('🎉 SUCCESS! Connection is working perfectly.');
      
      // Show the working connection string
      console.log('\n📝 Working configuration:');
      if (config.connectionString) {
        console.log('CONNECTION_STRING:', config.connectionString);
      } else {
        console.log('HOST:', config.host);
        console.log('PORT:', config.port);
        console.log('USER:', config.user);
        console.log('DATABASE:', config.database);
      }
      
      return config;
      
    } catch (error) {
      console.error('❌ Failed:', error.message);
      if (error.code) {
        console.error('   Error Code:', error.code);
      }
      try { await client.end(); } catch {}
    }
    
    console.log(''); // Empty line between tests
  }
  
  console.log('❌ All connection attempts failed');
  return null;
}

testCorrectPoolerFormat().then(workingConfig => {
  if (workingConfig) {
    console.log('\n🚀 Ready to update your .env file and run migrations!');
  } else {
    console.log('\n💭 If none work, please:');
    console.log('1. Go to Supabase Dashboard → Settings → Database');
    console.log('2. Copy the exact "Connection string" (URI format)'); 
    console.log('3. Make sure your project is not paused');
    console.log('4. Check if IP allowlisting is required');
  }
});