#!/usr/bin/env node

const { query } = require('../database/connection');

async function recreateOrgSubscriptionsTable() {
  try {
    console.log('🔄 Recreating organization_subscriptions table with new schema...');

    // Drop the existing table
    await query('DROP TABLE IF EXISTS organization_subscriptions CASCADE');
    console.log('✅ Dropped old organization_subscriptions table');

    // Create the new table with proper schema
    await query(`
      CREATE TABLE organization_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id),
        status VARCHAR(50) NOT NULL DEFAULT 'trial',
        trial_ends_at TIMESTAMPTZ,
        current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 month',
        billing_cycle VARCHAR(20) DEFAULT 'monthly',
        next_billing_date TIMESTAMPTZ,
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        canceled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('✅ Created new organization_subscriptions table');

    // Create indexes
    await query(`
      CREATE INDEX idx_organization_subscriptions_org_id ON organization_subscriptions(organization_id);
      CREATE INDEX idx_organization_subscriptions_plan_id ON organization_subscriptions(subscription_plan_id);
      CREATE INDEX idx_organization_subscriptions_status ON organization_subscriptions(status);
    `);
    console.log('✅ Created indexes');

    // Create trigger for updated_at
    await query(`
      CREATE TRIGGER organization_subscriptions_updated_at
      BEFORE UPDATE ON organization_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Created updated_at trigger');

    console.log('🎉 Table recreation completed successfully!');

  } catch (error) {
    console.error('❌ Table recreation failed:', error.message);
  } finally {
    process.exit(0);
  }
}

recreateOrgSubscriptionsTable();