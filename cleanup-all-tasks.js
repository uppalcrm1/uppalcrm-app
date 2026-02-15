const { Pool } = require('pg');
require('dotenv').config();

// Staging database connection
const stagingPool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging',
  ssl: { rejectUnauthorized: false }
});

// DevTest database connection
const devtestPool = new Pool({
  connectionString: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest',
  ssl: { rejectUnauthorized: false }
});

async function cleanupAllTasks(pool, envName) {
  const client = await pool.connect();

  try {
    console.log(`\n📊 Cleaning up ${envName} environment...`);

    // ========================================================================
    // Get count before deletion
    // ========================================================================
    console.log('   📋 Scanning for all tasks...');
    const before = await client.query(`
      SELECT COUNT(*) as count
      FROM lead_interactions
      WHERE interaction_type = 'task'
    `);

    const beforeCount = before.rows[0].count;
    console.log(`      Found ${beforeCount} total tasks`);

    if (beforeCount > 0) {
      // Show breakdown
      const breakdown = await client.query(`
        SELECT
          COALESCE(activity_metadata->>'source', 'manual') as source,
          COUNT(*) as count
        FROM lead_interactions
        WHERE interaction_type = 'task'
        GROUP BY source
        ORDER BY count DESC
      `);

      breakdown.rows.forEach(row => {
        console.log(`        • ${row.source}: ${row.count} tasks`);
      });

      // Delete ALL tasks
      console.log('\n      🗑️  Deleting all tasks...');
      const deleteResult = await client.query(`
        DELETE FROM lead_interactions
        WHERE interaction_type = 'task'
      `);

      console.log(`      ✅ Deleted ${deleteResult.rowCount} tasks`);

      // Verify deletion
      const after = await client.query(`
        SELECT COUNT(*) as count
        FROM lead_interactions
        WHERE interaction_type = 'task'
      `);

      console.log(`      ✓ Verification: ${after.rows[0].count} tasks remaining`);
      return deleteResult.rowCount;
    } else {
      console.log('      ✓ No tasks found');
      return 0;
    }

  } catch (error) {
    console.error(`❌ Error in ${envName}:`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('🗑️  Complete Task Cleanup Script');
  console.log('================================');
  console.log('⚠️  This will delete ALL tasks (workflow + manual) from both environments');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  let totalDeleted = 0;

  try {
    // Cleanup staging
    const stagingDeleted = await cleanupAllTasks(stagingPool, 'STAGING');
    totalDeleted += stagingDeleted;

    // Cleanup devtest
    const devtestDeleted = await cleanupAllTasks(devtestPool, 'DEVTEST');
    totalDeleted += devtestDeleted;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Complete cleanup finished!');
    console.log('='.repeat(50));
    console.log(`Total tasks deleted: ${totalDeleted}`);
    console.log(`Finished at: ${new Date().toISOString()}\n`);

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await stagingPool.end();
    await devtestPool.end();
  }
}

// Run the cleanup
main().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
