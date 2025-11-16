const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration: Add device and billing fields to accounts table');
    console.log('Database:', DATABASE_URL.split('@')[1]);

    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'migrations', '016_add_device_fields_to_accounts.sql'),
      'utf8'
    );

    // Run migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   Added columns:');
    console.log('   - device_name, mac_address, device_registered_at');
    console.log('   - license_key, license_status');
    console.log('   - billing_cycle, price, currency');
    console.log('   - is_trial, trial_start_date, trial_end_date');
    console.log('   - subscription_start_date, subscription_end_date, next_renewal_date');
    console.log('   - notes, custom_fields');

    // Verify the changes
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'accounts'
      AND column_name IN ('device_name', 'mac_address', 'billing_cycle', 'is_trial')
      ORDER BY column_name
    `);

    console.log('\n📋 Verified new columns:');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
