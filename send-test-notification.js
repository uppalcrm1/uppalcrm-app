#!/usr/bin/env node

/**
 * Send a direct email notification using our working email service
 */

// Load environment variables
require('dotenv').config();

const emailService = require('./services/emailService');

async function sendTestNotification() {
  console.log('📧 Sending test notification email...\n');
  
  try {
    // Initialize email service
    await emailService.initialize();
    
    if (!emailService.isAvailable()) {
      console.error('❌ Email service is not available');
      return;
    }
    
    console.log('✅ Email service initialized successfully');
    
    // Send lead notification
    console.log('\n📧 Sending lead notification email...');
    const result = await emailService.sendLeadNotification({
      leadName: 'Test Form Submission',
      leadEmail: 'test@example.com', 
      leadCompany: 'Test Company From Marketing Site',
      leadPhone: '+1-555-123-4567',
      leadMessage: 'This is a test to verify email notifications are working from your marketing site form submissions.',
      organizationName: 'Test Company From Marketing Site',
      utmSource: 'test',
      utmMedium: 'manual',
      utmCampaign: 'email-debug'
    });
    
    if (result) {
      console.log('✅ Lead notification email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      console.log('📧 Check your inbox at uppalcrm1@gmail.com');
    } else {
      console.log('❌ Failed to send lead notification email');
    }
    
  } catch (error) {
    console.error('❌ Email notification test failed:', error.message);
  }
}

// Run test
if (require.main === module) {
  sendTestNotification().then(() => {
    console.log('\n✨ Email notification test completed!');
    process.exit(0);
  }).catch(err => {
    console.error('\n💥 Email notification test error:', err.message);
    process.exit(1);
  });
}