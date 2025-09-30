#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

// Function to update an existing database
async function updateSubscriptionSchema(dbConfig, environment) {
  const pool = new Pool(dbConfig);

  try {
    console.log(`🚀 Updating subscription schema for ${environment.toUpperCase()}...`);

    // Step 1: Drop and recreate organization_subscriptions table
    console.log('🔄 Recreating organization_subscriptions table...');

    await pool.query('DROP TABLE IF EXISTS organization_subscriptions CASCADE');
    console.log('✅ Dropped old organization_subscriptions table');

    await pool.query(`
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

    // Step 2: Create indexes
    await pool.query(`
      CREATE INDEX idx_organization_subscriptions_org_id ON organization_subscriptions(organization_id);
      CREATE INDEX idx_organization_subscriptions_plan_id ON organization_subscriptions(subscription_plan_id);
      CREATE INDEX idx_organization_subscriptions_status ON organization_subscriptions(status);
    `);
    console.log('✅ Created indexes');

    // Step 3: Create trigger
    await pool.query(`
      CREATE TRIGGER organization_subscriptions_updated_at
      BEFORE UPDATE ON organization_subscriptions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
    console.log('✅ Created updated_at trigger');

    // Step 4: Create trial subscriptions for all existing organizations
    console.log('👥 Creating trial subscriptions for existing organizations...');

    const organizations = await pool.query('SELECT id, name FROM organizations');
    const trialPlan = await pool.query("SELECT id FROM subscription_plans WHERE name = 'trial'");

    if (trialPlan.rows.length === 0) {
      console.log('❌ Trial plan not found - make sure subscription plans are seeded');
      return;
    }

    const planId = trialPlan.rows[0].id;
    let createdCount = 0;

    for (const org of organizations.rows) {
      try {
        await pool.query(`
          INSERT INTO organization_subscriptions (
            organization_id,
            subscription_plan_id,
            status,
            trial_ends_at,
            current_period_start,
            current_period_end
          ) VALUES ($1, $2, 'trial', NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '1 month')
        `, [org.id, planId]);

        console.log(`✅ Created trial for: ${org.name}`);
        createdCount++;
      } catch (error) {
        console.log(`⚠️  Skipped ${org.name}: ${error.message}`);
      }
    }

    console.log(`🎉 ${environment.toUpperCase()} subscription schema updated successfully!`);
    console.log(`📊 Created ${createdCount} trial subscriptions`);

  } catch (error) {
    console.error(`❌ ${environment.toUpperCase()} update failed:`, error.message);
  } finally {
    await pool.end();
  }
}

// Main function to update both staging and production
async function updateBothEnvironments() {
  // Update staging
  const stagingDbConfig = process.env.STAGING_DATABASE_URL ? {
    connectionString: process.env.STAGING_DATABASE_URL,
    ssl: process.env.STAGING_DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  } : {
    host: process.env.STAGING_DB_HOST || 'localhost',
    port: process.env.STAGING_DB_PORT || 5432,
    database: process.env.STAGING_DB_NAME,
    user: process.env.STAGING_DB_USER,
    password: process.env.STAGING_DB_PASSWORD,
    ssl: false
  };

  await updateSubscriptionSchema(stagingDbConfig, 'staging');

  // Update production
  const productionDbConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  } : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false
  };

  await updateSubscriptionSchema(productionDbConfig, 'production');
}

// Run if this file is executed directly
if (require.main === module) {
  updateBothEnvironments()
    .then(() => {
      console.log('\n✨ All environments updated successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Update failed:', error);
      process.exit(1);
    });
}

module.exports = updateBothEnvironments;