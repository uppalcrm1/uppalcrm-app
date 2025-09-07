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

async function checkOrgs() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Organizations in database:');
    const orgs = await client.query(`
      SELECT name, trial_status, trial_started_at, trial_ends_at, payment_status, created_at 
      FROM organizations 
      ORDER BY created_at DESC
    `);
    
    orgs.rows.forEach(org => {
      console.log(`  - ${org.name}:`);
      console.log(`    Trial Status: ${org.trial_status || 'null'}`);
      console.log(`    Trial Started: ${org.trial_started_at || 'null'}`);
      console.log(`    Trial Ends: ${org.trial_ends_at || 'null'}`);
      console.log(`    Payment Status: ${org.payment_status || 'null'}`);
      console.log(`    Created: ${org.created_at}`);
      console.log('');
    });
    
    console.log('🔍 Checking trial_overview view:');
    const trialView = await client.query('SELECT * FROM trial_overview ORDER BY trial_created_at DESC');
    console.log(`Found ${trialView.rowCount} organizations in trial_overview`);
    
    trialView.rows.forEach(org => {
      console.log(`  - ${org.organization_name}: ${org.trial_status}, ${org.days_remaining} days remaining`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

checkOrgs();