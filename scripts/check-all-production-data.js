#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function checkAllProductionData() {
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
    console.log('🔍 Checking ALL production database data...\n');

    // Check all organizations
    const orgs = await pool.query('SELECT id, name, slug, created_at FROM organizations ORDER BY created_at');
    console.log(`📋 ORGANIZATIONS (${orgs.rows.length} total):`);
    orgs.rows.forEach((org, index) => {
      console.log(`  ${index + 1}. ${org.name} (${org.slug})`);
      console.log(`     ID: ${org.id}`);
      console.log(`     Created: ${org.created_at}`);
      console.log('');
    });

    // Check all users with organization details
    const users = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
             o.name as organization_name, o.slug as org_slug
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      ORDER BY o.name, u.created_at
    `);

    console.log(`👥 USERS (${users.rows.length} total):`);
    let currentOrg = '';
    users.rows.forEach((user, index) => {
      if (user.organization_name !== currentOrg) {
        currentOrg = user.organization_name;
        console.log(`\n  📁 ${currentOrg || 'No Organization'}:`);
      }
      console.log(`    ${index + 1}. ${user.first_name} ${user.last_name}`);
      console.log(`       Email: ${user.email}`);
      console.log(`       Role: ${user.role}`);
      console.log(`       Created: ${user.created_at}`);
      console.log('');
    });

    // Check subscriptions
    const subs = await pool.query(`
      SELECT os.id, os.status, os.trial_ends_at, os.created_at,
             sp.name as plan_name, sp.display_name,
             o.name as org_name
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.subscription_plan_id = sp.id
      JOIN organizations o ON os.organization_id = o.id
      ORDER BY o.name
    `);

    console.log(`📊 SUBSCRIPTIONS (${subs.rows.length} total):`);
    subs.rows.forEach((sub, index) => {
      console.log(`  ${index + 1}. ${sub.org_name}`);
      console.log(`     Plan: ${sub.display_name} (${sub.plan_name})`);
      console.log(`     Status: ${sub.status}`);
      console.log(`     Trial Ends: ${sub.trial_ends_at}`);
      console.log(`     Created: ${sub.created_at}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking production:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the comprehensive check
checkAllProductionData()
  .then(() => {
    console.log('✅ Complete production data check finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Production data check failed:', error);
    process.exit(1);
  });