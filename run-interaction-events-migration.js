/**
 * Run Interaction Events Migration
 * Creates interaction_events table and triggers for tracking task lifecycle
 */

const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not found in .env');
  console.error('Please set DATABASE_URL to your staging database connection string');
  process.exit(1);
}

console.log('🔧 RUNNING INTERACTION EVENTS MIGRATION');
console.log('=====================================\n');
console.log('Database:', DATABASE_URL.split('@')[1]?.split('?')[0] || 'hidden');
console.log('');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  const client = await pool.connect();

  try {
    console.log('📖 Reading migration file...');
    const sql = fs.readFileSync('./database/migrations/017_interaction_events.sql', 'utf8');

    console.log('🚀 Executing migration...\n');

    // Execute the entire migration as one transaction
    await client.query('BEGIN');

    try {
      await client.query(sql);
      await client.query('COMMIT');
      console.log('  ✅ Migration executed successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    console.log('\n📊 Verifying migration...\n');

    // Verify table exists
    const tableResult = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'interaction_events'
    `);

    console.log('Table check:');
    console.log(`  interaction_events: ${tableResult.rows.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);

    // Verify triggers exist
    const triggersResult = await client.query(`
      SELECT trigger_name FROM information_schema.triggers
      WHERE event_object_table = 'lead_interactions'
      AND trigger_name IN ('trigger_create_interaction_event', 'trigger_track_interaction_updates')
    `);

    console.log('\nTriggers check:');
    const triggerNames = triggersResult.rows.map(r => r.trigger_name);
    console.log(`  trigger_create_interaction_event:    ${triggerNames.includes('trigger_create_interaction_event') ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  trigger_track_interaction_updates:   ${triggerNames.includes('trigger_track_interaction_updates') ? '✅ EXISTS' : '❌ MISSING'}`);

    // Count backfilled events
    const eventsResult = await client.query(`
      SELECT COUNT(*) as count FROM interaction_events
    `);

    console.log('\nBackfilled events:');
    console.log(`  Total events created: ${eventsResult.rows[0].count}`);

    // Show event type breakdown
    const eventTypesResult = await client.query(`
      SELECT event_type, COUNT(*) as count
      FROM interaction_events
      GROUP BY event_type
      ORDER BY count DESC
    `);

    console.log('\nEvent type breakdown:');
    eventTypesResult.rows.forEach(row => {
      console.log(`  ${row.event_type.padEnd(20)}: ${row.count}`);
    });

    console.log('\n=====================================');

    if (tableResult.rows.length > 0 && triggerNames.length === 2) {
      console.log('✅ MIGRATION SUCCESSFUL!');
      console.log('=====================================\n');
      console.log('Next steps:');
      console.log('1. Restart the backend server to pick up changes');
      console.log('2. Test creating a new task - should create "created" event');
      console.log('3. Test completing a task - should create "completed" event');
      console.log('4. Test reassigning a task - should create "reassigned" event');
      console.log('5. Check the timeline displays separate entries\n');
    } else {
      console.log('⚠️  MIGRATION INCOMPLETE');
      console.log('=====================================\n');
      console.log('Table or triggers may be missing.');
      console.log('Check the errors above.\n');
    }

  } catch (error) {
    console.error('\n❌ MIGRATION FAILED');
    console.error('=====================================');
    console.error('Error:', error.message);
    console.error('\nFull error:');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
})();
