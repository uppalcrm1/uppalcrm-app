#!/usr/bin/env node

/**
 * Debug script for registration flow
 * Tests both marketing site and direct API calls
 */

const axios = require('axios');

// Test with marketing site format
async function testMarketingSiteFormat() {
  console.log('🎯 Testing Marketing Site Registration Format...\n');
  
  const marketingData = {
    firstName: 'John',
    lastName: 'Doe', 
    email: 'john.doe@example.com',
    company: 'Test Marketing Company',
    website: 'https://testmarketing.com'
  };
  
  console.log('📝 Marketing Form Data:', marketingData);
  
  // Simulate the marketing site logic
  function generateSecurePassword() {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
    
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
  
  function generateSlug(companyName) {
    return companyName
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }
  
  const temporaryPassword = generateSecurePassword();
  const organizationSlug = generateSlug(marketingData.company);
  
  console.log('🔐 Generated Password:', temporaryPassword);
  console.log('🏷️ Generated Slug:', organizationSlug);
  
  // Extract domain from website URL if provided
  let domainOnly = null;
  if (marketingData.website && marketingData.website.trim() !== '') {
    try {
      const url = new URL(marketingData.website.startsWith('http') ? marketingData.website : 'https://' + marketingData.website);
      domainOnly = url.hostname;
    } catch (e) {
      // If URL parsing fails, assume it's already a domain
      domainOnly = marketingData.website.replace(/^https?:\/\//, '').split('/')[0];
    }
  }

  const requestData = {
    organization: {
      name: marketingData.company,
      slug: organizationSlug,
      domain: domainOnly
    },
    admin: {
      email: marketingData.email.toLowerCase().trim(),
      password: temporaryPassword,
      first_name: marketingData.firstName.trim(),
      last_name: marketingData.lastName.trim()
    }
  };
  
  console.log('\n🚀 API Request Data:', JSON.stringify(requestData, null, 2));
  
  try {
    console.log('\n📤 Making request to API...');
    
    const response = await axios.post(
      'https://uppalcrm-api.onrender.com/api/auth/register',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'UppalCRM-Marketing-Site/1.0'
        },
        timeout: 45000
      }
    );
    
    console.log('✅ SUCCESS! Registration completed');
    console.log('Status:', response.status);
    console.log('Organization:', response.data.organization.name);
    console.log('User:', response.data.user.email);
    
    return { success: true, data: response.data, credentials: { email: marketingData.email, password: temporaryPassword, slug: organizationSlug } };
    
  } catch (error) {
    console.error('❌ FAILED! Registration error');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Headers:', error.response.headers);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:');
      console.error('Request config:', error.config?.url);
      console.error('Timeout:', error.config?.timeout);
    } else {
      console.error('Request setup error:', error.message);
    }
    
    return { success: false, error: error.message };
  }
}

async function testServerHealth() {
  console.log('🏥 Testing server connectivity...\n');
  
  try {
    const healthResponse = await axios.get('https://uppalcrm-api.onrender.com/health', {
      timeout: 10000
    });
    console.log('✅ Server health check: PASSED');
    return true;
  } catch (error) {
    console.log('❌ Server health check: FAILED');
    console.log('Error:', error.message);
    return false;
  }
}

async function testCORS() {
  console.log('🌐 Testing CORS configuration...\n');
  
  try {
    const response = await axios.options('https://uppalcrm-api.onrender.com/api/auth/register', {
      headers: {
        'Origin': 'https://uppalcrm-marketing.onrender.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      },
      timeout: 10000
    });
    
    console.log('✅ CORS preflight: SUCCESS');
    console.log('Access-Control-Allow-Origin:', response.headers['access-control-allow-origin']);
    return true;
  } catch (error) {
    console.log('⚠️ CORS preflight: May have issues');
    console.log('This could be normal if OPTIONS isn\'t specifically handled');
    return false;
  }
}

async function checkEmailServiceStatus() {
  console.log('📧 Checking email service status...\n');
  
  // Try to get some indication of email service status
  try {
    const response = await axios.get('https://uppalcrm-api.onrender.com/api/debug/email-status', {
      timeout: 10000
    });
    console.log('✅ Email service status retrieved');
    console.log('Status:', response.data);
    return true;
  } catch (error) {
    console.log('ℹ️ Email service status endpoint not available (this is normal)');
    return false;
  }
}

// Main debug execution
async function runDebug() {
  console.log('🔍 UppalCRM Registration Debug Suite');
  console.log('======================================\n');
  
  // 1. Test server connectivity
  const serverHealthy = await testServerHealth();
  if (!serverHealthy) {
    console.log('\n❌ Server is not responding. Check Render deployment status.');
    return;
  }
  
  // 2. Test CORS
  await testCORS();
  
  // 3. Check email service
  await checkEmailServiceStatus();
  
  // 4. Test registration with marketing site format
  const result = await testMarketingSiteFormat();
  
  console.log('\n📊 Debug Summary:');
  console.log('==================');
  
  if (result.success) {
    console.log('✅ Registration API: WORKING');
    console.log('✅ Request Format: CORRECT');
    console.log('✅ Server Response: VALID');
    
    console.log('\n🔍 If you\'re not receiving emails, check:');
    console.log('1. Render environment variables for SMTP settings');
    console.log('2. Brevo account status and SMTP key');
    console.log('3. Spam/junk folder in your email');
    console.log('4. Render logs for email service errors');
    
    console.log('\n🧪 Test these credentials:');
    console.log('Email:', result.credentials.email);
    console.log('Password:', result.credentials.password);
    console.log('Login URL: https://uppalcrm-frontend.onrender.com/login?org=' + result.credentials.slug);
    
  } else {
    console.log('❌ Registration API: FAILED');
    console.log('❌ Error:', result.error);
    
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Check if Render service is deployed and running');
    console.log('2. Verify API endpoint URL is correct');
    console.log('3. Check request format matches backend expectations');
    console.log('4. Review backend validation rules');
  }
  
  console.log('\n💡 Next steps:');
  console.log('- Check Render deployment logs');
  console.log('- Verify environment variables are set');
  console.log('- Test from actual marketing site');
}

// Run debug
if (require.main === module) {
  runDebug().then(() => {
    console.log('\n✨ Debug completed!');
    process.exit(0);
  }).catch(err => {
    console.error('\n💥 Debug failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testMarketingSiteFormat, testServerHealth };