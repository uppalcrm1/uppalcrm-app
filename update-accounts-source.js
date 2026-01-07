require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateAccountsSource() {
  try {
    console.log('🔧 Updating accounts source field...\n');
    
    // Get the latest leads source configuration
    const leadsResult = await pool.query(`
      SELECT field_options
      FROM default_field_configurations
      WHERE entity_type = 'leads' AND field_name = 'source'
      ORDER BY id DESC
      LIMIT 1
    `);
    
    const leadsOptions = leadsResult.rows[0].field_options;
    
    // Update default_field_configurations for accounts (field_options is already JSONB)
    const updateResult = await pool.query(`
      UPDATE default_field_configurations
      SET field_options = $1::jsonb
      WHERE entity_type = 'accounts' 
        AND field_name = 'source'
        AND organization_id = '06048209-8ab4-4816-b23c-6f6362fea521'
      RETURNING jsonb_array_length(field_options) as option_count
    `, [JSON.stringify(leadsOptions)]);
    
    if (updateResult.rowCount > 0) {
      console.log('✅ Updated accounts source configuration');
      console.log(`   Options: ${updateResult.rows[0].option_count} items\n`);
    } else {
      console.log('❌ No rows updated\n');
    }
    
    // Verify all entities
    console.log('📋 All entities source configurations:');
    const verification = await pool.query(`
      SELECT 
        entity_type,
        jsonb_array_length(field_options) as option_count
      FROM default_field_configurations
      WHERE field_name = 'source'
        AND organization_id = '06048209-8ab4-4816-b23c-6f6362fea521'
      ORDER BY entity_type
    `);
    
    for (const row of verification.rows) {
      console.log(`  ${row.entity_type}: ${row.option_count} options`);
    }
    
    await pool.end();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateAccountsSource();
