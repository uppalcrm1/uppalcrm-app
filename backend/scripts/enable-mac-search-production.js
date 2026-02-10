#!/usr/bin/env node
/**
 * Enable MAC Search Feature for Production Organizations
 *
 * This script:
 * 1. Connects to production PostgreSQL database
 * 2. Lists all organizations
 * 3. Enables MAC search feature for specified organizations
 * 4. Displays summary of enabled/disabled organizations
 */

const { Pool } = require('pg');
const readline = require('readline');
require('dotenv').config();

const PROD_DB_URL = process.env.PROD_DATABASE_URL ||
  'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function enableMacSearch() {
  const pool = new Pool({
    connectionString: PROD_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    console.log('\n' + '='.repeat(70));
    console.log('🚀 MAC SEARCH ENABLEMENT - PRODUCTION');
    console.log('='.repeat(70) + '\n');

    // Step 1: Get all organizations
    console.log('📍 Fetching organizations from production database...\n');

    const orgResult = await client.query(
      `SELECT id, name, mac_search_enabled, created_at
       FROM organizations
       ORDER BY name ASC`
    );

    if (orgResult.rows.length === 0) {
      console.error('❌ No organizations found in database');
      process.exit(1);
    }

    // Step 2: Display organizations
    console.log('📋 AVAILABLE ORGANIZATIONS:\n');
    const enabledOrgs = [];
    const disabledOrgs = [];

    orgResult.rows.forEach((org, idx) => {
      const status = org.mac_search_enabled ? '✅ ENABLED' : '⏳ DISABLED';
      console.log(`${idx + 1}. [${status}] ${org.name}`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Created: ${org.created_at.toISOString().split('T')[0]}\n`);

      if (org.mac_search_enabled) {
        enabledOrgs.push(org);
      } else {
        disabledOrgs.push(org);
      }
    });

    console.log('='.repeat(70));
    console.log(`📊 Summary: ${enabledOrgs.length} enabled, ${disabledOrgs.length} disabled\n`);

    // Step 3: Ask user what to do
    console.log('🔧 ENABLE OPTIONS:\n');
    console.log('1. Enable for ALL organizations (recommended for full rollout)');
    console.log('2. Enable for disabled organizations only');
    console.log('3. Enable for specific organizations (interactive)');
    console.log('4. Cancel\n');

    const choice = await question('Select option (1-4): ');

    let orgsToEnable = [];

    if (choice === '1') {
      orgsToEnable = orgResult.rows;
      console.log(`\n✅ Will enable MAC search for ALL ${orgResult.rows.length} organizations\n`);
    } else if (choice === '2') {
      orgsToEnable = disabledOrgs;
      console.log(`\n✅ Will enable MAC search for ${disabledOrgs.length} disabled organizations\n`);
    } else if (choice === '3') {
      console.log('\n📝 Enter organization numbers (comma-separated, e.g., 1,3,5):\n');
      const input = await question('Organization numbers: ');
      const numbers = input.split(',').map(n => parseInt(n.trim()) - 1).filter(n => n >= 0 && n < orgResult.rows.length);
      orgsToEnable = numbers.map(n => orgResult.rows[n]);
      console.log(`\n✅ Will enable MAC search for ${orgsToEnable.length} organization(s)\n`);
    } else if (choice === '4') {
      console.log('\n❌ Cancelled.\n');
      await client.end();
      await pool.end();
      rl.close();
      return;
    } else {
      console.log('\n❌ Invalid option\n');
      await client.end();
      await pool.end();
      rl.close();
      return;
    }

    // Step 4: Confirmation
    const orgsInfo = orgsToEnable.map(o => `  • ${o.name}`).join('\n');
    console.log('📋 Organizations to enable:\n');
    console.log(orgsInfo);
    console.log('');

    const confirm = await question('\n⚠️  Are you sure? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm !== 'y') {
      console.log('\n❌ Cancelled.\n');
      await client.end();
      await pool.end();
      rl.close();
      return;
    }

    // Step 5: Enable MAC search
    console.log('\n🔄 Enabling MAC search...\n');

    let enabledCount = 0;

    for (const org of orgsToEnable) {
      if (!org.mac_search_enabled) {
        await client.query(
          `UPDATE organizations SET mac_search_enabled = true WHERE id = $1`,
          [org.id]
        );
        console.log(`✅ Enabled for: ${org.name}`);
        enabledCount++;
      } else {
        console.log(`ℹ️  Already enabled: ${org.name}`);
      }
    }

    // Step 6: Final summary
    console.log('\n' + '='.repeat(70));

    // Get updated stats
    const finalResult = await client.query(
      `SELECT COUNT(*) as total,
              SUM(CASE WHEN mac_search_enabled THEN 1 ELSE 0 END) as enabled
       FROM organizations`
    );

    const { total, enabled } = finalResult.rows[0];

    console.log('✅ MAC SEARCH ENABLEMENT COMPLETE');
    console.log('='.repeat(70));
    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`   Total organizations: ${total}`);
    console.log(`   MAC Search enabled: ${enabled}`);
    console.log(`   MAC Search disabled: ${total - enabled}`);
    console.log(`   Just enabled: ${enabledCount}\n`);

    console.log('📋 NEXT STEPS:');
    console.log('1. ✅ Database migration complete');
    console.log('2. ✅ MAC Search enabled for organizations');
    console.log('3. ⏳ Deploy code to production');
    console.log('4. ⏳ Set ENCRYPTION_KEY environment variable on production');
    console.log('5. ⏳ Restart production server');
    console.log('6. ⏳ Log in as admin and configure billing portal credentials');
    console.log('7. ⏳ Test MAC Search feature\n');

    console.log('🔐 IMPORTANT - Set environment variable:');
    console.log('   ENCRYPTION_KEY=<random-secure-32-character-key>\n');

    await client.end();
    await pool.end();
    rl.close();
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    await client.end();
    await pool.end();
    rl.close();
    process.exit(1);
  }
}

enableMacSearch();
