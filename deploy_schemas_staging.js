const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Staging database configuration
const stagingDbConfig = process.env.STAGING_DATABASE_URL ? {
  connectionString: process.env.STAGING_DATABASE_URL,
  ssl: process.env.STAGING_DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
} : {
  host: process.env.STAGING_DB_HOST || 'localhost',
  port: process.env.STAGING_DB_PORT || 5432,
  database: process.env.STAGING_DB_NAME,
  user: process.env.STAGING_DB_USER,
  password: process.env.STAGING_DB_PASSWORD,
  ssl: false
};

const pool = new Pool(stagingDbConfig);

async function deploySchemas() {
  try {
    console.log('🚀 Deploying schemas to staging environment...');
    console.log('Database:', process.env.STAGING_DATABASE_URL?.split('@')[1]?.split('/')[0] || 'staging');

    // Apply import schema
    console.log('\n📋 Applying import schema...');
    const importSchemaPath = path.join(__dirname, 'backend', 'database', 'import_schema.sql');
    const importSql = fs.readFileSync(importSchemaPath, 'utf8');

    await pool.query(importSql);
    console.log('✅ Import schema applied successfully');

    // Apply license schema
    console.log('\n🔑 Applying license schema...');
    const licenseSchemaPath = path.join(__dirname, 'backend', 'database', 'license_schema.sql');
    const licenseSql = fs.readFileSync(licenseSchemaPath, 'utf8');

    await pool.query(licenseSql);
    console.log('✅ License schema applied successfully');

    // Verify tables were created
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'import_jobs', 'import_errors', 'import_field_mappings',
        'software_editions', 'software_licenses', 'trials',
        'device_registrations', 'downloads_activations'
      )
      ORDER BY table_name;
    `);

    console.log('\n📋 Created tables:', tablesResult.rows.map(row => row.table_name));
    console.log('\n🎉 All schemas deployed successfully to staging!');

  } catch (error) {
    console.error('❌ Error deploying schemas:', error.message);
    if (error.message.includes('already exists')) {
      console.log('ℹ️  Some tables already exist, which is expected');
    } else {
      console.error(error.stack);
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

deploySchemas();