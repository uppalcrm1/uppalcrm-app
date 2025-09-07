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

async function createTrialFunctions() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Creating trial management functions...');
    
    // Function 1: can_start_new_trial
    console.log('🔧 Creating can_start_new_trial function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION can_start_new_trial(org_id UUID)
      RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          current_status VARCHAR(50);
      BEGIN
          SELECT trial_status
          INTO current_status
          FROM organizations 
          WHERE id = org_id;
          
          -- Business rules:
          -- 1. Must not have active trial
          -- 2. No waiting period required
          -- 3. No maximum trial limit
          
          IF current_status = 'active' THEN
              RETURN FALSE; -- Already in trial
          END IF;
          
          RETURN TRUE; -- Can always start new trial when not active
      END;
      $$;
    `);
    
    // Function 2: start_organization_trial
    console.log('🔧 Creating start_organization_trial function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION start_organization_trial(
          org_id UUID,
          trial_days INTEGER DEFAULT 30
      ) RETURNS BOOLEAN
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          trial_end TIMESTAMP WITH TIME ZONE;
      BEGIN
          trial_end := NOW() + (trial_days || ' days')::interval;
          
          -- Update organization
          UPDATE organizations 
          SET 
              trial_started_at = NOW(),
              trial_ends_at = trial_end,
              trial_status = 'active',
              trial_days = start_organization_trial.trial_days,
              payment_status = 'trial',
              total_trial_count = COALESCE(total_trial_count, 0) + 1,
              last_trial_at = NOW(),
              is_active = true,
              updated_at = NOW()
          WHERE id = org_id;
          
          -- Create trial history record
          INSERT INTO organization_trial_history (
              organization_id,
              trial_start_date,
              trial_end_date,
              trial_duration_days,
              trial_outcome
          ) VALUES (
              org_id,
              NOW(),
              trial_end,
              start_organization_trial.trial_days,
              'active'
          );
          
          -- Create subscription record
          INSERT INTO organization_subscriptions (
              organization_id,
              plan_name,
              billing_cycle,
              price_per_month,
              status,
              trial_started_at,
              trial_ends_at
          ) VALUES (
              org_id,
              'professional',
              'monthly',
              29.00,
              'trial',
              NOW(),
              trial_end
          );
          
          RETURN TRUE;
      END;
      $$;
    `);
    
    // Function 3: expire_trials
    console.log('🔧 Creating expire_trials function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION expire_trials()
      RETURNS INTEGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          expired_count INTEGER := 0;
          org_record RECORD;
      BEGIN
          FOR org_record IN 
              SELECT id, name 
              FROM organizations 
              WHERE trial_status = 'active' 
              AND trial_ends_at <= NOW()
          LOOP
              -- Update organization status
              UPDATE organizations 
              SET 
                  trial_status = 'expired',
                  payment_status = 'trial_expired',
                  subscription_ends_at = NOW() + interval '7 days',
                  grace_period_ends_at = NOW() + interval '7 days',
                  is_active = false,
                  updated_at = NOW()
              WHERE id = org_record.id;
              
              -- Update subscription status
              UPDATE organization_subscriptions 
              SET 
                  status = 'expired',
                  grace_period_ends_at = NOW() + interval '7 days',
                  updated_at = NOW()
              WHERE organization_id = org_record.id AND status = 'trial';
              
              -- Update trial history
              UPDATE organization_trial_history 
              SET trial_outcome = 'expired'
              WHERE organization_id = org_record.id AND trial_outcome = 'active';
              
              expired_count := expired_count + 1;
          END LOOP;
          
          RETURN expired_count;
      END;
      $$;
    `);
    
    // Verify functions were created
    console.log('✅ Verifying trial management functions...');
    const functionsResult = await client.query(`
      SELECT routine_name, routine_type 
      FROM information_schema.routines 
      WHERE routine_name IN ('can_start_new_trial', 'start_organization_trial', 'expire_trials')
        AND routine_schema = 'public'
      ORDER BY routine_name;
    `);
    
    console.log('📊 Created functions:');
    functionsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.routine_name}() - ${row.routine_type}`);
    });
    
    console.log('🎉 Trial management functions created successfully!');
    
  } catch (error) {
    console.error('❌ Function creation failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createTrialFunctions();