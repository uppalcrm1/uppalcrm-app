require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncAllSourceFields() {
  try {
    console.log('🔧 Syncing all entity source fields...\n');
    
    // Copy leads options to contacts and accounts
    const result = await pool.query(`
      WITH leads_options AS (
        SELECT field_options
        FROM default_field_configurations
        WHERE entity_type = 'leads' 
          AND field_name = 'source'
          AND organization_id = '06048209-8ab4-4816-b23c-6f6362fea521'
        LIMIT 1
      )
      UPDATE default_field_configurations dfc
      SET field_options = lo.field_options
      FROM leads_options lo
      WHERE dfc.entity_type IN ('contacts', 'accounts')
        AND dfc.field_name = 'source'
        AND dfc.organization_id = '06048209-8ab4-4816-b23c-6f6362fea521'
      RETURNING dfc.entity_type, jsonb_array_length(dfc.field_options) as option_count
    `);
    
    console.log('✅ Updated entities:');
    for (const row of result.rows) {
      console.log(`   ${row.entity_type}: ${row.option_count} options`);
    }
    
    // Verify all
    const verify = await pool.query(`
      SELECT entity_type, jsonb_array_length(field_options) as count
      FROM default_field_configurations
      WHERE field_name = 'source'
        AND organization_id = '06048209-8ab4-4816-b23c-6f6362fea521'
      ORDER BY entity_type
    `);
    
    console.log('\n📋 All source configurations:');
    for (const row of verify.rows) {
      console.log(`   ${row.entity_type}: ${row.count} options`);
    }
    
    await pool.end();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

syncAllSourceFields();
