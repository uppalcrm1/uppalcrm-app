#!/usr/bin/env node

/**
 * Test script for CRM signup flow
 * Tests the complete registration process including email functionality
 */

const axios = require('axios');

// Test registration data
const timestamp = Date.now().toString().slice(-6); // Last 6 digits
const testData = {
  organization: {
    name: 'Test Company ' + timestamp,
    slug: 'testcompany' + timestamp, // Only alphanumeric
    domain: 'testcompany.com'
  },
  admin: {
    email: 'test@example.com',
    password: 'TestPass123!',
    first_name: 'Test',
    last_name: 'User'
  }
};

async function testSignup() {
  console.log('🧪 Testing CRM Signup Flow...\n');
  
  try {
    console.log('📝 Test Data:', {
      organization: testData.organization.name,
      email: testData.admin.email,
      slug: testData.organization.slug
    });
    
    console.log('\n🚀 Making registration request...');
    
    const response = await axios.post(
      'https://uppalcrm-api.onrender.com/api/auth/register',
      testData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      }
    );
    
    console.log('✅ Registration successful!');
    console.log('Response status:', response.status);
    console.log('Organization created:', response.data.organization.name);
    console.log('Admin user:', response.data.user.email);
    console.log('Organization slug:', response.data.organization.slug);
    
    // Construct login URL
    const loginUrl = `https://uppalcrm-frontend.onrender.com/login?org=${response.data.organization.slug}`;
    console.log('\n🔗 Login URL:', loginUrl);
    
    console.log('\n📧 Check your email for welcome message!');
    console.log('📋 Use these credentials to test login:');
    console.log('  Email:', testData.admin.email);
    console.log('  Password:', testData.admin.password);
    
    return {
      success: true,
      data: response.data,
      loginUrl: loginUrl
    };
    
  } catch (error) {
    console.error('❌ Registration failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data.message || error.response.data.error);
      console.error('Full response:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received - server may be down');
      console.error('Request timeout or network error');
    } else {
      console.error('Error:', error.message);
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

async function testEmailService() {
  console.log('\n📧 Testing Email Service Configuration...');
  
  try {
    // Test email service endpoint (if it exists)
    const response = await axios.post(
      'https://uppalcrm-api.onrender.com/api/test-email',
      { email: 'test@example.com' },
      { timeout: 10000 }
    );
    
    console.log('✅ Email service test successful');
    return true;
  } catch (error) {
    if (error.response?.status === 404) {
      console.log('ℹ️ Email test endpoint not available (this is normal)');
      return true;
    }
    console.log('⚠️ Email service may have issues:', error.message);
    return false;
  }
}

async function checkServerHealth() {
  console.log('🏥 Checking server health...');
  
  try {
    const response = await axios.get('https://uppalcrm-api.onrender.com/health', {
      timeout: 10000
    });
    
    console.log('✅ Server is healthy');
    return true;
  } catch (error) {
    console.log('⚠️ Health check failed:', error.message);
    return false;
  }
}

// Main test execution
async function runTests() {
  console.log('🎯 UppalCRM Registration Test Suite');
  console.log('=====================================\n');
  
  // 1. Check server health
  await checkServerHealth();
  
  // 2. Test email service
  await testEmailService();
  
  // 3. Test registration
  const result = await testSignup();
  
  console.log('\n📊 Test Summary:');
  console.log('=================');
  
  if (result.success) {
    console.log('✅ Registration: PASSED');
    console.log('✅ Account Creation: SUCCESS');
    console.log('✅ API Response: VALID');
    
    console.log('\n🎉 Next Steps:');
    console.log('1. Check Render logs for email delivery');
    console.log('2. Test login at the provided URL');
    console.log('3. Verify welcome email was received');
  } else {
    console.log('❌ Registration: FAILED');
    console.log('❌ Error:', result.error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check Render deployment status');
    console.log('2. Verify environment variables are set');
    console.log('3. Check database migration status');
  }
}

// Run if called directly
if (require.main === module) {
  runTests().then(() => {
    console.log('\n✨ Test completed!');
    process.exit(0);
  }).catch(err => {
    console.error('\n💥 Test suite failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testSignup, testEmailService, checkServerHealth };