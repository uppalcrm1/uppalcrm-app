const https = require('https');

async function debugContactCreation() {
  console.log('🔍 Debugging Production Contact Creation');
  console.log('════════════════════════════════════════');
  
  const API_BASE = 'https://uppalcrm-api.onrender.com';
  
  try {
    // Step 1: Create organization
    console.log('1️⃣ Creating test organization...');
    
    const orgData = JSON.stringify({
      organization: {
        name: `Debug Test ${Date.now()}`,
        slug: `debugtest${Date.now()}`
      },
      admin: {
        email: `debug${Date.now()}@test.com`,
        password: 'DebugTest123!',
        first_name: 'Debug',
        last_name: 'Test'
      }
    });

    const registerResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'uppalcrm-api.onrender.com',
        port: 443,
        path: '/api/auth/register',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(orgData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', reject);
      req.write(orgData);
      req.end();
    });

    console.log('✅ Organization created successfully');
    console.log(`🏢 Org: ${registerResponse.organization.name}`);
    
    const token = registerResponse.token;
    const orgSlug = registerResponse.organization.slug;
    
    // Step 2: Test with detailed contact data
    console.log('\n2️⃣ Testing detailed contact creation...');
    
    const contactData = JSON.stringify({
      title: 'Mr.',
      company: 'Debug Test Company',
      first_name: 'Debug',
      last_name: 'Contact',
      email: `debugcontact${Date.now()}@test.com`,
      phone: '+1-555-0123',
      status: 'prospect',
      type: 'customer',
      source: 'website',
      priority: 'medium',
      value: '1000.00',
      notes: 'Debug test contact created via production test'
    });

    const contactResponse = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'uppalcrm-api.onrender.com',
        port: 443,
        path: '/api/contacts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(contactData),
          'Authorization': `Bearer ${token}`,
          'X-Organization-Slug': orgSlug
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: data
          });
        });
      });

      req.on('error', reject);
      req.write(contactData);
      req.end();
    });

    console.log(`📋 Contact API Response:`);
    console.log(`   Status: ${contactResponse.statusCode}`);
    console.log(`   Headers: ${JSON.stringify(contactResponse.headers, null, 2)}`);
    console.log(`   Body: ${contactResponse.data}`);

    if (contactResponse.statusCode === 201) {
      console.log('🎉 SUCCESS: Contact creation is working!');
      const contact = JSON.parse(contactResponse.data);
      console.log(`👤 Created: ${contact.contact.full_name}`);
      
      // Test contact listing
      console.log('\n3️⃣ Testing contact listing...');
      const listResponse = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'uppalcrm-api.onrender.com',
          port: 443,
          path: '/api/contacts',
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Organization-Slug': orgSlug
          }
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

      if (listResponse.statusCode === 200) {
        const contacts = JSON.parse(listResponse.data);
        console.log(`✅ Contact listing works: ${contacts.contacts.length} contacts found`);
      } else {
        console.log(`❌ Contact listing failed: ${listResponse.statusCode}`);
        console.log(`   Response: ${listResponse.data}`);
      }
      
    } else {
      console.log('❌ FAILED: Contact creation not working');
      console.log(`   Full response: ${contactResponse.data}`);
      
      // Try to parse error details
      try {
        const errorData = JSON.parse(contactResponse.data);
        console.log(`   Parsed error: ${JSON.stringify(errorData, null, 2)}`);
      } catch (e) {
        console.log(`   Raw error text: ${contactResponse.data}`);
      }
    }
    
  } catch (error) {
    console.error('💥 Debug test failed:', error.message);
    if (error.response) {
      console.error(`   HTTP ${error.response.status}: ${error.response.data}`);
    }
  }
}

debugContactCreation();