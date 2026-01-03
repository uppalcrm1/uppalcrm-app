require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function deployCurrencyMigrationStaging() {
  console.log('🚀 Deploying Currency Feature to STAGING\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check for staging database URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ ERROR: DATABASE_URL not found in .env');
    console.error('   Please ensure .env exists with DATABASE_URL');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Test connection
    console.log('📡 Connecting to staging database...');
    const client = await pool.connect();
    const dbCheck = await client.query('SELECT current_database(), current_user');
    console.log(`✅ Connected to: ${dbCheck.rows[0].current_database}`);
    console.log(`   User: ${dbCheck.rows[0].current_user}\n`);
    client.release();

    // Read migration file
    console.log('📄 Loading migration file...');
    const migrationPath = path.join(__dirname, '../database/migrations/022_add_currency_configuration.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    console.log('✅ Migration file loaded\n');

    // Execute migration
    console.log('⚙️  Executing currency configuration migration...');
    console.log('   This will:');
    console.log('   - Create system_config table');
    console.log('   - Set exchange rate: 1 USD = 1.25 CAD');
    console.log('   - Set reporting currency: CAD');
    console.log('   - Add currency constraints to transactions\n');

    await pool.query(migrationSQL);
    console.log('✅ Migration executed successfully!\n');

    // Verify configuration
    console.log('🔍 Verifying configuration...');
    const configResult = await pool.query(`
      SELECT
        config_key,
        config_value,
        description
      FROM system_config
      WHERE config_key IN ('exchange_rate_usd_to_cad', 'default_reporting_currency')
      ORDER BY config_key
    `);

    if (configResult.rows.length > 0) {
      console.log('✅ Configuration verified:\n');
      configResult.rows.forEach(row => {
        console.log(`   📌 ${row.config_key}`);
        console.log(`      Value: ${row.config_value}`);
        console.log(`      ${row.description}\n`);
      });
    } else {
      console.log('⚠️  Warning: No configuration found.');
      console.log('   This might happen if organizations table is empty.\n');
    }

    // Check organizations count
    const orgResult = await pool.query('SELECT COUNT(*) as count FROM organizations');
    console.log(`📊 Organizations in staging: ${orgResult.rows[0].count}`);

    // Check if system_config table exists and has data
    const configCount = await pool.query('SELECT COUNT(*) as count FROM system_config');
    console.log(`📊 Configuration entries: ${configCount.rows[0].count}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ STAGING DEPLOYMENT SUCCESSFUL!\n');
    console.log('📋 NEXT STEPS:\n');
    console.log('1. Restart staging backend server');
    console.log('   - Go to Render dashboard');
    console.log('   - Find your backend service');
    console.log('   - Click "Manual Deploy" → "Deploy latest commit"\n');
    console.log('2. Test creating a CAD transaction');
    console.log('3. Test creating a USD transaction');
    console.log('4. Verify revenue shows in CAD');
    console.log('5. Test updating exchange rate from settings\n');
    console.log('🌐 Staging URL: https://uppalcrm-frontend-staging.onrender.com\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run deployment
deployCurrencyMigrationStaging()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
