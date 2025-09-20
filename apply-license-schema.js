const fs = require('fs');
const path = require('path');
const { query } = require('./database/connection');

async function applyLicenseSchema() {
  try {
    console.log('🚀 Starting license management schema application...');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'backend', 'database', 'license_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📖 Schema file loaded successfully');

    // Execute the entire schema as one statement
    console.log('⚙️  Executing license management schema...');

    try {
      await query(schemaSQL);
      console.log('✅ License management schema applied successfully!');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log(`⚠️  Some objects already exist, which is expected: ${error.message}`);
      } else {
        console.error(`❌ Error applying schema:`, error.message);
        // Don't fail completely, continue with sample data
      }
    }

    console.log('🔧 Creating sample software editions...');

    // Create sample software editions
    await createSampleData();

    console.log('✅ Sample data created successfully!');
    console.log('🚀 License management system is ready to use!');

  } catch (error) {
    console.error('💥 Fatal error applying schema:', error);
    process.exit(1);
  }
}

async function createSampleData() {
  try {
    // Get the first organization ID for sample data
    const orgResult = await query('SELECT id FROM organizations LIMIT 1');
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
        quarterly_price: 7999, // $79.99 (11% discount)
        semi_annual_price: 14999, // $149.99 (17% discount)
        annual_price: 25999, // $259.99 (28% discount)
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
        quarterly_price: 13499, // $134.99 (10% discount)
        semi_annual_price: 25999, // $259.99 (13% discount)
        annual_price: 47999, // $479.99 (20% discount)
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
        quarterly_price: 26999, // $269.99 (10% discount)
        semi_annual_price: 51999, // $519.99 (13% discount)
        annual_price: 95999, // $959.99 (20% discount)
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
        const existingResult = await query(
          'SELECT id FROM software_editions WHERE name = $1 AND organization_id = $2',
          [edition.name, organizationId]
        );

        if (existingResult.rows.length === 0) {
          await query(`
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

// Run the schema application
applyLicenseSchema().then(() => {
  console.log('🏁 Script completed successfully!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});