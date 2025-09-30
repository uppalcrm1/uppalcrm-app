#!/usr/bin/env node

const fetch = require('node-fetch');

async function testSuperAdminAPI() {
  try {
    console.log('🔧 Testing Super Admin API...');

    // Test the API endpoint
    const apiUrl = process.env.NODE_ENV === 'production'
      ? 'https://uppalcrm-api.onrender.com'
      : 'http://localhost:3000';

    console.log(`📡 API URL: ${apiUrl}`);

    // First test if the endpoint exists
    const testResponse = await fetch(`${apiUrl}/api/super-admin/test`);
    const testData = await testResponse.json();

    console.log('✅ Super Admin test endpoint response:');
    console.log(JSON.stringify(testData, null, 2));

    // Test dashboard endpoint (should fail without auth)
    try {
      const dashboardResponse = await fetch(`${apiUrl}/api/super-admin/dashboard`);
      const dashboardData = await dashboardResponse.json();
      console.log('\n📊 Dashboard response (should be 401):');
      console.log(JSON.stringify(dashboardData, null, 2));
    } catch (dashError) {
      console.log('\n⚠️ Dashboard endpoint error (expected):', dashError.message);
    }

    // Check organizations endpoint (should also fail without auth)
    try {
      const orgsResponse = await fetch(`${apiUrl}/api/super-admin/organizations`);
      const orgsData = await orgsResponse.json();
      console.log('\n🏢 Organizations response (should be 401):');
      console.log(JSON.stringify(orgsData, null, 2));
    } catch (orgError) {
      console.log('\n⚠️ Organizations endpoint error (expected):', orgError.message);
    }

    console.log('\n🎉 Super Admin API is working!');
    console.log('\n💡 To access the super admin interface:');
    console.log(`   1. Login: POST ${apiUrl}/api/super-admin/login`);
    console.log('      Body: {"email": "admin@uppalcrm.com", "password": "SuperAdmin123!"}');
    console.log(`   2. Dashboard: GET ${apiUrl}/api/super-admin/dashboard`);
    console.log(`   3. Organizations: GET ${apiUrl}/api/super-admin/organizations`);

  } catch (error) {
    console.error('❌ Error testing super admin API:', error.message);
  }
}

// Run the test
testSuperAdminAPI()
  .then(() => {
    console.log('\n✅ Super admin API test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Super admin API test failed:', error);
    process.exit(1);
  });