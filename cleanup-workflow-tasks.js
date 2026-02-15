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

async function cleanupWorkflowTasks(pool, envName) {
  const client = await pool.connect();

  try {
    console.log(`\n📊 Cleaning up ${envName} environment...`);

    // ========================================================================
    // Clean up lead_interactions (workflow tasks)
    // ========================================================================
    console.log('   📋 Scanning lead_interactions table...');
    const before = await client.query(`
      SELECT COUNT(*) as count
      FROM lead_interactions
      WHERE interaction_type = 'task'
        AND activity_metadata->>'source' = 'workflow_rule'
    `);

    const beforeCount = before.rows[0].count;
    console.log(`      Found ${beforeCount} workflow tasks`);

    if (beforeCount > 0) {
      // Delete workflow tasks
      const deleteResult = await client.query(`
        DELETE FROM lead_interactions
        WHERE interaction_type = 'task'
          AND activity_metadata->>'source' = 'workflow_rule'
      `);

      console.log(`      ✅ Deleted ${deleteResult.rowCount} workflow tasks`);

      // Verify deletion
      const after = await client.query(`
        SELECT COUNT(*) as count
        FROM lead_interactions
        WHERE interaction_type = 'task'
          AND activity_metadata->>'source' = 'workflow_rule'
      `);

      console.log(`      ✓ Verification: ${after.rows[0].count} tasks remaining`);
      return deleteResult.rowCount;
    } else {
      console.log('      ✓ No workflow tasks found');
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
  console.log('🔄 Workflow Task Cleanup Script');
  console.log('================================');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  let totalDeleted = 0;

  try {
    // Cleanup staging
    const stagingDeleted = await cleanupWorkflowTasks(stagingPool, 'STAGING');
    totalDeleted += stagingDeleted;

    // Cleanup devtest
    const devtestDeleted = await cleanupWorkflowTasks(devtestPool, 'DEVTEST');
    totalDeleted += devtestDeleted;

    console.log('\n' + '='.repeat(50));
    console.log('✅ Cleanup completed successfully!');
    console.log('='.repeat(50));
    console.log(`Total workflow tasks deleted: ${totalDeleted}`);
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
