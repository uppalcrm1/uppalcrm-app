#!/usr/bin/env node

const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Database connection
const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
});

async function applyTrialMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Applying trial management migration...');
    
    // Add trial columns to organizations table
    const organizationColumns = [
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_status VARCHAR(50) DEFAULT \'never_started\';',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_days INTEGER DEFAULT 30;',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT \'trial\';',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMP WITH TIME ZONE;',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS total_trial_count INTEGER DEFAULT 0;',
      'ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_trial_at TIMESTAMP WITH TIME ZONE;'
    ];
    
    console.log('🔧 Adding trial columns to organizations table...');
    for (const sql of organizationColumns) {
      try {
        await client.query(sql);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('  ⚠️  Column already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    
    // Create organization_trial_history table
    console.log('🔧 Creating organization_trial_history table...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS organization_trial_history (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          trial_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
          trial_end_date TIMESTAMP WITH TIME ZONE NOT NULL,
          trial_duration_days INTEGER NOT NULL,
          trial_outcome VARCHAR(50),
          converted_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(organization_id, trial_start_date)
        );
      `);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('  ⚠️  Table already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    // Create organization_subscriptions table
    console.log('🔧 Creating organization_subscriptions table...');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS organization_subscriptions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          plan_name VARCHAR(50) NOT NULL,
          billing_cycle VARCHAR(20) NOT NULL,
          price_per_month DECIMAL(10,2) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'trial',
          trial_started_at TIMESTAMP WITH TIME ZONE,
          trial_ends_at TIMESTAMP WITH TIME ZONE,
          subscription_started_at TIMESTAMP WITH TIME ZONE,
          subscription_ends_at TIMESTAMP WITH TIME ZONE,
          next_billing_date TIMESTAMP WITH TIME ZONE,
          last_payment_at TIMESTAMP WITH TIME ZONE,
          last_payment_amount DECIMAL(10,2),
          payment_method_id VARCHAR(255),
          payment_processor VARCHAR(50),
          grace_period_ends_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('  ⚠️  Table already exists, skipping...');
      } else {
        throw error;
      }
    }
    
    // Create indexes
    console.log('🔧 Creating indexes...');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_organizations_trial_status ON organizations(trial_status);',
      'CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at ON organizations(trial_ends_at);',
      'CREATE INDEX IF NOT EXISTS idx_organizations_payment_status ON organizations(payment_status);'
    ];
    
    for (const sql of indexes) {
      try {
        await client.query(sql);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('  ⚠️  Index already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    
    // Enable RLS on new tables
    console.log('🔧 Enabling Row Level Security...');
    try {
      await client.query('ALTER TABLE organization_trial_history ENABLE ROW LEVEL SECURITY;');
      await client.query('ALTER TABLE organization_subscriptions ENABLE ROW LEVEL SECURITY;');
    } catch (error) {
      console.log('  ⚠️  RLS already enabled, skipping...');
    }
    
    // Create RLS policies
    console.log('🔧 Creating RLS policies...');
    const policies = [
      `CREATE POLICY IF NOT EXISTS organization_trial_history_isolation ON organization_trial_history
       FOR ALL TO PUBLIC
       USING (organization_id = current_setting('app.current_organization_id')::uuid);`,
      `CREATE POLICY IF NOT EXISTS organization_subscriptions_isolation ON organization_subscriptions
       FOR ALL TO PUBLIC
       USING (organization_id = current_setting('app.current_organization_id')::uuid);`
    ];
    
    for (const policy of policies) {
      try {
        await client.query(policy);
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log('  ⚠️  Policy already exists, skipping...');
        } else {
          throw error;
        }
      }
    }
    
    // Verify the migration
    console.log('✅ Verifying trial management schema...');
    
    // Check new tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('organization_trial_history', 'organization_subscriptions')
      ORDER BY table_name;
    `);
    
    console.log('📊 Trial management tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Check organization columns
    const orgColumnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
        AND column_name IN (
          'trial_started_at', 'trial_ends_at', 'trial_status', 'trial_days',
          'payment_status', 'subscription_ends_at', 'grace_period_ends_at',
          'total_trial_count', 'last_trial_at'
        )
      ORDER BY column_name;
    `);
    
    console.log('📊 Trial columns in organizations:');
    orgColumnsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });
    
    console.log('🎉 Trial management migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applyTrialMigration();