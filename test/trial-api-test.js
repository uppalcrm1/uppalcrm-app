#!/usr/bin/env node

const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:3003/api';

async function testTrialAPI() {
  console.log('🧪 Testing Trial Management API...\n');

  try {
    // Test 1: Check trial eligibility without authentication (should fail)
    console.log('1. Testing unauthenticated request...');
    try {
      await axios.get(`${API_BASE_URL}/trials/check-eligibility`);
      console.log('❌ Should have failed without authentication');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Correctly rejected unauthenticated request');
      } else {
        console.log('❌ Unexpected error:', error.response?.data || error.message);
      }
    }

    // Test 2: Register a test organization
    console.log('\n2. Creating test organization...');
    const timestamp = Date.now();
    const orgData = {
      organization: {
        name: `Test Org ${timestamp}`,
        slug: `testorg${timestamp}`,
        domain: `test${timestamp}.example.com`
      },
      admin: {
        first_name: 'Trial',
        last_name: 'Admin',
        email: `admin+${timestamp}@example.com`,
        password: 'TestPassword123!'
      }
    };

    const registerResponse = await axios.post(`${API_BASE_URL}/auth/register`, orgData);
    
    if (registerResponse.data.token && registerResponse.data.organization) {
      console.log('✅ Test organization created successfully');
      console.log(`   Organization: ${registerResponse.data.organization.name}`);
      const authToken = registerResponse.data.token;
      const orgSlug = registerResponse.data.organization.slug;

      // Test 3: Check trial eligibility with authentication
      console.log('\n3. Testing trial eligibility...');
      try {
        const eligibilityResponse = await axios.get(`${API_BASE_URL}/trials/check-eligibility`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Organization-Slug': orgSlug
          }
        });
        
        console.log('✅ Trial eligibility check successful');
        console.log(`   Eligible: ${eligibilityResponse.data.eligible}`);
      } catch (error) {
        console.log('❌ Trial eligibility failed:', error.response?.data?.message || error.message);
      }

      // Test 4: Get trial status
      console.log('\n4. Testing trial status...');
      try {
        const statusResponse = await axios.get(`${API_BASE_URL}/trials/status`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Organization-Slug': orgSlug
          }
        });
        
        console.log('✅ Trial status check successful');
        console.log(`   Status: ${statusResponse.data.trial?.trial_status || 'No trial'}`);
      } catch (error) {
        console.log('❌ Trial status failed:', error.response?.data?.message || error.message);
      }

      // Test 5: Start a trial
      console.log('\n5. Testing trial start...');
      try {
        const startResponse = await axios.post(`${API_BASE_URL}/trials/start`, {
          trial_days: 30
        }, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Organization-Slug': orgSlug,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Trial start successful');
        console.log(`   Status: ${startResponse.data.trial?.trial_status}`);
        console.log(`   Days: ${startResponse.data.trial?.trial_days}`);
      } catch (error) {
        console.log('❌ Trial start failed:', error.response?.data?.message || error.message);
        if (error.response?.data?.details) {
          console.log('   Details:', JSON.stringify(error.response.data.details, null, 2));
        }
      }

      // Test 6: Extend the trial
      console.log('\n6. Testing trial extension...');
      try {
        const extendResponse = await axios.post(`${API_BASE_URL}/trials/extend`, {
          additional_days: 7
        }, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'X-Organization-Slug': orgSlug,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Trial extension successful');
        console.log(`   New total days: ${extendResponse.data.trial?.trial_days}`);
      } catch (error) {
        console.log('❌ Trial extension failed:', error.response?.data?.message || error.message);
        if (error.response?.data?.details) {
          console.log('   Details:', JSON.stringify(error.response.data.details, null, 2));
        }
      }

    } else {
      console.log('❌ Failed to create test organization');
    }

  } catch (error) {
    console.log('❌ Test setup failed:', error.response?.data || error.message);
  }
}

// Run the test
testTrialAPI().then(() => {
  console.log('\n🎯 Trial API test completed');
}).catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});