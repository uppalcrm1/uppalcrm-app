const fs = require('fs');
const path = require('path');
const { query } = require('../database/connection');

async function setupContactManagement() {
  console.log('🚀 Setting up Contact Management System...');

  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '../database/contact-management-schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('📋 Executing contact management schema...');

    // Execute the schema
    await query(schemaSql);

    console.log('✅ Contact management tables created successfully!');

    // Verify tables were created
    const tableCheck = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('contacts', 'contact_custom_fields', 'contact_field_values', 'contact_interactions')
      ORDER BY table_name
    `);

    console.log('📊 Created tables:');
    tableCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Check if uuid extension exists (required for uuid_generate_v4())
    const uuidCheck = await query(`
      SELECT * FROM pg_extension WHERE extname = 'uuid-ossp'
    `);

    if (uuidCheck.rows.length === 0) {
      console.log('🔧 Creating uuid-ossp extension...');
      await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
      console.log('✅ UUID extension created');
    } else {
      console.log('✅ UUID extension already exists');
    }

    console.log('🎉 Contact Management System setup complete!');

  } catch (error) {
    console.error('❌ Error setting up contact management:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupContactManagement()
    .then(() => {
      console.log('✅ Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupContactManagement };