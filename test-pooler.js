const { Client } = require('pg');
require('dotenv').config();

async function testPoolerConnection() {
  // Try different Supabase connection endpoints
  const connections = [
    {
      name: 'Direct Database Connection',
      config: {
        connectionString: 'postgresql://postgres:Beautifulmind611$$@db.smzamnifaboqkjulrtqj.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Pooler Connection (Transaction Mode)', 
      config: {
        connectionString: 'postgresql://postgres:Beautifulmind611$$@aws-0-us-west-1.pooler.supabase.com:6543/postgres',
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Alternative Pooler Format',
      config: {
        host: 'aws-0-us-west-1.pooler.supabase.com',
        port: 6543,
        database: 'postgres',
        user: 'postgres.smzamnifaboqkjulrtqj',
        password: 'Beautifulmind611$$',
        ssl: { rejectUnauthorized: false }
      }
    },
    {
      name: 'Session Mode Pooler',
      config: {
        connectionString: 'postgresql://postgres:Beautifulmind611$$@aws-0-us-west-1.pooler.supabase.com:5432/postgres',
        ssl: { rejectUnauthorized: false }
      }
    }
  ];

  for (const { name, config } of connections) {
    console.log(`\n🔄 Testing: ${name}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const client = new Client({
      ...config,
      connectionTimeoutMillis: 10000
    });

    try {
      console.log('Connecting...');
      await client.connect();
      console.log('✅ Connected successfully!');
      
      const result = await client.query('SELECT NOW() as current_time, version() as version');
      console.log('🕒 Database time:', result.rows[0].current_time);
      console.log('🗄️  PostgreSQL version:', result.rows[0].version.split(' ')[0]);
      
      // Test basic query
      const testResult = await client.query('SELECT 1 + 1 as result');
      console.log('🧮 Test query result:', testResult.rows[0].result);
      
      await client.end();
      console.log('🎉 SUCCESS! This connection works.');
      
      // Update .env file with working connection
      console.log('\n📝 Working connection string:');
      if (config.connectionString) {
        console.log(config.connectionString);
      } else {
        console.log(`Host: ${config.host}, Port: ${config.port}, User: ${config.user}`);
      }
      
      return config;
      
    } catch (error) {
      console.error('❌ Failed:', error.message);
      try { await client.end(); } catch {}
    }
  }
  
  console.log('\n❌ All connection attempts failed');
  console.log('\n💡 Suggestions:');
  console.log('1. Check your Supabase project status in the dashboard');
  console.log('2. Verify your database password is exactly: Beautifulmind611$$');
  console.log('3. Try connecting directly from the Supabase dashboard');
  console.log('4. Check if your IP needs to be allowlisted');
  
  return null;
}

testPoolerConnection();