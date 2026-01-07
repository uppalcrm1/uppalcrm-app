require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function clearAssignedToOptions() {
  try {
    const orgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    
    console.log('🔧 Clearing invalid custom options for assignedTo field...\n');
    
    // Update all assignedTo fields in default_field_configurations to have null options
    const result = await pool.query(`
      UPDATE default_field_configurations
      SET field_options = NULL
      WHERE field_name = 'assignedTo'
        AND organization_id = $1
      RETURNING entity_type, field_name
    `, [orgId]);
    
    if (result.rowCount > 0) {
      console.log(`✅ Cleared options for ${result.rowCount} assignedTo field(s):`);
      result.rows.forEach(row => {
        console.log(`   - ${row.entity_type}`);
      });
    } else {
      console.log('No assignedTo fields found with custom options');
    }
    
    console.log('\n✅ The "Assign To" field will now correctly load users from your organization.');
    
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

clearAssignedToOptions();
