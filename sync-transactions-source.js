require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncTransactionsSource() {
  try {
    const orgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    
    console.log('🔍 Getting current leads source options...\n');
    
    // Get the current leads source options
    const leadsResult = await pool.query(`
      SELECT field_options
      FROM default_field_configurations
      WHERE entity_type = 'leads'
        AND field_name = 'source'
        AND organization_id = $1
    `, [orgId]);
    
    if (leadsResult.rows.length === 0) {
      console.log('❌ No leads source configuration found');
      await pool.end();
      return;
    }
    
    const leadsOptions = leadsResult.rows[0].field_options;
    console.log(`Leads has ${leadsOptions.length} options:`);
    leadsOptions.forEach((opt, i) => {
      console.log(`  ${i + 1}. ${opt.label}`);
    });
    
    // Update transactions to match
    console.log('\n🔧 Updating transactions source to match...');
    await pool.query(`
      UPDATE default_field_configurations
      SET field_options = $1::jsonb
      WHERE entity_type = 'transactions'
        AND field_name = 'source'
        AND organization_id = $2
    `, [JSON.stringify(leadsOptions), orgId]);
    
    console.log('✅ Transactions source updated to match leads/contacts!');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

syncTransactionsSource();
