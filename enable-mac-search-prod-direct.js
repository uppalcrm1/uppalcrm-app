#!/usr/bin/env node
/**
 * Direct MAC Search Enablement for Production
 * Non-interactive version - enables for all organizations
 */

const { Pool } = require('pg');
require('dotenv').config();

const PROD_DB_URL = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function enableMacSearch() {
  const pool = new Pool({
    connectionString: PROD_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 ENABLING MAC SEARCH FOR ALL PRODUCTION ORGANIZATIONS');
    console.log('='.repeat(70) + '\n');

    // Get all organizations
    console.log('📍 Fetching organizations...\n');
    const orgResult = await client.query(
      `SELECT id, name, mac_search_enabled FROM organizations ORDER BY name ASC`
    );

    if (orgResult.rows.length === 0) {
      console.error('❌ No organizations found');
      process.exit(1);
    }

    // Display organizations
    console.log('📋 ORGANIZATIONS:\n');
    orgResult.rows.forEach((org, idx) => {
      const status = org.mac_search_enabled ? '✅ ENABLED' : '⏳ DISABLED';
      console.log(`${idx + 1}. [${status}] ${org.name}`);
    });

    console.log('\n' + '='.repeat(70) + '\n');

    // Enable for all
    console.log('🔄 Enabling MAC search for all organizations...\n');

    const updateResult = await client.query(
      `UPDATE organizations SET mac_search_enabled = true WHERE mac_search_enabled = false`
    );

    console.log(`✅ Enabled for ${updateResult.rowCount} organization(s)\n`);

    // Show final summary
    const finalResult = await client.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN mac_search_enabled THEN 1 ELSE 0 END) as enabled
       FROM organizations`
    );

    const { total, enabled } = finalResult.rows[0];

    console.log('='.repeat(70));
    console.log('✅ MAC SEARCH ENABLEMENT COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`   Total organizations: ${total}`);
    console.log(`   MAC Search enabled: ${enabled}`);
    console.log(`   MAC Search disabled: ${total - enabled}\n`);

    console.log('📋 NEXT STEPS:');
    console.log('1. ✅ Code deployed to production');
    console.log('2. ✅ MAC Search enabled for all organizations');
    console.log('3. ⏳ Restart production server');
    console.log('4. ⏳ Set ENCRYPTION_KEY environment variable');
    console.log('5. ⏳ Configure billing portal credentials in admin panel');
    console.log('6. ⏳ Test MAC Search feature\n');

    await client.end();
    await pool.end();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    await client.end();
    await pool.end();
    process.exit(1);
  }
}

enableMacSearch();
