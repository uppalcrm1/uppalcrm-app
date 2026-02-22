const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DEVTEST_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log('🔄 Running Migration 044: Add is_first_login and failed_login_attempts columns...\n');

    // Add is_first_login column
    try {
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN DEFAULT false
      `);
      console.log('✅ Added is_first_login column to users table');
    } catch (e) {
      if (e.code === '42701') {
        console.log('ℹ️  is_first_login column already exists');
      } else {
        throw e;
      }
    }

    // Add failed_login_attempts column
    try {
      await client.query(`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0
      `);
      console.log('✅ Added failed_login_attempts column to users table');
    } catch (e) {
      if (e.code === '42701') {
        console.log('ℹ️  failed_login_attempts column already exists');
      } else {
        throw e;
      }
    }

    // Add index for is_first_login queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_is_first_login ON users(is_first_login)
      WHERE is_first_login = true
    `);
    console.log('✅ Added index on is_first_login column');

    // Verify the schema
    console.log('\n📊 Verified users table schema:');
    const result = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('is_first_login', 'failed_login_attempts')
      ORDER BY ordinal_position
    `);
    result.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name}: ${col.data_type} (default: ${col.column_default || 'none'})`);
    });

    console.log('\n🎉 Migration 044 completed successfully!\n');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
