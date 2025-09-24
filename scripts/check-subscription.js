#!/usr/bin/env node

const { query } = require('../database/connection');

async function checkSubscription() {
  try {
    console.log('🔍 Checking existing subscription...');

    const result = await query(`
      SELECT
        os.id,
        os.status,
        os.trial_ends_at,
        os.current_period_start,
        os.current_period_end,
        sp.name as plan_name,
        sp.display_name,
        o.name as organization_name
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.subscription_plan_id = sp.id
      JOIN organizations o ON os.organization_id = o.id
      WHERE o.name = 'Test Company'
    `);

    if (result.rows.length === 0) {
      console.log('❌ No subscription found');
      return;
    }

    const sub = result.rows[0];
    console.log(`✅ Found subscription for: ${sub.organization_name}`);
    console.log(`   - Plan: ${sub.display_name} (${sub.plan_name})`);
    console.log(`   - Status: ${sub.status}`);
    console.log(`   - Trial Ends: ${sub.trial_ends_at}`);
    console.log(`   - Period: ${sub.current_period_start} to ${sub.current_period_end}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkSubscription();