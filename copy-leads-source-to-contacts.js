require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function copyLeadsSourceToContacts() {
  try {
    console.log('🔧 Copying leads source options to contacts...\n');
    
    // Get the latest leads source configuration
    const leadsResult = await pool.query(`
      SELECT field_options
      FROM default_field_configurations
      WHERE entity_type = 'leads' AND field_name = 'source'
      ORDER BY id DESC
      LIMIT 1
    `);
    
    if (leadsResult.rows.length === 0) {
      console.log('❌ No leads source configuration found');
      await pool.end();
      return;
    }
    
    const leadsOptions = leadsResult.rows[0].field_options;
    console.log('📋 Leads source options:');
    console.log(JSON.stringify(leadsOptions, null, 2));
    
    // Insert into default_field_configurations for contacts
    const insertResult = await pool.query(`
      INSERT INTO default_field_configurations (
        entity_type,
        field_name,
        field_options,
        is_enabled,
        is_required,
        organization_id
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, ['contacts', 'source', JSON.stringify(leadsOptions), true, false, '06048209-8ab4-4816-b23c-6f6362fea521']);
    
    console.log('\n✅ Created contacts source configuration in default_field_configurations');
    console.log('   Options:', insertResult.rows[0].field_options.length, 'items');
    
    await pool.end();
    console.log('\n✅ Done! Contacts will now use the same source options as leads.');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

copyLeadsSourceToContacts();
