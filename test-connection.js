const { Client } = require('pg');
const dns = require('dns');
require('dotenv').config();

async function testDNS() {
  const hostname = 'db.smzamnifaboqkjulrtqj.supabase.co';
  
  return new Promise((resolve, reject) => {
    console.log(`Testing DNS resolution for: ${hostname}`);
    
    dns.lookup(hostname, { family: 4 }, (err, address, family) => {
      if (err) {
        console.error('❌ DNS IPv4 lookup failed:', err.message);
        
        // Try IPv6
        dns.lookup(hostname, { family: 6 }, (err6, address6) => {
          if (err6) {
            console.error('❌ DNS IPv6 lookup also failed:', err6.message);
            reject(err);
          } else {
            console.log('✅ IPv6 address found:', address6);
            resolve(address6);
          }
        });
      } else {
        console.log('✅ IPv4 address found:', address, 'family:', family);
        resolve(address);
      }
    });
  });
}

async function testConnection() {
  console.log('Testing Supabase connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  console.log('DB_HOST:', process.env.DB_HOST);
  
  try {
    // Test DNS first
    await testDNS();
    
    // Try connection with different configurations
    const configs = [
      {
        name: 'Connection String with SSL',
        config: {
          connectionString: process.env.DATABASE_URL,
          ssl: { rejectUnauthorized: false }
        }
      },
      {
        name: 'Individual params with SSL',
        config: {
          host: 'db.smzamnifaboqkjulrtqj.supabase.co',
          port: 5432,
          database: 'postgres',
          user: 'postgres',
          password: 'Beautifulmind611$',
          ssl: { rejectUnauthorized: false }
        }
      }
    ];

    for (const { name, config } of configs) {
      console.log(`\nTrying: ${name}`);
      const client = new Client(config);
      
      try {
        console.log('Attempting to connect...');
        await client.connect();
        console.log('✅ Connected successfully!');
        
        const result = await client.query('SELECT NOW() as current_time');
        console.log('Database time:', result.rows[0].current_time);
        
        await client.end();
        console.log('✅ Connection test completed successfully');
        return;
      } catch (error) {
        console.error(`❌ ${name} failed:`, error.message);
        await client.end().catch(() => {});
      }
    }
  } catch (error) {
    console.error('❌ All connection attempts failed');
  }
}

testConnection();