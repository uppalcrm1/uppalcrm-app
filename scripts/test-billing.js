#!/usr/bin/env node

/**
 * Test billing automation functionality
 */

const billingService = require('../services/billingService');
const { query } = require('../database/connection');

async function testBilling() {
  console.log('🧪 Testing billing automation system...\n');

  try {
    // 1. Create test data for billing
    console.log('📋 Setting up test data...');

    // Get the test organization with trial subscription
    const testOrg = await query(`
      SELECT
        os.id as subscription_id,
        os.organization_id,
        os.status,
        os.trial_ends_at,
        o.name as organization_name
      FROM organization_subscriptions os
      JOIN organizations o ON o.id = os.organization_id
      WHERE os.status = 'trial'
      LIMIT 1
    `);

    if (testOrg.rows.length === 0) {
      console.log('❌ No trial subscription found. Please run test-subscription.js first.');
      return;
    }

    const subscription = testOrg.rows[0];
    console.log(`✅ Found test subscription for: ${subscription.organization_name}`);

    // 2. Test trial expiration (simulate expired trial)
    console.log('\n🔍 Testing trial expiration...');

    // Update trial to be expired for testing
    await query(`
      UPDATE organization_subscriptions
      SET trial_ends_at = NOW() - INTERVAL '1 day'
      WHERE id = $1
    `, [subscription.subscription_id]);

    console.log('✅ Set trial to expired state for testing');

    // 3. Test expired trial processing
    console.log('\n⏰ Testing expired trial processing...');
    const expiredCount = await billingService.processExpiredTrials();
    console.log(`✅ Processed ${expiredCount} expired trials`);

    // 4. Test billing automation
    console.log('\n🤖 Testing full billing automation...');
    const results = await billingService.runBillingAutomation();

    // 5. Verify results
    console.log('\n🔍 Verifying results...');

    // Check subscription status
    const updatedSub = await query(`
      SELECT status, grace_period_ends_at
      FROM organization_subscriptions
      WHERE id = $1
    `, [subscription.subscription_id]);

    if (updatedSub.rows.length > 0) {
      console.log(`✅ Subscription status updated to: ${updatedSub.rows[0].status}`);
      if (updatedSub.rows[0].grace_period_ends_at) {
        console.log(`✅ Grace period set until: ${updatedSub.rows[0].grace_period_ends_at}`);
      }
    }

    // Check for any generated invoices
    const invoices = await query(`
      SELECT invoice_number, status, total_amount
      FROM subscription_invoices
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [subscription.organization_id]);

    console.log(`\n📋 Recent invoices for organization (${invoices.rows.length}):`);
    invoices.rows.forEach(invoice => {
      console.log(`   🧾 ${invoice.invoice_number} - ${invoice.status} - $${(invoice.total_amount / 100).toFixed(2)}`);
    });

    // Check subscription events
    const events = await query(`
      SELECT event_type, description, created_at
      FROM subscription_events
      WHERE organization_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `).catch(() => ({ rows: [] })); // Handle case where table doesn't exist

    if (events.rows.length > 0) {
      console.log(`\n📝 Recent subscription events (${events.rows.length}):`);
      events.rows.forEach(event => {
        console.log(`   📅 ${event.event_type}: ${event.description}`);
      });
    }

    // 6. Test invoice generation for active subscription
    console.log('\n🧾 Testing invoice generation...');

    // Create an active subscription for testing
    const activeSubId = require('crypto').randomUUID();
    const now = new Date();
    const nextBilling = new Date(now.getTime() - 1000); // 1 second ago to trigger billing

    await query(`
      INSERT INTO organization_subscriptions (
        id, organization_id, plan_name, status, billing_cycle,
        price_per_month, subscription_started_at, next_billing_date,
        payment_method_id, created_at, updated_at
      ) VALUES ($1, $2, 'starter', 'active', 'monthly', 29.00, $3, $4, 'test_payment_method', $3, $3)
    `, [activeSubId, subscription.organization_id, now, nextBilling]);

    console.log('✅ Created active subscription for billing test');

    // Generate invoices for active subscriptions
    const invoiceCount = await billingService.generateMonthlyInvoices();
    console.log(`✅ Generated ${invoiceCount} new invoices`);

    // 7. Clean up test data (optional)
    console.log('\n🧹 Cleaning up test data...');

    // Remove the test active subscription
    await query('DELETE FROM organization_subscriptions WHERE id = $1', [activeSubId]);
    console.log('✅ Cleaned up test active subscription');

    // Reset original trial subscription
    await query(`
      UPDATE organization_subscriptions
      SET status = 'trial',
          trial_ends_at = NOW() + INTERVAL '14 days',
          grace_period_ends_at = NULL
      WHERE id = $1
    `, [subscription.subscription_id]);

    console.log('✅ Reset trial subscription to original state');

    console.log('\n🎉 Billing automation test completed successfully!');
    console.log('\n📋 Test Results Summary:');
    console.log(`   ⏰ Processed expired trials: ${results.expiredTrials}`);
    console.log(`   🔒 Processed grace periods: ${results.expiredGracePeriods}`);
    console.log(`   🧾 Generated invoices: ${results.generatedInvoices + invoiceCount}`);
    console.log(`   📧 Sent notifications: ${results.sentNotifications}`);
    console.log(`   💳 Processed renewals: ${results.processedRenewals}`);

    console.log('\n📋 Next steps:');
    console.log('1. 🕒 Set up scheduled jobs (cron) for billing automation');
    console.log('2. 📧 Implement email notification system');
    console.log('3. 💳 Integrate with payment processor (Stripe/PayPal)');
    console.log('4. 📊 Add billing analytics and reporting');

  } catch (error) {
    console.error('❌ Billing test failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  testBilling()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testBilling;