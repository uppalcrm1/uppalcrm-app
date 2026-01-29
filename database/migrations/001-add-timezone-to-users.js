/**
 * Migration: Add timezone support to users table
 * - Adds timezone column to store user preferences
 * - Adds timezone to organization_settings
 * - Provides rollback capability
 */

const { query } = require('../connection');

async function up() {
  try {
    console.log('⏱️  Starting timezone migration (up)...');

    // Add timezone column to users table
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
    `);
    console.log('✓ Added timezone column to users table');

    // Add timezone to organization_settings if it exists
    const checkSettingsTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'organization_settings'
      );
    `);

    if (checkSettingsTable.rows[0].exists) {
      await query(`
        ALTER TABLE organization_settings
        ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(50) DEFAULT 'America/New_York';
      `);
      console.log('✓ Added default_timezone to organization_settings');
    }

    // Create index for timezone searches (optional optimization)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_timezone
      ON users(timezone);
    `);
    console.log('✓ Created index on timezone column');

    console.log('✅ Timezone migration (up) completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Timezone migration (up) failed:', error.message);
    throw error;
  }
}

async function down() {
  try {
    console.log('⏱️  Starting timezone migration (down - rollback)...');

    // Remove index
    await query(`DROP INDEX IF EXISTS idx_users_timezone;`);
    console.log('✓ Dropped timezone index');

    // Remove timezone from users table
    await query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS timezone;
    `);
    console.log('✓ Removed timezone column from users table');

    // Remove from organization_settings if exists
    const checkSettingsTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'organization_settings'
      );
    `);

    if (checkSettingsTable.rows[0].exists) {
      await query(`
        ALTER TABLE organization_settings
        DROP COLUMN IF EXISTS default_timezone;
      `);
      console.log('✓ Removed default_timezone from organization_settings');
    }

    console.log('✅ Timezone migration (down) completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Timezone migration (down) failed:', error.message);
    throw error;
  }
}

module.exports = { up, down };
