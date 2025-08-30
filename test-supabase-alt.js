const { Client } = require('pg');
const dns = require('dns');
require('dotenv').config();

// Use Google's DNS servers to try resolving
dns.setServers(['8.8.8.8', '8.8.4.4']);

async function testWithPublicDNS() {
  const hostname = 'db.smzamnifaboqkjulrtqj.supabase.co';
  
  return new Promise((resolve, reject) => {
    console.log('Using Google DNS (8.8.8.8) to resolve hostname...');
    
    dns.resolve4(hostname, (err, addresses) => {
      if (err) {
        console.error('❌ Google DNS IPv4 resolution failed:', err.message);
        
        dns.resolve6(hostname, (err6, addresses6) => {
          if (err6) {
            console.error('❌ Google DNS IPv6 resolution also failed:', err6.message);
            reject(err);
          } else {
            console.log('✅ IPv6 addresses found via Google DNS:', addresses6);
            resolve(addresses6[0]);
          }
        });
      } else {
        console.log('✅ IPv4 addresses found via Google DNS:', addresses);
        resolve(addresses[0]);
      }
    });
  });
}

async function testDirectIP() {
  try {
    console.log('Testing connection with direct IP...');
    const ip = await testWithPublicDNS();
    
    const client = new Client({
      host: ip,
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: 'Beautifulmind611$',
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Connected successfully with direct IP!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('Database time:', result.rows[0].current_time);
    
    await client.end();
    return true;
  } catch (error) {
    console.error('❌ Direct IP connection failed:', error.message);
    return false;
  }
}

async function testAlternativeHostnames() {
  // Sometimes there might be variations in hostname
  const hostVariations = [
    'db.smzamnifaboqkjulrtqj.supabase.co',
    'db.smzamnifaboqkjulrtq.supabase.co', // without 'j'
    'aws-0-us-west-1.pooler.supabase.com', // alternative pooler
  ];

  for (const host of hostVariations) {
    console.log(`\nTrying hostname variation: ${host}`);
    
    try {
      const client = new Client({
        host: host,
        port: 5432,
        database: 'postgres',
        user: 'postgres',
        password: 'Beautifulmind611$',
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000
      });

      await client.connect();
      console.log('✅ Connected successfully!');
      
      const result = await client.query('SELECT NOW() as current_time');
      console.log('Database time:', result.rows[0].current_time);
      
      await client.end();
      
      // Update .env with working hostname
      console.log(`\n🎉 Working hostname found: ${host}`);
      console.log('Update your .env file with this hostname.');
      return host;
      
    } catch (error) {
      console.error(`❌ Failed with ${host}:`, error.message);
      try { await client.end(); } catch {}
    }
  }
  
  return null;
}

async function main() {
  console.log('🔍 Advanced Supabase Connection Troubleshooting\n');
  
  // Try different approaches
  console.log('1. Testing with public DNS...');
  const dnsSuccess = await testDirectIP().catch(() => false);
  
  if (!dnsSuccess) {
    console.log('\n2. Testing hostname variations...');
    const workingHost = await testAlternativeHostnames();
    
    if (!workingHost) {
      console.log('\n❌ All connection attempts failed.');
      console.log('\n📋 Next steps:');
      console.log('1. Verify your Supabase project is active');
      console.log('2. Check your internet connection');
      console.log('3. Try connecting from Supabase dashboard directly');
      console.log('4. Consider using a local PostgreSQL database for development');
    }
  }
}

main();