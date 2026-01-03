require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function deployCurrencyMigration() {
  const isLocalhost = process.env.DATABASE_URL?.includes('localhost') ||
                     process.env.DATABASE_URL?.includes('127.0.0.1') ||
                     !process.env.DATABASE_URL;

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocalhost ? false : { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Starting currency configuration migration...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/022_add_currency_configuration.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    console.log('📄 Migration file loaded\n');

    // Execute migration
    console.log('⚙️  Executing migration...');
    await pool.query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify configuration was inserted
    console.log('🔍 Verifying configuration...');
    const result = await pool.query(`
      SELECT
        config_key,
        config_value,
        description
      FROM system_config
      WHERE config_key IN ('exchange_rate_usd_to_cad', 'default_reporting_currency')
      LIMIT 5
    `);

    if (result.rows.length > 0) {
      console.log('✅ Configuration verified:');
      result.rows.forEach(row => {
        console.log(`   - ${row.config_key}: ${row.config_value}`);
        console.log(`     ${row.description}`);
      });
    } else {
      console.log('⚠️  Warning: No configuration found. This might be expected if organizations table is empty.');
    }

    console.log('\n✅ Currency migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Restart the backend server to load new services');
    console.log('2. Test creating a transaction with CAD currency');
    console.log('3. Test creating a transaction with USD currency');
    console.log('4. Verify revenue reporting shows CAD total');
    console.log('5. Test updating exchange rate from settings');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration
deployCurrencyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
