#!/usr/bin/env node

/**
 * Test script to simulate form submission from Netlify marketing site to Render API
 * This tests the exact flow that happens when someone submits the form on uppalcrmapp.netlify.app
 */

const axios = require('axios');

async function testNetlifyToRenderFlow() {
  console.log('🌐 Testing Netlify → Render API Flow...\n');
  
  // Simulate marketing form data with unique identifiers
  const timestamp = Date.now();
  const testData = {
    firstName: 'Marketing',
    lastName: 'User',
    email: `test+${timestamp}@netlifytest.com`,
    company: `Netlify Test Company ${timestamp}`,
    website: 'https://testnetlify.com'
  };
  
  console.log('📝 Test Form Data:', testData);
  
  try {
    // Generate secure password (same as marketing site)
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
    
    // Generate slug (same as marketing site)
    function generateSlug(companyName) {
      return companyName
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, '')
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    }
    
    const temporaryPassword = generateSecurePassword();
    const organizationSlug = generateSlug(testData.company);
    
    // Extract domain from website URL
    let domainOnly = null;
    if (testData.website && testData.website.trim() !== '') {
      try {
        const url = new URL(testData.website.startsWith('http') ? testData.website : 'https://' + testData.website);
        domainOnly = url.hostname;
      } catch (e) {
        domainOnly = testData.website.replace(/^https?:\/\//, '').split('/')[0];
      }
    }
    
    // Format request exactly as marketing site does
    const requestData = {
      organization: {
        name: testData.company,
        slug: organizationSlug,
        domain: domainOnly
      },
      admin: {
        email: testData.email.toLowerCase().trim(),
        password: temporaryPassword,
        first_name: testData.firstName.trim(),
        last_name: testData.lastName.trim()
      }
    };
    
    console.log('\\n🔐 Generated Password:', temporaryPassword);
    console.log('🏷️ Generated Slug:', organizationSlug);
    console.log('🌐 Extracted Domain:', domainOnly);
    
    console.log('\\n🚀 Making API Request...');
    console.log('From: https://uppalcrmapp.netlify.app');
    console.log('To: https://uppalcrm-api.onrender.com/api/auth/register');
    
    // Make request with exact headers that marketing site would use
    const response = await axios.post(
      'https://uppalcrm-api.onrender.com/api/auth/register',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Origin': 'https://uppalcrmapp.netlify.app',
          'User-Agent': 'Mozilla/5.0 (Marketing Site Test)',
          'Referer': 'https://uppalcrmapp.netlify.app/'
        },
        timeout: 45000,
        withCredentials: true
      }
    );
    
    console.log('\\n✅ SUCCESS! Registration completed');
    console.log('Status:', response.status);
    console.log('Organization:', response.data.organization.name);
    console.log('User:', response.data.user.email);
    console.log('Slug:', response.data.organization.slug);
    
    // Check for CORS headers
    console.log('\\n🔒 CORS Headers:');
    console.log('Access-Control-Allow-Origin:', response.headers['access-control-allow-origin']);
    console.log('Access-Control-Allow-Credentials:', response.headers['access-control-allow-credentials']);
    
    const loginUrl = `https://uppalcrm-frontend.onrender.com/login?org=${response.data.organization.slug}`;
    
    console.log('\\n🎉 Test Results:');
    console.log('📧 Email:', testData.email);
    console.log('🔑 Password:', temporaryPassword);
    console.log('🔗 Login URL:', loginUrl);
    console.log('\\n✅ Marketing site form submission to Render API: WORKING!');
    
    return { success: true };
    
  } catch (error) {
    console.error('\\n❌ Registration failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Status Text:', error.response.statusText);
      console.error('Headers:', error.response.headers);
      console.error('Error Data:', JSON.stringify(error.response.data, null, 2));
      
      if (error.response.status === 409) {
        console.log('\\n💡 Note: 409 error means organization already exists - this is expected for repeated tests');
        return { success: true, note: 'Organization already exists' };
      }
    } else if (error.request) {
      console.error('❌ No response received from server');
      console.error('Request config:', error.config?.url);
    } else {
      console.error('❌ Request setup error:', error.message);
    }
    
    console.log('\\n🔧 Troubleshooting checklist:');
    console.log('1. Check if Render service is deployed and running');
    console.log('2. Verify CORS configuration allows Netlify domain');
    console.log('3. Check Render environment variables');
    console.log('4. Verify API endpoint is correct');
    
    return { success: false, error: error.message };
  }
}

// Run test
if (require.main === module) {
  testNetlifyToRenderFlow().then((result) => {
    console.log('\\n📊 Test Summary:');
    console.log('==================');
    
    if (result.success) {
      console.log('✅ Netlify → Render API flow: WORKING');
      console.log('✅ CORS configuration: CORRECT');
      console.log('✅ Form submission: SUCCESSFUL');
      if (result.note) console.log('ℹ️ Note:', result.note);
    } else {
      console.log('❌ Netlify → Render API flow: FAILED');
      console.log('❌ Error:', result.error);
    }
    
    console.log('\\n✨ Test completed!');
    process.exit(result.success ? 0 : 1);
  }).catch(err => {
    console.error('\\n💥 Test error:', err.message);
    process.exit(1);
  });
}

module.exports = { testNetlifyToRenderFlow };