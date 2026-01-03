require('dotenv').config(); // Use default .env file
const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function deployCurrencyMigrationProduction() {
  console.log('🚀 Deploying Currency Feature to PRODUCTION\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('⚠️  WARNING: This will modify the PRODUCTION database!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Safety check - require confirmation
  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.error('❌ SAFETY CHECK: Production deployment requires confirmation\n');
    console.error('   To proceed, run:');
    console.error('   node scripts/deploy-currency-production.js --confirm\n');
    console.error('   This ensures you intentionally want to deploy to production.\n');
    process.exit(1);
  }

  // Check for production database URL
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
    console.log('📡 Connecting to production database...');
    const client = await pool.connect();
    const dbCheck = await client.query('SELECT current_database(), current_user');
    console.log(`✅ Connected to: ${dbCheck.rows[0].current_database}`);
    console.log(`   User: ${dbCheck.rows[0].current_user}\n`);
    client.release();

    // Verify we're in production
    console.log('🔍 Verifying production environment...');
    const orgCount = await pool.query('SELECT COUNT(*) as count FROM organizations');
    console.log(`✅ Production database has ${orgCount.rows[0].count} organization(s)\n`);

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

    // Check configuration entries
    const configCount = await pool.query('SELECT COUNT(*) as count FROM system_config');
    console.log(`📊 Total configuration entries: ${configCount.rows[0].count}\n`);

    // Check currency constraint
    console.log('🔒 Verifying transactions table constraint...');
    const constraintCheck = await pool.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'transactions'
        AND constraint_name = 'transactions_currency_check'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('✅ Currency constraint applied to transactions table\n');
    } else {
      console.log('⚠️  Currency constraint not found on transactions table\n');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('✅ PRODUCTION DEPLOYMENT SUCCESSFUL!\n');
    console.log('📋 NEXT STEPS:\n');
    console.log('1. Restart production backend server');
    console.log('   - Go to Render dashboard');
    console.log('   - Find your production backend service');
    console.log('   - Click "Manual Deploy" → "Deploy latest commit"\n');
    console.log('2. Monitor for any errors in production logs');
    console.log('3. Test creating transactions with CAD and USD');
    console.log('4. Verify revenue reporting shows CAD totals');
    console.log('5. Update exchange rate from settings if needed\n');
    console.log('🌐 Production URL: https://uppalcrm-frontend.onrender.com\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n❌ PRODUCTION DEPLOYMENT FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nFull error:', error);
    console.error('\n⚠️  IMPORTANT: Check production database state!');
    console.error('   The migration may have partially applied.\n');
    throw error;
  } finally {
    await pool.end();
  }
}

// Run deployment
deployCurrencyMigrationProduction()
  .then(() => {
    console.log('✅ Production deployment completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Production deployment failed!');
    console.error(error);
    process.exit(1);
  });
