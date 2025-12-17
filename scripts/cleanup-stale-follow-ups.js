const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: {
    rejectUnauthorized: false
  }
});

async function cleanupStaleFollowUps() {
  const client = await pool.connect();

  try {
    console.log('🧹 Cleaning up stale next_follow_up dates...\n');

    // Clear next_follow_up for leads that have no pending tasks
    const updateQuery = `
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
      RETURNING id, first_name, last_name, next_follow_up;
    `;

    const result = await client.query(updateQuery);

    console.log(`✅ Cleaned up ${result.rows.length} leads with stale next_follow_up dates\n`);

    if (result.rows.length > 0) {
      console.log('📋 Updated leads:');
      result.rows.forEach(lead => {
        const name = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed Lead';
        console.log(`  - ${name} (cleared next_follow_up)`);
      });
    }

    console.log('\n🎯 All next_follow_up dates are now accurate!');

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

cleanupStaleFollowUps().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
