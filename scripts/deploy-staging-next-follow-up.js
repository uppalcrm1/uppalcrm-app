const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Staging database connection
const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging',
  ssl: {
    rejectUnauthorized: false
  }
});

async function deployToStaging() {
  const client = await pool.connect();

  try {
    console.log('🚀 Deploying next_follow_up fix to STAGING...\n');

    // Step 1: Run the migration
    console.log('📋 Step 1: Running database migration...');
    const sqlPath = path.join(__dirname, '../database/migrations/fix-next-follow-up-sync.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await client.query(sql);
    console.log('✅ Migration completed successfully!\n');

    // Step 2: Run cleanup for stale follow-ups
    console.log('📋 Step 2: Cleaning up stale next_follow_up dates...');

    const cleanupQuery = `
      UPDATE leads
      SET next_follow_up = NULL,
          updated_at = NOW()
      WHERE next_follow_up IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM lead_interactions
          WHERE lead_interactions.lead_id = leads.id
            AND lead_interactions.interaction_type = 'task'
            AND lead_interactions.status IN ('scheduled', 'pending')
            AND lead_interactions.scheduled_at IS NOT NULL
        )
      RETURNING id, first_name, last_name;
    `;

    const cleanupResult = await client.query(cleanupQuery);
    console.log(`✅ Cleaned up ${cleanupResult.rows.length} leads with stale dates\n`);

    // Step 3: Verify the deployment
    console.log('📋 Step 3: Verifying deployment...');

    const verifyQuery = `
      WITH lead_tasks AS (
        SELECT
          l.id as lead_id,
          l.first_name || ' ' || l.last_name as lead_name,
          l.next_follow_up as current_next_follow_up,
          MIN(li.scheduled_at) as calculated_next_follow_up,
          COUNT(*) FILTER (WHERE li.status IN ('scheduled', 'pending')) as pending_tasks_count
        FROM leads l
        LEFT JOIN lead_interactions li ON l.id = li.lead_id
          AND li.interaction_type = 'task'
          AND li.status IN ('scheduled', 'pending')
          AND li.scheduled_at IS NOT NULL
        GROUP BY l.id, l.first_name, l.last_name, l.next_follow_up
      )
      SELECT
        COUNT(*) as total_leads,
        COUNT(*) FILTER (
          WHERE current_next_follow_up = calculated_next_follow_up
          OR (current_next_follow_up IS NULL AND calculated_next_follow_up IS NULL)
        ) as synced_leads,
        COUNT(*) FILTER (
          WHERE NOT (current_next_follow_up = calculated_next_follow_up
          OR (current_next_follow_up IS NULL AND calculated_next_follow_up IS NULL))
        ) as mismatched_leads
      FROM lead_tasks;
    `;

    const verifyResult = await client.query(verifyQuery);
    const stats = verifyResult.rows[0];

    console.log('📊 Verification Results:');
    console.log(`  Total leads: ${stats.total_leads}`);
    console.log(`  ✅ Synced correctly: ${stats.synced_leads}`);
    console.log(`  ❌ Mismatched: ${stats.mismatched_leads}\n`);

    if (parseInt(stats.mismatched_leads) === 0) {
      console.log('🎉 All leads are perfectly synced!\n');
    } else {
      console.log('⚠️  Some leads still have mismatches. Running additional cleanup...\n');
    }

    console.log('✅ DEPLOYMENT COMPLETE!\n');
    console.log('🎯 The next_follow_up field will now automatically sync with pending tasks on staging!');

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deployToStaging().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
