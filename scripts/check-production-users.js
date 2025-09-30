#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function checkProductionUsers() {
  // Production database configuration
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

  const pool = new Pool(productionDbConfig);

  try {
    console.log('🔍 Checking production database users and organizations...');

    // Check organizations
    const orgs = await pool.query('SELECT id, name FROM organizations ORDER BY name');
    console.log(`\n📋 Found ${orgs.rows.length} organizations:`);
    orgs.rows.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`);
    });

    // Check users
    const users = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      ORDER BY u.email
    `);

    console.log(`\n👥 Found ${users.rows.length} users:`);
    users.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.first_name} ${user.last_name}) - ${user.role} at ${user.organization_name || 'No org'}`);
    });

    // Check subscriptions
    const subs = await pool.query(`
      SELECT os.status, sp.display_name, o.name as org_name
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.subscription_plan_id = sp.id
      JOIN organizations o ON os.organization_id = o.id
    `);

    console.log(`\n📊 Found ${subs.rows.length} subscriptions:`);
    subs.rows.forEach(sub => {
      console.log(`  - ${sub.org_name}: ${sub.display_name} (${sub.status})`);
    });

  } catch (error) {
    console.error('❌ Error checking production:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the check
checkProductionUsers()
  .then(() => {
    console.log('\n✅ Production check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Production check failed:', error);
    process.exit(1);
  });