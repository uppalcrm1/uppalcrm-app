/**
 * Migration: Create incoming_calls table for persistent call tracking
 * - Replaces global.incomingCalls in-memory cache with database storage
 * - Tracks incoming calls with status, timestamps, and participant info
 * - Adds indexes for fast lookups by organization and call status
 * - Provides rollback capability
 */

const { query } = require('../connection');

async function up() {
  try {
    console.log('📞 Starting incoming_calls table migration (up)...');

    // Create incoming_calls table
    await query(`
      CREATE TABLE IF NOT EXISTS incoming_calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        call_sid VARCHAR(34) NOT NULL UNIQUE,
        from_number VARCHAR(20) NOT NULL,
        to_number VARCHAR(20),
        status VARCHAR(20) DEFAULT 'ringing' NOT NULL,
        accepted_by UUID REFERENCES users(id) ON DELETE SET NULL,
        conference_id VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('✓ Created incoming_calls table');

    // Create indexes for fast lookups
    await query(`
      CREATE INDEX IF NOT EXISTS idx_incoming_calls_org_status
      ON incoming_calls(organization_id, status);
    `);
    console.log('✓ Created index on (organization_id, status)');

    await query(`
      CREATE INDEX IF NOT EXISTS idx_incoming_calls_call_sid
      ON incoming_calls(call_sid);
    `);
    console.log('✓ Created index on call_sid');

    // Create trigger to auto-update updated_at timestamp
    await query(`
      CREATE OR REPLACE FUNCTION update_incoming_calls_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);
    console.log('✓ Created update_timestamp function');

    await query(`
      DROP TRIGGER IF EXISTS incoming_calls_update_timestamp ON incoming_calls;
      CREATE TRIGGER incoming_calls_update_timestamp
      BEFORE UPDATE ON incoming_calls
      FOR EACH ROW
      EXECUTE FUNCTION update_incoming_calls_timestamp();
    `);
    console.log('✓ Created trigger for updated_at auto-update');

    console.log('✅ Incoming_calls table migration (up) completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Incoming_calls table migration (up) failed:', error.message);
    throw error;
  }
}

async function down() {
  try {
    console.log('⏮️  Starting incoming_calls table migration (down)...');

    // Drop trigger
    await query(`DROP TRIGGER IF EXISTS incoming_calls_update_timestamp ON incoming_calls;`);
    console.log('✓ Dropped trigger');

    // Drop function
    await query(`DROP FUNCTION IF EXISTS update_incoming_calls_timestamp();`);
    console.log('✓ Dropped function');

    // Drop indexes
    await query(`DROP INDEX IF EXISTS idx_incoming_calls_call_sid;`);
    console.log('✓ Dropped call_sid index');

    await query(`DROP INDEX IF EXISTS idx_incoming_calls_org_status;`);
    console.log('✓ Dropped org_status index');

    // Drop table
    await query(`DROP TABLE IF EXISTS incoming_calls;`);
    console.log('✓ Dropped incoming_calls table');

    console.log('✅ Incoming_calls table migration (down) completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Incoming_calls table migration (down) failed:', error.message);
    throw error;
  }
}

module.exports = { up, down };
