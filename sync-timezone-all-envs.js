#!/usr/bin/env node

const { Client } = require('pg');

const databases = {
  production: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  staging: 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging',
  devtest: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest'
};

async function checkAndMigrateEnv(envName, connString) {
  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(`\n📍 ${envName.toUpperCase()}`);
    console.log('─'.repeat(60));

    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'timezone'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ timezone column already exists');
      return true;
    }

    console.log('❌ timezone column MISSING - applying migration...');

    // Add timezone column
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
    `);
    console.log('✓ Added timezone column to users table');

    // Add index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_timezone
      ON users(timezone);
    `);
    console.log('✓ Created index on timezone column');

    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users'
      AND column_name = 'timezone'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ timezone column successfully added!');
      return true;
    } else {
      console.log('❌ Failed to verify timezone column');
      return false;
    }

  } catch (error) {
    console.error(`❌ Error:`, error.message);
    return false;
  } finally {
    await client.end();
  }
}

async function syncAll() {
  console.log('🔄 Synchronizing timezone column across all environments');
  console.log('═'.repeat(60));

  const results = {};
  for (const [env, connString] of Object.entries(databases)) {
    results[env] = await checkAndMigrateEnv(env, connString);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(60));
  for (const [env, success] of Object.entries(results)) {
    const status = success ? '✅ OK' : '❌ FAILED';
    console.log(`${status} ${env.toUpperCase()}`);
  }
  console.log('═'.repeat(60));
}

syncAll();
