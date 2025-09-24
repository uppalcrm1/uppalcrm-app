#!/usr/bin/env node

/**
 * Create subscription tables script
 */

const { query } = require('../database/connection');

async function createTables() {
  console.log('🗄️  Creating subscription tables...\n');

  const tables = [
    // 1. Subscription Plans Table
    `CREATE TABLE IF NOT EXISTS subscription_plans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL UNIQUE,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      monthly_price INTEGER NOT NULL DEFAULT 0,
      yearly_price INTEGER DEFAULT NULL,
      setup_fee INTEGER DEFAULT 0,
      max_users INTEGER DEFAULT NULL,
      max_contacts INTEGER DEFAULT NULL,
      max_leads INTEGER DEFAULT NULL,
      max_storage_gb INTEGER DEFAULT NULL,
      max_api_calls_per_month INTEGER DEFAULT NULL,
      max_custom_fields INTEGER DEFAULT NULL,
      features JSONB DEFAULT '{}',
      is_active BOOLEAN DEFAULT true,
      is_public BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      trial_days INTEGER DEFAULT 14,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 2. Organization Subscriptions Table
    `CREATE TABLE IF NOT EXISTS organization_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id),
      status VARCHAR(20) DEFAULT 'trial',
      billing_cycle VARCHAR(20) DEFAULT 'monthly',
      current_price INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      trial_start TIMESTAMP,
      trial_end TIMESTAMP,
      current_period_start TIMESTAMP,
      current_period_end TIMESTAMP,
      usage_data JSONB DEFAULT '{}',
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      payment_method_id VARCHAR(255),
      cancelled_at TIMESTAMP,
      cancellation_reason TEXT,
      cancel_at_period_end BOOLEAN DEFAULT false,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id),
      CHECK (status IN ('trial', 'active', 'cancelled', 'expired', 'suspended')),
      CHECK (billing_cycle IN ('monthly', 'yearly'))
    )`,

    // 3. Subscription Usage Table
    `CREATE TABLE IF NOT EXISTS subscription_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      active_users INTEGER DEFAULT 0,
      total_contacts INTEGER DEFAULT 0,
      total_leads INTEGER DEFAULT 0,
      storage_used_gb DECIMAL(10,2) DEFAULT 0,
      api_calls INTEGER DEFAULT 0,
      custom_fields_used INTEGER DEFAULT 0,
      user_overage INTEGER DEFAULT 0,
      contact_overage INTEGER DEFAULT 0,
      lead_overage INTEGER DEFAULT 0,
      storage_overage_gb DECIMAL(10,2) DEFAULT 0,
      api_overage INTEGER DEFAULT 0,
      total_overage_cost INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(organization_id, period_start, period_end)
    )`,

    // 4. Subscription Invoices Table
    `CREATE TABLE IF NOT EXISTS subscription_invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      subscription_id UUID NOT NULL REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      status VARCHAR(20) DEFAULT 'draft',
      period_start TIMESTAMP NOT NULL,
      period_end TIMESTAMP NOT NULL,
      subtotal INTEGER NOT NULL DEFAULT 0,
      tax_amount INTEGER DEFAULT 0,
      discount_amount INTEGER DEFAULT 0,
      total_amount INTEGER NOT NULL DEFAULT 0,
      amount_paid INTEGER DEFAULT 0,
      amount_due INTEGER NOT NULL DEFAULT 0,
      line_items JSONB DEFAULT '[]',
      stripe_invoice_id VARCHAR(255),
      payment_date TIMESTAMP,
      payment_method VARCHAR(100),
      due_date TIMESTAMP,
      notes TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CHECK (status IN ('draft', 'sent', 'paid', 'failed', 'cancelled'))
    )`,

    // 5. Subscription Events Table
    `CREATE TABLE IF NOT EXISTS subscription_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      subscription_id UUID REFERENCES organization_subscriptions(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      description TEXT,
      old_data JSONB DEFAULT '{}',
      new_data JSONB DEFAULT '{}',
      performed_by UUID REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 6. Plan Features Table
    `CREATE TABLE IF NOT EXISTS plan_features (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      feature_key VARCHAR(100) NOT NULL UNIQUE,
      feature_name VARCHAR(100) NOT NULL,
      description TEXT,
      feature_type VARCHAR(20) DEFAULT 'boolean',
      is_active BOOLEAN DEFAULT true,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 7. Plan Feature Mappings Table
    `CREATE TABLE IF NOT EXISTS plan_feature_mappings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      subscription_plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
      plan_feature_id UUID NOT NULL REFERENCES plan_features(id) ON DELETE CASCADE,
      feature_value TEXT,
      is_included BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(subscription_plan_id, plan_feature_id)
    )`
  ];

  for (let i = 0; i < tables.length; i++) {
    try {
      await query(tables[i]);
      console.log(`✅ Created table ${i + 1}/${tables.length}`);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠️  Table ${i + 1} already exists`);
      } else {
        console.error(`❌ Error creating table ${i + 1}:`, error.message);
      }
    }
  }

  console.log('\n✅ All tables created successfully!');
}

if (require.main === module) {
  createTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = createTables;