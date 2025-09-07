#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

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

async function startTrials() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting trials for newly created organizations...');
    
    // Update organizations to start 14-day trials
    const result = await client.query(`
      UPDATE organizations 
      SET 
        trial_status = 'active',
        trial_started_at = NOW(),
        trial_ends_at = NOW() + INTERVAL '14 days',
        trial_days = 14,
        last_trial_at = NOW(),
        total_trial_count = 1
      WHERE trial_status = 'never_started'
      RETURNING name, trial_started_at, trial_ends_at
    `);
    
    console.log(`✅ Started trials for ${result.rowCount} organizations:`);
    result.rows.forEach(org => {
      console.log(`  - ${org.name}: ${org.trial_started_at.toDateString()} to ${org.trial_ends_at.toDateString()}`);
    });
    
    // Add trial history entries
    const orgs = await client.query('SELECT id, name FROM organizations WHERE trial_status = \'active\'');
    for (const org of orgs.rows) {
      await client.query(`
        INSERT INTO organization_trial_history (organization_id, trial_start_date, trial_end_date, trial_duration_days, trial_outcome)
        VALUES ($1, NOW(), NOW() + INTERVAL '14 days', 14, 'active')
        ON CONFLICT (organization_id, trial_start_date) DO NOTHING
      `, [org.id]);
    }
    
    console.log('\n🔄 Calculating daily metrics...');
    await client.query('SELECT calculate_daily_metrics()');
    
    console.log('\n📊 Verifying trial_overview view:');
    const trialView = await client.query('SELECT organization_name, trial_status, days_remaining, admin_name FROM trial_overview ORDER BY trial_created_at DESC');
    console.log(`Found ${trialView.rowCount} organizations in trial_overview:`);
    
    trialView.rows.forEach(org => {
      console.log(`  - ${org.organization_name}: ${org.trial_status}, ${org.days_remaining} days remaining (Admin: ${org.admin_name})`);
    });
    
    console.log('\n🎯 Trials started successfully! Super Admin Dashboard will now show these organizations.');
    
  } catch (error) {
    console.error('❌ Error starting trials:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

startTrials();