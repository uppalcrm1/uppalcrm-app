const { query } = require('./database/connection');

async function rollback() {
  try {
    console.log('⏮️  Rolling back database changes...\n');

    // Rollback timezone migration
    console.log('1️⃣  Removing timezone column...');
    await query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS timezone CASCADE;
    `);
    console.log('   ✅ Timezone column removed');

    await query(`
      DROP INDEX IF EXISTS idx_users_timezone;
    `);
    console.log('   ✅ Timezone index removed');

    console.log('\n✅ Database rollback complete!');
    console.log('   - Timezone column removed from users table');
    console.log('   - Timezone index removed');
    console.log('   - Field configurations unchanged (kept original state)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    process.exit(1);
  }
}

rollback();
