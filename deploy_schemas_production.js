const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Production database configuration - use the main DATABASE_URL for now
const productionDbConfig = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL ? {
  connectionString: process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
};

const pool = new Pool(productionDbConfig);

async function deploySchemas() {
  try {
    console.log('🚀 Deploying schemas to production environment...');
    console.log('Database:', (process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL)?.split('@')[1]?.split('/')[0] || 'production');

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

    // Create sample software editions for production
    console.log('\n🏗️  Creating sample software editions...');
    await createSampleSoftwareEditions();

    console.log('\n🎉 All schemas deployed successfully to production!');

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

async function createSampleSoftwareEditions() {
  try {
    // Get the first organization ID for sample data
    const orgResult = await pool.query('SELECT id FROM organizations LIMIT 1');
    if (orgResult.rows.length === 0) {
      console.log('⚠️  No organizations found, skipping sample data creation');
      return;
    }

    const organizationId = orgResult.rows[0].id;
    console.log('🏢 Using organization:', organizationId);

    // Create sample software editions
    const editions = [
      {
        name: 'Smart',
        description: 'Essential features for small businesses',
        version: '1.0',
        monthly_price: 2999, // $29.99
        quarterly_price: 7999, // $79.99
        semi_annual_price: 14999, // $149.99
        annual_price: 25999, // $259.99
        features: {
          max_contacts: 1000,
          email_campaigns: true,
          basic_reporting: true,
          api_access: false,
          priority_support: false
        }
      },
      {
        name: 'Jio',
        description: 'Advanced features for growing businesses',
        version: '1.0',
        monthly_price: 4999, // $49.99
        quarterly_price: 13499, // $134.99
        semi_annual_price: 25999, // $259.99
        annual_price: 47999, // $479.99
        features: {
          max_contacts: 10000,
          email_campaigns: true,
          advanced_reporting: true,
          api_access: true,
          priority_support: false,
          automation: true
        }
      },
      {
        name: 'Gold',
        description: 'Premium features for enterprise businesses',
        version: '1.0',
        monthly_price: 9999, // $99.99
        quarterly_price: 26999, // $269.99
        semi_annual_price: 51999, // $519.99
        annual_price: 95999, // $959.99
        features: {
          max_contacts: 'unlimited',
          email_campaigns: true,
          advanced_reporting: true,
          api_access: true,
          priority_support: true,
          automation: true,
          white_label: true,
          dedicated_manager: true
        }
      }
    ];

    for (const edition of editions) {
      try {
        // Check if edition already exists
        const existingResult = await pool.query(
          'SELECT id FROM software_editions WHERE name = $1 AND organization_id = $2',
          [edition.name, organizationId]
        );

        if (existingResult.rows.length === 0) {
          await pool.query(`
            INSERT INTO software_editions (
              organization_id, name, description, version,
              monthly_price, quarterly_price, semi_annual_price, annual_price,
              features, is_active, is_trial_available, trial_duration_hours
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            organizationId,
            edition.name,
            edition.description,
            edition.version,
            edition.monthly_price,
            edition.quarterly_price,
            edition.semi_annual_price,
            edition.annual_price,
            JSON.stringify(edition.features),
            true, // is_active
            true, // is_trial_available
            24    // trial_duration_hours
          ]);

          console.log(`✅ Created software edition: ${edition.name}`);
        } else {
          console.log(`⚠️  Software edition already exists: ${edition.name}`);
        }
      } catch (error) {
        console.error(`❌ Error creating edition ${edition.name}:`, error.message);
      }
    }

  } catch (error) {
    console.error('Error creating sample data:', error);
  }
}

deploySchemas();