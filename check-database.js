const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function checkDatabase() {
  try {
    console.log('=== CHECKING DATABASE CONTENTS ===\n');
    
    // Check organizations table columns
    console.log('📋 ORGANIZATIONS TABLE COLUMNS:');
    const orgColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      ORDER BY ordinal_position
    `);
    orgColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Check organizations data
    console.log('\n📊 ORGANIZATIONS DATA:');
    const orgs = await pool.query('SELECT * FROM organizations ORDER BY created_at DESC LIMIT 10');
    console.log(`   Total organizations: ${orgs.rows.length}`);
    
    if (orgs.rows.length > 0) {
      orgs.rows.forEach(org => {
        console.log(`  - ID: ${org.id}`);
        console.log(`    Name: ${org.name}`);
        console.log(`    Domain: ${org.domain}`); 
        console.log(`    Trial Status: ${org.trial_status || 'N/A'}`);
        console.log(`    Payment Status: ${org.payment_status || 'N/A'}`);
        console.log(`    Active: ${org.is_active}`);
        console.log(`    Created: ${org.created_at}`);
        console.log('');
      });
    } else {
      console.log('   No organizations found');
    }
    
    // Check users
    console.log('\n👥 USERS DATA:');
    const users = await pool.query('SELECT id, email, first_name, last_name, organization_id, created_at FROM users ORDER BY created_at DESC LIMIT 10');
    console.log(`   Total users: ${users.rows.length}`);
    
    if (users.rows.length > 0) {
      users.rows.forEach(user => {
        console.log(`  - ${user.first_name} ${user.last_name} (${user.email})`);
        console.log(`    Org ID: ${user.organization_id}`);
        console.log(`    Created: ${user.created_at}`);
        console.log('');
      });
    } else {
      console.log('   No users found');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    await pool.end();
  }
}

checkDatabase();