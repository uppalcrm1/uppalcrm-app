const axios = require('axios');

async function testProduction() {
  console.log('🚀 Testing Production Deployment');
  console.log('══════════════════════════════════');
  
  const API_BASE = 'https://uppalcrm-api.onrender.com/api';
  const FRONTEND_URL = 'https://uppalcrm-frontend.onrender.com';
  
  try {
    // Test 1: API Health
    console.log('1️⃣ Testing API health...');
    const healthResponse = await axios.get('https://uppalcrm-api.onrender.com/health');
    console.log('✅ Backend API is healthy');
    console.log(`📊 Status: ${healthResponse.data.status}`);
    console.log(`⏰ Timestamp: ${healthResponse.data.timestamp}`);
    
    // Test 2: API Documentation
    console.log('\n2️⃣ Testing API documentation...');
    const apiResponse = await axios.get(`${API_BASE}`);
    console.log('✅ API documentation accessible');
    console.log(`📋 Available endpoints: ${Object.keys(apiResponse.data.endpoints).length}`);
    console.log(`🔗 Contacts endpoints: ${Object.keys(apiResponse.data.endpoints.contacts).length} routes`);
    
    // Test 3: Frontend accessibility
    console.log('\n3️⃣ Testing frontend...');
    const frontendResponse = await axios.get(FRONTEND_URL);
    console.log('✅ Frontend is accessible');
    console.log(`📄 Response length: ${frontendResponse.data.length} characters`);
    
    // Test 4: Database connection (attempt organization creation)
    console.log('\n4️⃣ Testing database connection...');
    const testOrg = {
      organization: {
        name: `Production Test ${Date.now()}`,
        slug: `prodtest${Date.now()}`
      },
      admin: {
        email: `test${Date.now()}@production.com`,
        password: 'ProductionTest123!',
        first_name: 'Production',
        last_name: 'Test'
      }
    };
    
    try {
      const orgResponse = await axios.post(`${API_BASE}/auth/register`, testOrg);
      console.log('✅ Database is working - Organization created');
      console.log(`🏢 Organization: ${orgResponse.data.organization.name}`);
      console.log(`👤 Admin: ${orgResponse.data.user.full_name}`);
      console.log('🎉 FULL SYSTEM OPERATIONAL!');
      
      // Test contact creation
      console.log('\n5️⃣ Testing contact management...');
      const headers = {
        'Authorization': `Bearer ${orgResponse.data.token}`,
        'X-Organization-Slug': orgResponse.data.organization.slug,
        'Content-Type': 'application/json'
      };
      
      const contactData = {
        first_name: 'Production',
        last_name: 'Contact',
        email: `contact${Date.now()}@production.com`,
        company: 'Production Testing Inc'
      };
      
      const contactResponse = await axios.post(`${API_BASE}/contacts`, contactData, { headers });
      console.log('✅ Contact management working');
      console.log(`👤 Contact created: ${contactResponse.data.contact.full_name}`);
      
    } catch (dbError) {
      console.log('❌ Database needs setup');
      console.log(`📋 Error: ${dbError.response?.data?.message || dbError.message}`);
      console.log('🔧 Need to run database migrations');
    }
    
    console.log('\n📊 DEPLOYMENT STATUS SUMMARY:');
    console.log('✅ Backend API: DEPLOYED & RUNNING');
    console.log('✅ Frontend: DEPLOYED & ACCESSIBLE');
    console.log('✅ Health Checks: PASSING');
    console.log('⚠️ Database: May need migrations');
    
    console.log('\n🌐 Your Live URLs:');
    console.log(`🔗 Frontend: ${FRONTEND_URL}`);
    console.log(`🔗 Backend API: ${API_BASE}`);
    console.log(`🔗 API Docs: ${API_BASE}`);
    
  } catch (error) {
    console.error('💥 Production test failed:', error.message);
    if (error.response) {
      console.error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    }
  }
}

testProduction();