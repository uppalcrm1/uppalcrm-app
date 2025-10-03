#!/usr/bin/env node

/**
 * Test script for trial confirmation email
 * This script tests sending a trial confirmation email to a customer
 */

require('dotenv').config();
const emailService = require('../services/emailService');

async function testTrialConfirmationEmail() {
  console.log('🧪 Testing Trial Confirmation Email');
  console.log('====================================\n');

  try {
    // Initialize email service
    console.log('📧 Initializing email service...');
    await emailService.initialize();

    if (!emailService.isAvailable()) {
      console.error('❌ Email service is not available');
      console.log('\nPlease check your environment variables:');
      console.log('- SMTP_HOST');
      console.log('- SMTP_PORT');
      console.log('- SMTP_USER');
      console.log('- SMTP_PASS');
      console.log('- FROM_EMAIL');
      process.exit(1);
    }

    console.log('✅ Email service initialized\n');

    // Test data
    const testData = {
      customerName: 'John Doe',
      customerEmail: 'uppalcrm1@gmail.com', // Send to your own email for testing
      company: 'Acme Corporation'
    };

    console.log('📤 Sending trial confirmation email...');
    console.log(`To: ${testData.customerEmail}`);
    console.log(`Customer: ${testData.customerName}`);
    console.log(`Company: ${testData.company}\n`);

    // Send the email
    const result = await emailService.sendTrialConfirmation(testData);

    if (result) {
      console.log('✅ Trial confirmation email sent successfully!');
      console.log(`Message ID: ${result.messageId}`);
      console.log('\n📬 Check your inbox at:', testData.customerEmail);
    } else {
      console.error('❌ Failed to send trial confirmation email');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the test
testTrialConfirmationEmail();
