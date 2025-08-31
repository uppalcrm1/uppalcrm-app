#!/usr/bin/env node

/**
 * Test script to verify Brevo SMTP configuration
 */

// Load environment variables
require('dotenv').config();

const emailService = require('./services/emailService');

async function testEmailService() {
  console.log('🧪 Testing Brevo SMTP Configuration...\n');
  
  // Debug environment variables
  console.log('Environment Variables:');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? `[${process.env.SMTP_PASS.length} characters]` : 'NOT SET');
  console.log('FROM_EMAIL:', process.env.FROM_EMAIL);
  console.log('FROM_NAME:', process.env.FROM_NAME);
  console.log();
  
  try {
    // Initialize email service
    await emailService.initialize();
    
    if (!emailService.isAvailable()) {
      console.error('❌ Email service is not available');
      return;
    }
    
    console.log('✅ Email service initialized successfully');
    
    // Test sending a welcome email
    console.log('\n📧 Testing welcome email...');
    const result = await emailService.sendWelcomeEmail({
      organizationName: 'Test Organization',
      adminEmail: 'uppalcrm1@gmail.com',
      adminName: 'Test Admin',
      loginUrl: 'https://uppalcrm-frontend.onrender.com/login?org=testorg',
      temporaryPassword: 'TestPass123!',
      organizationSlug: 'testorg'
    });
    
    if (result) {
      console.log('✅ Welcome email sent successfully!');
      console.log('📧 Check your inbox at uppalcrm1@gmail.com');
    } else {
      console.log('❌ Failed to send welcome email');
    }
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
  }
}

// Run test
if (require.main === module) {
  testEmailService().then(() => {
    console.log('\n✨ Email test completed!');
    process.exit(0);
  }).catch(err => {
    console.error('\n💥 Email test error:', err.message);
    process.exit(1);
  });
}