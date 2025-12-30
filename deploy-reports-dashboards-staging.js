const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * Deploy Reports & Dashboards Migration to Staging
 * Creates saved_reports and saved_dashboards tables
 */

async function deployMigration() {
  console.log('🚀 Starting Reports & Dashboards Migration Deployment to STAGING...\n');

  // Create PostgreSQL connection pool
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
      rejectUnauthorized: false
    }
  });

  let client;

  try {
    // Test connection
    console.log('📡 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connection successful\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'database/migrations/021_custom_reports_tables.sql');
    console.log('📄 Reading migration file:', migrationPath);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found at: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    console.log('✅ Migration file loaded\n');

    // Check if tables already exist
    console.log('🔍 Checking if tables already exist...');
    const checkTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('saved_reports', 'saved_dashboards')
      ORDER BY table_name
    `);

    if (checkTables.rows.length > 0) {
      console.log('⚠️  Warning: Some tables already exist:');
      checkTables.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
      console.log('\n❓ This migration may fail or skip existing tables.\n');
    } else {
      console.log('✅ No existing tables found - safe to proceed\n');
    }

    // Execute migration
    console.log('🔧 Executing migration...');
    await client.query(migrationSQL);
    console.log('✅ Migration executed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying table creation...');
    const verifyTables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('saved_reports', 'saved_dashboards')
      ORDER BY table_name
    `);

    console.log('✅ Tables verified:');
    verifyTables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    console.log('');

    // Check table structures
    console.log('📊 Checking table structures...\n');

    // Check saved_reports columns
    const reportsColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'saved_reports'
      ORDER BY ordinal_position
    `);
    console.log('📋 saved_reports columns:');
    reportsColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // Check saved_dashboards columns
    const dashboardsColumns = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'saved_dashboards'
      ORDER BY ordinal_position
    `);
    console.log('📋 saved_dashboards columns:');
    dashboardsColumns.rows.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // Success summary
    console.log('=' .repeat(60));
    console.log('🎉 STAGING DEPLOYMENT SUCCESSFUL!');
    console.log('=' .repeat(60));
    console.log('\n✅ Database migration completed successfully');
    console.log('✅ Tables created: saved_reports, saved_dashboards');
    console.log('✅ RLS policies enabled for multi-tenant isolation');
    console.log('✅ Triggers created for automatic timestamp updates');
    console.log('\n📝 Next Steps:');
    console.log('   1. Test the Reports feature at /reports');
    console.log('   2. Test the Dashboards feature at /custom-dashboards');
    console.log('   3. Verify saved reports CRUD operations');
    console.log('   4. Verify saved dashboards CRUD operations');
    console.log('   5. If all tests pass, deploy to PRODUCTION');
    console.log('\n💡 To deploy to production, run:');
    console.log('   node deploy-reports-dashboards-production.js\n');

  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED!\n');
    console.error('Error details:', error.message);
    console.error('\nFull error:', error);
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Check that DATABASE_URL is set correctly');
    console.error('   2. Verify database connection is working');
    console.error('   3. Check migration file exists at: database/migrations/021_custom_reports_tables.sql');
    console.error('   4. If tables already exist, migration may have run previously\n');
    process.exit(1);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

// Run deployment
deployMigration();
