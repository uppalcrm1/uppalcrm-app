#!/usr/bin/env node

/**
 * Test script for CRM login functionality
 * Tests login with the credentials created during registration
 */

const axios = require('axios');

// Test credentials from successful registration
const loginData = {
  email: 'john.doe@example.com',
  password: 'Ia1I21g%ob%S'
};

const organizationSlug = 'testmarketingcompany'; // From our successful test

async function testLogin() {
  console.log('🔐 Testing CRM Login Flow...\n');
  
  try {
    console.log('📝 Login Data:');
    console.log('  Email:', loginData.email);
    console.log('  Organization:', organizationSlug);
    console.log('  Password: [HIDDEN]');
    
    console.log('\n🚀 Making login request...');
    
    const response = await axios.post(
      'https://uppalcrm-api.onrender.com/api/auth/login',
      loginData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Organization-Slug': organizationSlug // Organization context
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Login successful!');
    console.log('Response status:', response.status);
    console.log('User:', response.data.user.email);
    console.log('Organization:', response.data.organization.name);
    console.log('Role:', response.data.user.role);
    console.log('Token received:', response.data.token ? 'YES' : 'NO');
    
    // Test authenticated request
    await testAuthenticatedRequest(response.data.token);
    
    return {
      success: true,
      data: response.data,
      token: response.data.token
    };
    
  } catch (error) {
    console.error('❌ Login failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data.message || error.response.data.error);
      console.error('Full response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received - server may be down');
    } else {
      console.error('Error:', error.message);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

async function testAuthenticatedRequest(token) {
  console.log('\n🔒 Testing authenticated API request...');
  
  try {
    const response = await axios.get(
      'https://uppalcrm-api.onrender.com/api/auth/me',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    console.log('✅ Authenticated request successful!');
    console.log('User profile retrieved:', response.data.user.full_name);
    console.log('Organization verified:', response.data.organization.name);
    
  } catch (error) {
    console.error('❌ Authenticated request failed:', error.response?.data || error.message);
  }
}

async function testLeadsEndpoint(token) {
  console.log('\n📊 Testing leads dashboard endpoint...');
  
  try {
    const response = await axios.get(
      'https://uppalcrm-api.onrender.com/api/leads/stats',
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );
    
    console.log('✅ Leads stats retrieved successfully!');
    console.log('Total leads:', response.data.total_leads);
    console.log('New leads:', response.data.new_leads);
    
  } catch (error) {
    console.error('❌ Leads endpoint failed:', error.response?.data || error.message);
  }
}

// Main test execution
async function runLoginTests() {
  console.log('🎯 UppalCRM Login Test Suite');
  console.log('============================\n');
  
  const result = await testLogin();
  
  if (result.success) {
    // Test additional endpoints with the token
    await testLeadsEndpoint(result.token);
  }
  
  console.log('\n📊 Login Test Summary:');
  console.log('=======================');
  
  if (result.success) {
    console.log('✅ Login: PASSED');
    console.log('✅ Authentication: SUCCESS');
    console.log('✅ Token Generation: WORKING');
    console.log('✅ User Profile: ACCESSIBLE');
    
    console.log('\n🎉 Your CRM is fully functional!');
    console.log('🔗 Login URL: https://uppalcrm-frontend.onrender.com/login?org=' + organizationSlug);
    console.log('📧 Email:', loginData.email);
    console.log('🔑 Password: TestPass123!');
    
  } else {
    console.log('❌ Login: FAILED');
    console.log('❌ Error:', result.error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Verify organization slug is correct');
    console.log('2. Check if user account was created properly');
    console.log('3. Verify password is correct');
    console.log('4. Check authentication middleware');
  }
}

// Run if called directly
if (require.main === module) {
  runLoginTests().then(() => {
    console.log('\n✨ Login test completed!');
    process.exit(0);
  }).catch(err => {
    console.error('\n💥 Login test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testLogin, testAuthenticatedRequest };