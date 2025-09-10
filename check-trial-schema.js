require('dotenv').config();
const { query } = require('./database/connection');

async function checkTrialSchema() {
  console.log('🔍 Checking Trial Management Schema...');
  console.log('====================================\n');
  
  try {
    // Check if trial columns exist in organizations table
    console.log('📊 Checking organizations table columns...');
    const columnsResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'organizations'
      AND column_name LIKE '%trial%' OR column_name LIKE '%payment%'
      ORDER BY column_name;
    `);
    
    console.log('Trial-related columns in organizations:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    });
    
    if (columnsResult.rows.length === 0) {
      console.log('  ❌ No trial columns found');
    } else {
      console.log(`  ✅ Found ${columnsResult.rows.length} trial-related columns`);
    }
    
    // Check if trial history table exists
    console.log('\n📊 Checking trial history table...');
    const historyTableResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organization_trial_history'
      );
    `);
    
    if (historyTableResult.rows[0].exists) {
      console.log('  ✅ organization_trial_history table exists');
    } else {
      console.log('  ❌ organization_trial_history table missing');
    }
    
    // Check if subscriptions table exists
    console.log('\n📊 Checking subscriptions table...');
    const subsTableResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organization_subscriptions'
      );
    `);
    
    if (subsTableResult.rows[0].exists) {
      console.log('  ✅ organization_subscriptions table exists');
    } else {
      console.log('  ❌ organization_subscriptions table missing');
    }
    
    // Check if trial functions exist
    console.log('\n📊 Checking trial management functions...');
    const functionsResult = await query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_name IN ('start_organization_trial', 'can_start_new_trial', 'expire_trials');
    `);
    
    console.log('Trial management functions:');
    functionsResult.rows.forEach(func => {
      console.log(`  ✅ ${func.routine_name}`);
    });
    
    if (functionsResult.rows.length === 0) {
      console.log('  ❌ No trial functions found');
    }
    
    // Sample some trial data
    console.log('\n📊 Sample trial data...');
    const sampleResult = await query(`
      SELECT 
        name,
        trial_status,
        trial_started_at,
        trial_ends_at,
        payment_status,
        subscription_plan
      FROM organizations 
      WHERE trial_status IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 5;
    `);
    
    if (sampleResult.rows.length > 0) {
      console.log('Recent organizations with trial data:');
      sampleResult.rows.forEach(org => {
        console.log(`  - ${org.name}: ${org.trial_status} (${org.payment_status})`);
      });
    } else {
      console.log('  📝 No organizations with trial data found');
    }
    
    console.log('\n✅ Schema check complete!');
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

checkTrialSchema();