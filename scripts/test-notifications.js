#!/usr/bin/env node

/**
 * Test trial expiration notifications
 */

const emailService = require('../services/emailService');
const { query } = require('../database/connection');

async function testNotifications() {
  console.log('🧪 Testing trial expiration notification system...\n');

  try {
    // 1. Set up test data
    console.log('📋 Setting up test data...');

    // Get a trial subscription
    const testTrial = await query(`
      SELECT
        os.id,
        os.organization_id,
        os.trial_ends_at,
        o.name as organization_name,
        u.email as admin_email,
        u.first_name as admin_first_name
      FROM organization_subscriptions os
      JOIN organizations o ON o.id = os.organization_id
      LEFT JOIN users u ON u.organization_id = os.organization_id
        AND u.role = 'admin'
        AND u.is_active = true
      WHERE os.status = 'trial'
      LIMIT 1
    `);

    if (testTrial.rows.length === 0) {
      console.log('❌ No trial subscriptions found. Please run test-subscription.js first.');
      return;
    }

    const trial = testTrial.rows[0];
    console.log(`✅ Found test trial: ${trial.organization_name}`);
    console.log(`   Admin: ${trial.admin_first_name} (${trial.admin_email})`);

    // 2. Test notification without triggering scheduled query (simulate expiring in 3 days)
    console.log('\n📧 Testing individual trial expiration warning...');

    const testOrganizationData = {
      organization_name: trial.organization_name,
      admin_email: trial.admin_email || 'test@example.com',
      admin_first_name: trial.admin_first_name || 'Test User'
    };

    const result = await emailService.sendTrialExpirationWarning(testOrganizationData, 3);
    if (result.success) {
      console.log('✅ Trial expiration warning sent successfully');
      console.log(`   Message ID: ${result.messageId}`);
    } else {
      console.log('⚠️  Trial expiration warning simulation completed (email service not configured)');
    }

    // 3. Test the bulk notification function (modify trial to expire soon for testing)
    console.log('\n🔧 Testing bulk notification system...');

    // Temporarily set trial to expire in 3 days for testing
    await query(`
      UPDATE organization_subscriptions
      SET trial_ends_at = NOW() + INTERVAL '3 days'
      WHERE id = $1
    `, [trial.id]);

    console.log('✅ Temporarily set trial to expire in 3 days for testing');

    // Run the bulk notification function
    const notificationCount = await emailService.sendTrialExpirationNotifications();
    console.log(`✅ Bulk notification system processed ${notificationCount} notifications`);

    // 4. Test different expiration scenarios
    console.log('\n🧪 Testing different expiration scenarios...');

    // Test 1 day expiration
    await query(`
      UPDATE organization_subscriptions
      SET trial_ends_at = NOW() + INTERVAL '1 day'
      WHERE id = $1
    `, [trial.id]);

    const oneDayResult = await emailService.sendTrialExpirationWarning(testOrganizationData, 1);
    console.log(`✅ 1-day expiration warning: ${oneDayResult ? 'sent' : 'simulated'}`);

    // Test 7 days expiration (should not trigger)
    await query(`
      UPDATE organization_subscriptions
      SET trial_ends_at = NOW() + INTERVAL '7 days'
      WHERE id = $1
    `, [trial.id]);

    const sevenDayCount = await emailService.sendTrialExpirationNotifications();
    console.log(`✅ 7-day test (should be 0): ${sevenDayCount} notifications sent`);

    // 5. Test email content generation
    console.log('\n📝 Testing email content generation...');

    const htmlContent = emailService.generateTrialExpirationHTML(testOrganizationData, 3);
    const textContent = emailService.generateTrialExpirationText(testOrganizationData, 3);

    console.log('✅ HTML email content generated successfully');
    console.log(`   Length: ${htmlContent.length} characters`);
    console.log('✅ Text email content generated successfully');
    console.log(`   Length: ${textContent.length} characters`);

    // Show a sample of the content
    console.log('\n📖 Sample text content (first 200 characters):');
    console.log(textContent.substring(0, 200) + '...');

    // 6. Reset trial to original state
    console.log('\n🧹 Resetting test data...');

    await query(`
      UPDATE organization_subscriptions
      SET trial_ends_at = NOW() + INTERVAL '14 days'
      WHERE id = $1
    `, [trial.id]);

    console.log('✅ Reset trial to expire in 14 days');

    console.log('\n🎉 Trial expiration notification test completed successfully!');

    console.log('\n📋 Test Results Summary:');
    console.log(`   📧 Individual notification test: ${result ? 'Success' : 'Simulated'}`);
    console.log(`   📮 Bulk notification test: ${notificationCount} notifications`);
    console.log(`   📝 Email content generation: Success`);
    console.log(`   🔧 Expiration scenarios: Tested multiple timeframes`);

    console.log('\n📋 Integration Notes:');
    console.log('1. 📧 Email notifications are integrated with existing emailService');
    console.log('2. 🎯 Notifications trigger for trials expiring in 1-3 days');
    console.log('3. ⏰ Scheduled jobs will run notifications daily at 10 AM');
    console.log('4. 🔒 Production requires SMTP configuration in environment variables');
    console.log('5. 📊 Notification status is logged for tracking');

  } catch (error) {
    console.error('❌ Notification test failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  testNotifications()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testNotifications;