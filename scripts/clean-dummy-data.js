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

async function cleanDummyData() {
  const client = await pool.connect();
  
  try {
    console.log('🧹 Removing dummy/test data...');
    
    // Remove dummy organizations and all related data
    const dummyOrgs = await client.query(`
      SELECT id, name 
      FROM organizations 
      WHERE name ILIKE '%test%' 
         OR name ILIKE '%demo%' 
         OR name ILIKE '%sample%'
         OR name ILIKE '%example%'
    `);
    
    console.log(`Found ${dummyOrgs.rowCount} dummy organizations to remove:`);
    dummyOrgs.rows.forEach(org => {
      console.log(`  - ${org.name}`);
    });
    
    if (dummyOrgs.rowCount > 0) {
      const orgIds = dummyOrgs.rows.map(org => org.id);
      
      // Remove related data first (foreign key constraints)
      await client.query('DELETE FROM contacts WHERE organization_id = ANY($1)', [orgIds]);
      await client.query('DELETE FROM leads WHERE organization_id = ANY($1)', [orgIds]);
      await client.query('DELETE FROM users WHERE organization_id = ANY($1)', [orgIds]);
      await client.query('DELETE FROM organization_notes WHERE organization_id = ANY($1)', [orgIds]);
      await client.query('DELETE FROM organization_engagement WHERE organization_id = ANY($1)', [orgIds]);
      
      // Remove organizations
      await client.query('DELETE FROM organizations WHERE id = ANY($1)', [orgIds]);
      
      console.log(`✅ Removed ${dummyOrgs.rowCount} dummy organizations and all related data`);
    }
    
    // Check remaining organizations
    const remainingOrgs = await client.query(`
      SELECT name, trial_status, payment_status, created_at 
      FROM organizations 
      ORDER BY created_at DESC
    `);
    
    console.log(`\n📊 Remaining organizations: ${remainingOrgs.rowCount}`);
    remainingOrgs.rows.forEach(org => {
      console.log(`  - ${org.name} (${org.trial_status}/${org.payment_status}) - Created: ${org.created_at.toDateString()}`);
    });
    
    console.log('\n🎯 Database cleaned and ready for real trials!');
    console.log('🌐 Ready to test with: https://uppalcrmapp.netlify.app/');
    
  } catch (error) {
    console.error('❌ Error cleaning dummy data:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

cleanDummyData();