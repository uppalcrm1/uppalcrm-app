#!/usr/bin/env node

/**
 * Test script to simulate the marketing website form submission
 * This tests the exact same flow as the marketing website
 */

const axios = require('axios');

// Test data that would come from the marketing form
const timestamp = Date.now();
const marketingFormData = {
  firstName: 'Sarah',
  lastName: 'Wilson',
  email: `uppalcrm1+${timestamp}@gmail.com`,
  company: `Wilson Digital Solutions ${timestamp}`,
  website: 'https://wilsondigital.com'
};

// Generate secure temporary password (same logic as marketing site)
function generateSecurePassword() {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special char
  
  // Fill remaining length
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

// Generate slug from company name (alphanumeric only)
function generateSlug(companyName) {
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove all special characters
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric characters
}

async function testMarketingFormSubmission() {
  console.log('🎯 Testing Marketing Website Form Submission...\n');
  
  try {
    console.log('📝 Form Data:', marketingFormData);
    
    // Generate secure temporary password
    const temporaryPassword = generateSecurePassword();
    
    // Generate organization slug from company name
    const organizationSlug = generateSlug(marketingFormData.company);
    
    // Extract domain from website URL if provided
    let domainOnly = null;
    if (marketingFormData.website && marketingFormData.website.trim() !== '') {
      try {
        const url = new URL(marketingFormData.website.startsWith('http') ? marketingFormData.website : 'https://' + marketingFormData.website);
        domainOnly = url.hostname;
      } catch (e) {
        // If URL parsing fails, assume it's already a domain
        domainOnly = marketingFormData.website.replace(/^https?:\/\//, '').split('/')[0];
      }
    }

    // Format data according to API requirements (same as marketing site)
    const requestData = {
      organization: {
        name: marketingFormData.company,
        slug: organizationSlug,
        domain: domainOnly
      },
      admin: {
        email: marketingFormData.email.toLowerCase().trim(),
        password: temporaryPassword,
        first_name: marketingFormData.firstName.trim(),
        last_name: marketingFormData.lastName.trim()
      }
    };
    
    console.log('\n🔐 Generated Password:', temporaryPassword);
    console.log('🏷️ Generated Slug:', organizationSlug);
    console.log('🌐 Extracted Domain:', domainOnly);
    console.log('\n🚀 API Request:', {
      ...requestData,
      admin: { ...requestData.admin, password: '[HIDDEN]' }
    });
    
    // Make API call to registration endpoint
    const response = await axios.post(
      'https://uppalcrm-api.onrender.com/api/auth/register',
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'UppalCRM-Marketing-Site/1.0'
        },
        timeout: 30000
      }
    );
    
    console.log('\n✅ Registration successful!');
    console.log('Status:', response.status);
    console.log('Organization:', response.data.organization.name);
    console.log('User:', response.data.user.email);
    console.log('Slug:', response.data.organization.slug);
    
    // Construct login URL
    const loginUrl = `https://uppalcrm-frontend.onrender.com/login?org=${response.data.organization.slug}`;
    
    console.log('\n🎉 SUCCESS! New CRM account created:');
    console.log('📧 Email:', marketingFormData.email);
    console.log('🔑 Temporary Password:', temporaryPassword);
    console.log('🔗 Login URL:', loginUrl);
    console.log('\n📧 Check your email for the welcome message with these credentials!');
    
    return {
      success: true,
      credentials: {
        email: marketingFormData.email,
        password: temporaryPassword,
        slug: organizationSlug,
        loginUrl: loginUrl
      }
    };
    
  } catch (error) {
    console.error('\n❌ Registration failed!');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Error:', error.response.data.message || error.response.data.error);
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received - server may be down');
    } else {
      console.error('Error:', error.message);
    }
    
    return { success: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  testMarketingFormSubmission().then((result) => {
    console.log('\n📊 Test Summary:');
    console.log('=================');
    
    if (result.success) {
      console.log('✅ Marketing form simulation: SUCCESS');
      console.log('✅ Account creation: COMPLETED');
      console.log('✅ Login credentials generated: YES');
      console.log('\n🎯 Next Steps:');
      console.log('1. Check your email for the welcome message');
      console.log('2. Test login at the provided URL');
      console.log('3. Verify all CRM features are working');
    } else {
      console.log('❌ Marketing form simulation: FAILED');
      console.log('❌ Error:', result.error);
    }
    
    console.log('\n✨ Test completed!');
    process.exit(result.success ? 0 : 1);
  }).catch(err => {
    console.error('\n💥 Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { testMarketingFormSubmission };