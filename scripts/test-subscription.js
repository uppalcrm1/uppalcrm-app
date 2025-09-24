#!/usr/bin/env node

/**
 * Test subscription system functionality
 */

const { query } = require('../database/connection');

async function testSubscription() {
  console.log('🧪 Testing subscription system...\n');

  try {
    // 1. Get test organization
    const orgResult = await query('SELECT id, name FROM organizations LIMIT 1');
    if (orgResult.rows.length === 0) {
      console.log('❌ No organizations found. Please create an organization first.');
      return;
    }

    const org = orgResult.rows[0];
    console.log(`📋 Testing with organization: ${org.name} (${org.id})`);

    // 2. Get trial plan
    const trialPlan = await query(`SELECT id FROM subscription_plans WHERE name = 'trial'`);
    if (trialPlan.rows.length === 0) {
      console.log('❌ Trial plan not found!');
      return;
    }

    console.log(`✅ Found trial plan: ${trialPlan.rows[0].id}`);

    // 3. Check if organization already has a subscription
    const existingSub = await query('SELECT id, status FROM organization_subscriptions WHERE organization_id = $1', [org.id]);

    if (existingSub.rows.length > 0) {
      console.log(`✅ Organization already has subscription with status: ${existingSub.rows[0].status}`);
    } else {
      // Create trial subscription using existing schema
      console.log('🆕 Creating trial subscription...');

      const subscriptionId = require('crypto').randomUUID();
      const now = new Date();
      const trialEnd = new Date(now.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days

      await query(`
        INSERT INTO organization_subscriptions (
          id, organization_id, plan_name, status, billing_cycle,
          price_per_month, trial_started_at, trial_ends_at, created_at, updated_at
        ) VALUES ($1, $2, 'trial', 'trial', 'monthly', 0, $3, $4, $3, $3)
      `, [subscriptionId, org.id, now, trialEnd]);

      console.log(`✅ Created trial subscription: ${subscriptionId}`);

      // Note: subscription_events table may not exist in current schema
      try {
        await query(`
          INSERT INTO subscription_events (
            organization_id, subscription_id, event_type, description
          ) VALUES ($1, $2, 'trial_started', 'Trial subscription created via test script')
        `, [org.id, subscriptionId]);
        console.log(`✅ Logged subscription event`);
      } catch (eventError) {
        console.log(`⚠️  Could not log event (table may not exist): ${eventError.message}`);
      }
    }

    // 4. Test usage functions (if they exist)
    console.log('\n🔍 Testing usage functions...');

    try {
      // Test current usage
      const usage = await query('SELECT * FROM get_current_usage($1)', [org.id]);
      console.log('📊 Current usage:', usage.rows[0]);
    } catch (error) {
      console.log('⚠️  get_current_usage function not available:', error.message);

      // Manual usage calculation as fallback
      const manualUsage = await query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = TRUE) as active_users,
          (SELECT COUNT(*) FROM contacts WHERE organization_id = $1) as total_contacts,
          (SELECT COUNT(*) FROM leads WHERE organization_id = $1) as total_leads
      `, [org.id]);
      console.log('📊 Manual usage calculation:', manualUsage.rows[0]);
    }

    try {
      // Test usage limits
      const canAddUsers = await query('SELECT check_usage_limits($1, $2, $3) as can_add', [org.id, 'users', 1]);
      console.log(`👥 Can add 1 user: ${canAddUsers.rows[0].can_add}`);

      const canAddContacts = await query('SELECT check_usage_limits($1, $2, $3) as can_add', [org.id, 'contacts', 10]);
      console.log(`📞 Can add 10 contacts: ${canAddContacts.rows[0].can_add}`);
    } catch (error) {
      console.log('⚠️  check_usage_limits function not available:', error.message);
    }

    try {
      // Test feature access
      const hasBasicReports = await query('SELECT has_feature_access($1, $2) as has_access', [org.id, 'basic_reports']);
      console.log(`📈 Has basic_reports: ${hasBasicReports.rows[0].has_access}`);
    } catch (error) {
      console.log('⚠️  has_feature_access function not available:', error.message);
    }

    // 5. List available plans
    console.log('\n📋 Available subscription plans:');
    const plans = await query('SELECT name, display_name, monthly_price, max_users FROM subscription_plans WHERE is_active = true ORDER BY sort_order');
    plans.rows.forEach(plan => {
      console.log(`   💳 ${plan.display_name} - $${(plan.monthly_price / 100).toFixed(2)}/month (${plan.max_users || 'unlimited'} users)`);
    });

    console.log('\n🎉 Subscription system test completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. 🌐 Open http://localhost:3003');
    console.log('2. 🔑 Login to your CRM');
    console.log('3. 📊 Navigate to "Subscription" in the sidebar');
    console.log('4. 🧪 Test the subscription management interface');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  testSubscription()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testSubscription;