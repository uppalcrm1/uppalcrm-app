#!/usr/bin/env node
/**
 * Enable MAC Search Feature for Staging Organization
 * This script enables the MAC search feature for the staging environment
 */

const { Pool } = require('pg');
require('dotenv').config();

async function enableMacSearch() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.internal/uppalcrm_database_staging',
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('🚀 Enabling MAC Search feature for staging...\n');

    // Find staging organizations
    console.log('📍 Finding staging organizations...');
    const orgResult = await client.query(
      `SELECT id, name, mac_search_enabled FROM organizations ORDER BY created_at DESC LIMIT 10`
    );

    if (orgResult.rows.length === 0) {
      console.error('❌ No organizations found in database');
      process.exit(1);
    }

    console.log('\n📋 Available Organizations:');
    orgResult.rows.forEach((org, idx) => {
      const status = org.mac_search_enabled ? '✅ Enabled' : '❌ Disabled';
      console.log(`${idx + 1}. ${org.name} (${org.id}) - ${status}`);
    });

    // Enable for all organizations (or modify as needed)
    console.log('\n🔧 Enabling MAC search for all organizations...');
    const updateResult = await client.query(
      `UPDATE organizations SET mac_search_enabled = true WHERE mac_search_enabled = false`
    );

    console.log(`✅ MAC search enabled for ${updateResult.rowCount} organization(s)`);

    // Show summary
    const finalResult = await client.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN mac_search_enabled THEN 1 ELSE 0 END) as enabled
       FROM organizations`
    );

    const { total, enabled } = finalResult.rows[0];
    console.log(`\n📊 Summary:`);
    console.log(`   Total organizations: ${total}`);
    console.log(`   MAC Search enabled: ${enabled}`);
    console.log(`   MAC Search disabled: ${total - enabled}`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ MAC SEARCH ENABLED!');
    console.log('='.repeat(60));
    console.log('\n📋 Next steps:');
    console.log('1. Log in as admin to the staging CRM');
    console.log('2. Go to Admin Settings > MAC Address Search Settings');
    console.log('3. Configure portal credentials');
    console.log('4. Test MAC search feature\n');

    await client.end();
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await client.end();
    await pool.end();
    process.exit(1);
  }
}

enableMacSearch();
