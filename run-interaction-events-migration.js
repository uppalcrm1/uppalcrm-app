/**
 * Run migration 017a: Fix interaction events backfill
 * This fixes the issue where activities don't show up in the timeline
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not set in .env file');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();

    console.log('\n🔧 Running Migration 017a: Fix Interaction Events Backfill\n');
    console.log('This will:');
    console.log('  1. Set organization_id on all interactions (from their lead)');
    console.log('  2. Backfill missing "created" events');
    console.log('  3. Backfill missing "completed" events\n');

    // Step 1: Check current state
    console.log('📊 Current state:\n');

    const interactionsCount = await client.query(
      'SELECT COUNT(*) FROM lead_interactions'
    );
    console.log(`   Total interactions: ${interactionsCount.rows[0].count}`);

    const interactionsWithoutOrg = await client.query(
      'SELECT COUNT(*) FROM lead_interactions WHERE organization_id IS NULL'
    );
    console.log(`   Interactions without organization_id: ${interactionsWithoutOrg.rows[0].count}`);

    const eventsCount = await client.query(
      'SELECT COUNT(DISTINCT interaction_id) FROM interaction_events'
    );
    console.log(`   Interactions with events: ${eventsCount.rows[0].count}`);

    const interactionsWithoutEvents = await client.query(
      `SELECT COUNT(*) FROM lead_interactions li
       WHERE NOT EXISTS (
         SELECT 1 FROM interaction_events ie WHERE ie.interaction_id = li.id
       )`
    );
    console.log(`   Interactions without events: ${interactionsWithoutEvents.rows[0].count}\n`);

    // Step 2: Run the migration
    console.log('🚀 Running migration...\n');

    const migrationPath = path.join(__dirname, 'database', 'migrations', '017a_fix_interaction_events_backfill.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Step 3: Verify results
    console.log('📊 After migration:\n');

    const newInteractionsWithoutOrg = await client.query(
      'SELECT COUNT(*) FROM lead_interactions WHERE organization_id IS NULL'
    );
    console.log(`   Interactions without organization_id: ${newInteractionsWithoutOrg.rows[0].count}`);

    const newEventsCount = await client.query(
      'SELECT COUNT(DISTINCT interaction_id) FROM interaction_events'
    );
    console.log(`   Interactions with events: ${newEventsCount.rows[0].count}`);

    const newInteractionsWithoutEvents = await client.query(
      `SELECT COUNT(*) FROM lead_interactions li
       WHERE NOT EXISTS (
         SELECT 1 FROM interaction_events ie WHERE ie.interaction_id = li.id
       )`
    );
    console.log(`   Interactions without events: ${newInteractionsWithoutEvents.rows[0].count}\n`);

    // Step 4: Summary
    const fixedOrg = parseInt(interactionsWithoutOrg.rows[0].count) - parseInt(newInteractionsWithoutOrg.rows[0].count);
    const fixedEvents = parseInt(newEventsCount.rows[0].count) - parseInt(eventsCount.rows[0].count);

    console.log('📈 Summary:\n');
    console.log(`   ✅ Fixed organization_id for ${fixedOrg} interactions`);
    console.log(`   ✅ Created events for ${fixedEvents} interactions\n`);

    if (parseInt(newInteractionsWithoutEvents.rows[0].count) === 0) {
      console.log('🎉 SUCCESS! All interactions now have events!');
      console.log('   The Activities tab should now work correctly.\n');
    } else {
      console.log(`⚠️  Warning: ${newInteractionsWithoutEvents.rows[0].count} interactions still dont have events.`);
      console.log('   This might be due to missing organization_id on their leads.\n');
    }

    client.release();
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
