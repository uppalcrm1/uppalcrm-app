require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function updateToTwoOptions() {
  try {
    const orgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    
    console.log('🔧 Updating leads source to have only 2 options as configured...\n');
    
    const twoOptions = [
      { label: 'Free Trial Form', value: 'free_trial_form' },
      { label: 'Website Order', value: 'website_order' }
    ];
    
    const result = await pool.query(`
      UPDATE default_field_configurations
      SET field_options = $1::jsonb
      WHERE entity_type = 'leads'
        AND field_name = 'source'
        AND organization_id = $2
      RETURNING id, field_options
    `, [JSON.stringify(twoOptions), orgId]);
    
    console.log('✅ Updated leads source field:');
    console.log(`   ID: ${result.rows[0].id}`);
    console.log(`   Options: ${result.rows[0].field_options.length} items`);
    result.rows[0].field_options.forEach((opt, i) => {
      console.log(`     ${i + 1}. ${opt.label}`);
    });
    
    // Also update contacts and accounts to match
    console.log('\n🔧 Updating contacts source to match...');
    await pool.query(`
      UPDATE default_field_configurations
      SET field_options = $1::jsonb
      WHERE entity_type = 'contacts'
        AND field_name = 'source'
        AND organization_id = $2
    `, [JSON.stringify(twoOptions), orgId]);
    
    console.log('🔧 Updating accounts source to match...');
    await pool.query(`
      UPDATE default_field_configurations
      SET field_options = $1::jsonb
      WHERE entity_type = 'accounts'
        AND field_name = 'source'
        AND organization_id = $2
    `, [JSON.stringify(twoOptions), orgId]);
    
    console.log('\n✅ All entities updated to have 2 options!');
    console.log('   - Free Trial Form');
    console.log('   - Website Order');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updateToTwoOptions();
