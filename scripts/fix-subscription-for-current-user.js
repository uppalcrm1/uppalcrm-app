#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function fixSubscriptionForAllUsers() {
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
    console.log('🔧 Fixing subscription issues for all users...\n');

    // Get ALL users and their organizations
    const allUsers = await pool.query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.organization_id,
             o.name as org_name, o.slug as org_slug
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      ORDER BY o.name, u.email
    `);

    console.log('👥 ALL USERS IN PRODUCTION:');
    allUsers.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.first_name} ${user.last_name} (${user.email})`);
      console.log(`     Organization: ${user.org_name || 'No Organization'}`);
      console.log(`     Org ID: ${user.organization_id}`);
      console.log('');
    });

    // Check which organizations have subscriptions
    const orgsWithSubs = await pool.query(`
      SELECT DISTINCT os.organization_id, o.name as org_name,
             COUNT(os.id) as subscription_count
      FROM organization_subscriptions os
      JOIN organizations o ON os.organization_id = o.id
      GROUP BY os.organization_id, o.name
    `);

    console.log('📊 ORGANIZATIONS WITH SUBSCRIPTIONS:');
    orgsWithSubs.rows.forEach((org, index) => {
      console.log(`  ${index + 1}. ${org.org_name} (${org.subscription_count} subscriptions)`);
    });

    // Find organizations without subscriptions
    const orgsWithoutSubs = await pool.query(`
      SELECT o.id, o.name, o.slug
      FROM organizations o
      LEFT JOIN organization_subscriptions os ON o.id = os.organization_id
      WHERE os.id IS NULL
    `);

    console.log('\n❌ ORGANIZATIONS WITHOUT SUBSCRIPTIONS:');
    if (orgsWithoutSubs.rows.length === 0) {
      console.log('  ✅ All organizations have subscriptions!');
    } else {
      for (const org of orgsWithoutSubs.rows) {
        console.log(`  - ${org.name} (${org.id})`);

        // Create trial subscription for this organization
        const trialPlan = await pool.query("SELECT id FROM subscription_plans WHERE name = 'trial'");

        if (trialPlan.rows.length > 0) {
          const planId = trialPlan.rows[0].id;

          await pool.query(`
            INSERT INTO organization_subscriptions (
              organization_id,
              subscription_plan_id,
              status,
              trial_ends_at,
              current_period_start,
              current_period_end
            ) VALUES ($1, $2, 'trial', NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '1 month')
          `, [org.id, planId]);

          console.log(`    ✅ Created trial subscription for ${org.name}`);
        }
      }
    }

    // Final verification - show all subscriptions
    console.log('\n📋 FINAL SUBSCRIPTION STATUS:');
    const finalSubs = await pool.query(`
      SELECT os.status, sp.display_name, o.name as org_name,
             COUNT(u.id) as user_count
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON os.subscription_plan_id = sp.id
      JOIN organizations o ON os.organization_id = o.id
      LEFT JOIN users u ON o.id = u.organization_id
      GROUP BY os.id, os.status, sp.display_name, o.name
      ORDER BY o.name
    `);

    finalSubs.rows.forEach((sub, index) => {
      console.log(`  ${index + 1}. ${sub.org_name}: ${sub.display_name} (${sub.status})`);
      console.log(`     Users in this org: ${sub.user_count}`);
      console.log('');
    });

    console.log('🎉 All organizations should now have subscriptions!');
    console.log('\n💡 Try logging in with any of these emails and the subscription page should work:');

    allUsers.rows.forEach(user => {
      if (user.org_name) {
        console.log(`   - ${user.email} (${user.org_name})`);
      }
    });

  } catch (error) {
    console.error('❌ Error fixing subscriptions:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the fix
fixSubscriptionForAllUsers()
  .then(() => {
    console.log('\n✅ Subscription fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Subscription fix failed:', error);
    process.exit(1);
  });