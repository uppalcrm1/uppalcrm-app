#!/usr/bin/env node

const { query } = require('../database/connection');

async function migrateSubscriptionData() {
  try {
    console.log('🔄 Migrating subscription data from old to new schema...');

    // Get the old subscription record
    const oldSub = await query('SELECT * FROM organization_subscriptions WHERE organization_id = $1',
      ['54fca35b-ba14-4bc5-89de-2769d4468beb']);

    if (oldSub.rows.length === 0) {
      console.log('❌ No old subscription record found');
      return;
    }

    const old = oldSub.rows[0];
    console.log(`✅ Found old subscription: ${old.plan_name} (${old.status})`);

    // Get the corresponding new plan ID
    const planResult = await query('SELECT id FROM subscription_plans WHERE name = $1', [old.plan_name]);

    if (planResult.rows.length === 0) {
      console.log(`❌ No matching plan found for: ${old.plan_name}`);
      return;
    }

    const newPlanId = planResult.rows[0].id;
    console.log(`✅ Found new plan ID: ${newPlanId}`);

    // Delete the old record and create new one
    await query('DELETE FROM organization_subscriptions WHERE id = $1', [old.id]);
    console.log('✅ Deleted old subscription record');

    // Create new subscription record with new schema
    const newSub = await query(`
      INSERT INTO organization_subscriptions (
        organization_id,
        subscription_plan_id,
        status,
        trial_ends_at,
        current_period_start,
        current_period_end
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      old.organization_id,
      newPlanId,
      old.status,
      old.trial_ends_at,
      old.trial_started_at || new Date(),
      old.trial_ends_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    ]);

    console.log(`🎉 Created new subscription with ID: ${newSub.rows[0].id}`);
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    process.exit(0);
  }
}

migrateSubscriptionData();