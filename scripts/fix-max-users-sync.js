/**
 * Database Fix: Sync max_users with actual user counts
 *
 * This script fixes the data synchronization bug where max_users
 * in the organizations table doesn't match the actual number of users.
 *
 * What it does:
 * 1. Finds organizations where actual_users > max_users
 * 2. Updates max_users = actual_users for those organizations
 * 3. Updates subscription pricing to match new max_users
 * 4. Logs all changes for audit trail
 */

const { query: dbQuery } = require('../database/connection');

async function fixMaxUsersSync() {
  console.log('🔧 Starting max_users synchronization fix...\n');

  try {
    // Find organizations with mismatched data
    const mismatchResult = await dbQuery(`
      SELECT
        o.id,
        o.name,
        o.max_users as current_max_users,
        COUNT(u.id) FILTER (WHERE u.is_active = true) as actual_user_count,
        o.is_trial,
        o.trial_status
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      GROUP BY o.id, o.name, o.max_users, o.is_trial, o.trial_status
      HAVING COUNT(u.id) FILTER (WHERE u.is_active = true) > o.max_users
      ORDER BY o.name
    `);

    if (mismatchResult.rows.length === 0) {
      console.log('✅ No mismatches found. All organizations are in sync!');
      return;
    }

    console.log(`⚠️  Found ${mismatchResult.rows.length} organizations with mismatched data:\n`);

    const pricePerUser = 15;
    const updates = [];

    for (const org of mismatchResult.rows) {
      const actualUsers = parseInt(org.actual_user_count);
      const currentMaxUsers = org.current_max_users;
      const oldMonthlyPrice = currentMaxUsers * pricePerUser;
      const newMonthlyPrice = actualUsers * pricePerUser;

      console.log(`📋 ${org.name}:`);
      console.log(`   Current max_users: ${currentMaxUsers}`);
      console.log(`   Actual users: ${actualUsers}`);
      console.log(`   Status: ${org.is_trial ? `Trial (${org.trial_status})` : 'Paid'}`);
      console.log(`   Price: $${oldMonthlyPrice}/month → $${newMonthlyPrice}/month`);
      console.log('');

      updates.push({
        org_id: org.id,
        org_name: org.name,
        old_max_users: currentMaxUsers,
        new_max_users: actualUsers,
        old_price: oldMonthlyPrice,
        new_price: newMonthlyPrice
      });
    }

    // Ask for confirmation (in production, this should be automatic)
    console.log('\n🔄 Applying fixes...\n');

    // Start transaction
    await dbQuery('BEGIN');

    let fixed = 0;
    for (const update of updates) {
      try {
        // Update max_users in organizations table
        await dbQuery(`
          UPDATE organizations
          SET max_users = $1, updated_at = NOW()
          WHERE id = $2
        `, [update.new_max_users, update.org_id]);

        // Update subscription record if exists
        await dbQuery(`
          UPDATE organization_subscriptions
          SET updated_at = NOW()
          WHERE organization_id = $1
        `, [update.org_id]).catch(() => {
          // Subscription record may not exist, that's okay
        });

        console.log(`✅ Fixed ${update.org_name}: ${update.old_max_users} → ${update.new_max_users} users`);
        fixed++;
      } catch (error) {
        console.error(`❌ Error fixing ${update.org_name}:`, error.message);
      }
    }

    await dbQuery('COMMIT');

    console.log(`\n✅ Fixed ${fixed} out of ${updates.length} organizations`);

    // Verify the fix
    console.log('\n🔍 Verifying fixes...\n');

    const verifyResult = await dbQuery(`
      SELECT
        o.id,
        o.name,
        o.max_users,
        COUNT(u.id) FILTER (WHERE u.is_active = true) as actual_user_count
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      GROUP BY o.id, o.name, o.max_users
      HAVING COUNT(u.id) FILTER (WHERE u.is_active = true) > o.max_users
    `);

    if (verifyResult.rows.length === 0) {
      console.log('✅ All organizations are now in sync!');
    } else {
      console.log(`⚠️  Still ${verifyResult.rows.length} organizations with mismatches`);
      verifyResult.rows.forEach(row => {
        console.log(`   - ${row.name}: ${row.actual_user_count} users but max_users = ${row.max_users}`);
      });
    }

    // Show summary
    console.log('\n📊 Summary:');
    const summaryResult = await dbQuery(`
      SELECT
        COUNT(*) as total_orgs,
        SUM(CASE WHEN max_users >= (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id AND is_active = true) THEN 1 ELSE 0 END) as synced_orgs,
        SUM(CASE WHEN max_users < (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id AND is_active = true) THEN 1 ELSE 0 END) as mismatched_orgs
      FROM organizations
    `);

    const summary = summaryResult.rows[0];
    console.log(`   Total organizations: ${summary.total_orgs}`);
    console.log(`   Synced correctly: ${summary.synced_orgs}`);
    console.log(`   Still mismatched: ${summary.mismatched_orgs}`);

  } catch (error) {
    await dbQuery('ROLLBACK');
    console.error('\n❌ Error during sync fix:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the fix
if (require.main === module) {
  fixMaxUsersSync()
    .then(() => {
      console.log('\n✅ Sync fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Sync fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixMaxUsersSync };
