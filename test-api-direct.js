const https = require('https');

async function testAPIDirect() {
  console.log('🔍 Testing Direct API Access');
  console.log('═════════════════════════════');
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing API health...');
    const healthResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'uppalcrm-api.onrender.com',
        port: 443,
        path: '/health',
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log(`✅ Health check: ${healthResponse.statusCode}`);
    console.log(`📋 Response: ${healthResponse.data}`);

    // Test 2: Try a simple database query endpoint
    console.log('\n2️⃣ Testing organizations endpoint...');
    const orgResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'uppalcrm-api.onrender.com',
        port: 443,
        path: '/api/organizations',
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log(`📋 Organizations endpoint: ${orgResponse.statusCode}`);
    if (orgResponse.statusCode === 200) {
      console.log(`✅ Organizations endpoint working`);
    } else {
      console.log(`❌ Organizations endpoint error: ${orgResponse.data}`);
    }

    // Test 3: Try to see what contacts endpoint says without auth
    console.log('\n3️⃣ Testing contacts endpoint (should require auth)...');
    const contactsResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'uppalcrm-api.onrender.com',
        port: 443,
        path: '/api/contacts',
        method: 'GET'
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.end();
    });

    console.log(`📋 Contacts endpoint: ${contactsResponse.statusCode}`);
    console.log(`📄 Response: ${contactsResponse.data}`);

    // Check if it's a 401 (auth required) vs 500 (server error)
    if (contactsResponse.statusCode === 401) {
      console.log('✅ Contacts endpoint exists and requires auth (good!)');
    } else if (contactsResponse.statusCode === 500) {
      console.log('❌ Contacts endpoint has server error (database issue)');
    } else {
      console.log(`ℹ️  Contacts endpoint returned: ${contactsResponse.statusCode}`);
    }

  } catch (error) {
    console.error('💥 API test failed:', error.message);
  }
}

testAPIDirect();