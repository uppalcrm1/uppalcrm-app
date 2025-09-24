#!/usr/bin/env node

const { query } = require('../database/connection');

async function createTrialSubscription() {
  try {
    console.log('🔍 Finding organization...');

    // Find the organization
    const orgResult = await query(`SELECT id, name FROM organizations WHERE name = 'Test Company'`);

    if (orgResult.rows.length === 0) {
      console.log('❌ No organization found with name "Test Company"');
      return;
    }

    const org = orgResult.rows[0];
    console.log(`✅ Found organization: ${org.name} (${org.id})`);

    // Check if subscription already exists
    const existingSub = await query('SELECT id FROM organization_subscriptions WHERE organization_id = $1', [org.id]);

    if (existingSub.rows.length > 0) {
      console.log('⚠️  Subscription already exists for this organization');
      return;
    }

    // Get trial plan
    const trialPlan = await query(`SELECT id FROM subscription_plans WHERE name = 'trial'`);

    if (trialPlan.rows.length === 0) {
      console.log('❌ Trial plan not found');
      return;
    }

    const planId = trialPlan.rows[0].id;
    console.log(`✅ Found trial plan ID: ${planId}`);

    // Create trial subscription
    const result = await query(`
      INSERT INTO organization_subscriptions (
        organization_id,
        subscription_plan_id,
        status,
        trial_ends_at,
        current_period_start,
        current_period_end
      ) VALUES (
        $1, $2, 'trial',
        NOW() + INTERVAL '14 days',
        NOW(),
        NOW() + INTERVAL '1 month'
      ) RETURNING id
    `, [org.id, planId]);

    console.log(`🎉 Created trial subscription with ID: ${result.rows[0].id}`);
    console.log('✅ Trial expires in 14 days');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

createTrialSubscription();