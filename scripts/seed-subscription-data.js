#!/usr/bin/env node

/**
 * Seed subscription plans and features
 */

const { query } = require('../database/connection');

async function seedData() {
  console.log('🌱 Seeding subscription data...\n');

  try {
    // 1. Insert subscription plans
    console.log('📋 Creating subscription plans...');

    const plans = [
      {
        name: 'trial',
        display_name: 'Free Trial',
        description: 'Trial plan for new organizations',
        monthly_price: 0,
        yearly_price: null,
        max_users: 3,
        max_contacts: 100,
        max_leads: 50,
        features: JSON.stringify({ basic_reports: true }),
        is_public: false,
        sort_order: 0,
        trial_days: 14
      },
      {
        name: 'starter',
        display_name: 'Starter',
        description: 'Perfect for small teams getting started with CRM',
        monthly_price: 2900,
        yearly_price: 29000,
        max_users: 5,
        max_contacts: 1000,
        max_leads: 500,
        features: JSON.stringify({
          basic_reports: true,
          email_support: true,
          basic_integrations: true
        }),
        is_public: true,
        sort_order: 1,
        trial_days: 14
      },
      {
        name: 'professional',
        display_name: 'Professional',
        description: 'Great for growing businesses',
        monthly_price: 9900,
        yearly_price: 99000,
        max_users: 25,
        max_contacts: 10000,
        max_leads: 5000,
        features: JSON.stringify({
          advanced_reports: true,
          priority_support: true,
          advanced_integrations: true,
          custom_fields: true,
          api_access: true
        }),
        is_public: true,
        sort_order: 2,
        trial_days: 14
      },
      {
        name: 'enterprise',
        display_name: 'Enterprise',
        description: 'For large organizations with advanced needs',
        monthly_price: 29900,
        yearly_price: 299000,
        max_users: null,
        max_contacts: null,
        max_leads: null,
        features: JSON.stringify({
          unlimited_everything: true,
          white_label: true,
          dedicated_support: true,
          sso: true,
          advanced_security: true
        }),
        is_public: true,
        sort_order: 3,
        trial_days: 30
      }
    ];

    for (const plan of plans) {
      try {
        await query(`
          INSERT INTO subscription_plans (
            name, display_name, description, monthly_price, yearly_price,
            max_users, max_contacts, max_leads, features, is_public, sort_order, trial_days
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (name) DO NOTHING
        `, [
          plan.name, plan.display_name, plan.description, plan.monthly_price, plan.yearly_price,
          plan.max_users, plan.max_contacts, plan.max_leads, plan.features,
          plan.is_public, plan.sort_order, plan.trial_days
        ]);
        console.log(`✅ Created plan: ${plan.display_name}`);
      } catch (error) {
        console.log(`⚠️  Plan ${plan.name} might already exist`);
      }
    }

    // 2. Insert plan features
    console.log('\n⚙️  Creating plan features...');

    const features = [
      { key: 'basic_reports', name: 'Basic Reports', description: 'Access to standard CRM reports', type: 'boolean' },
      { key: 'advanced_reports', name: 'Advanced Reports', description: 'Custom reports and analytics', type: 'boolean' },
      { key: 'api_access', name: 'API Access', description: 'REST API access for integrations', type: 'boolean' },
      { key: 'custom_fields', name: 'Custom Fields', description: 'Create custom fields for contacts and leads', type: 'boolean' },
      { key: 'email_support', name: 'Email Support', description: 'Email support during business hours', type: 'boolean' },
      { key: 'priority_support', name: 'Priority Support', description: 'Priority email and chat support', type: 'boolean' },
      { key: 'dedicated_support', name: 'Dedicated Support', description: 'Dedicated account manager', type: 'boolean' },
      { key: 'sso', name: 'Single Sign-On', description: 'SAML/OAuth SSO integration', type: 'boolean' },
      { key: 'white_label', name: 'White Label', description: 'Remove branding and customize interface', type: 'boolean' },
      { key: 'advanced_security', name: 'Advanced Security', description: 'Enhanced security features and audit logs', type: 'boolean' }
    ];

    for (const feature of features) {
      try {
        await query(`
          INSERT INTO plan_features (feature_key, feature_name, description, feature_type)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (feature_key) DO NOTHING
        `, [feature.key, feature.name, feature.description, feature.type]);
        console.log(`✅ Created feature: ${feature.name}`);
      } catch (error) {
        console.log(`⚠️  Feature ${feature.key} might already exist`);
      }
    }

    // 3. Create indexes
    console.log('\n📇 Creating indexes...');

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_subscription_plans_public ON subscription_plans(is_public, is_active)',
      'CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON organization_subscriptions(organization_id)',
      'CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON organization_subscriptions(status)',
      'CREATE INDEX IF NOT EXISTS idx_subscription_usage_org_period ON subscription_usage(organization_id, period_start, period_end)',
      'CREATE INDEX IF NOT EXISTS idx_subscription_invoices_org ON subscription_invoices(organization_id)',
      'CREATE INDEX IF NOT EXISTS idx_subscription_events_org ON subscription_events(organization_id)'
    ];

    for (const index of indexes) {
      try {
        await query(index);
        console.log(`✅ Created index`);
      } catch (error) {
        console.log(`⚠️  Index might already exist`);
      }
    }

    // 4. Set up triggers
    console.log('\n⚡ Creating triggers...');

    const triggers = [
      'CREATE TRIGGER IF NOT EXISTS update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'CREATE TRIGGER IF NOT EXISTS update_organization_subscriptions_updated_at BEFORE UPDATE ON organization_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'CREATE TRIGGER IF NOT EXISTS update_subscription_usage_updated_at BEFORE UPDATE ON subscription_usage FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'CREATE TRIGGER IF NOT EXISTS update_subscription_invoices_updated_at BEFORE UPDATE ON subscription_invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      'CREATE TRIGGER IF NOT EXISTS update_plan_features_updated_at BEFORE UPDATE ON plan_features FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()'
    ];

    for (const trigger of triggers) {
      try {
        await query(trigger);
        console.log(`✅ Created trigger`);
      } catch (error) {
        console.log(`⚠️  Trigger might already exist`);
      }
    }

    console.log('\n🎉 Seed data completed successfully!');

    // Verify the data
    const planCount = await query('SELECT COUNT(*) as count FROM subscription_plans WHERE is_active = true');
    const featureCount = await query('SELECT COUNT(*) as count FROM plan_features WHERE is_active = true');

    console.log(`\n📊 Summary:`);
    console.log(`   📋 Subscription plans: ${planCount.rows[0].count}`);
    console.log(`   ⚙️  Plan features: ${featureCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedData;