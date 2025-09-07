const https = require('https');

async function testSimpleContactCreation() {
  console.log('🧪 Testing Simple Contact Creation');
  console.log('═══════════════════════════════════');
  
  try {
    // Step 1: Create organization first
    console.log('1️⃣ Creating organization...');
    
    const orgData = JSON.stringify({
      organization: {
        name: `Simple Test ${Date.now()}`,
        slug: `simpletest${Date.now()}`
      },
      admin: {
        email: `simple${Date.now()}@test.com`,
        password: 'SimpleTest123!',
        first_name: 'Simple',
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

    console.log('✅ Organization created');
    const token = registerResponse.token;
    const orgSlug = registerResponse.organization.slug;

    // Step 2: Try minimal contact creation
    console.log('\n2️⃣ Creating minimal contact...');
    
    const contactData = JSON.stringify({
      first_name: 'Test',
      last_name: 'Contact',
      email: `testcontact${Date.now()}@example.com`
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
            data: data
          });
        });
      });

      req.on('error', reject);
      req.write(contactData);
      req.end();
    });

    console.log(`📋 Contact creation response: ${contactResponse.statusCode}`);
    console.log(`📄 Response data: ${contactResponse.data}`);

    if (contactResponse.statusCode === 201) {
      console.log('🎉 SUCCESS: Contact creation is working!');
      const contact = JSON.parse(contactResponse.data);
      console.log(`👤 Created contact: ${JSON.stringify(contact, null, 2)}`);
    } else {
      console.log('❌ FAILED: Contact creation still not working');
      try {
        const errorData = JSON.parse(contactResponse.data);
        console.log(`   Parsed error: ${JSON.stringify(errorData, null, 2)}`);
      } catch (e) {
        console.log(`   Raw error: ${contactResponse.data}`);
      }
    }

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testSimpleContactCreation();