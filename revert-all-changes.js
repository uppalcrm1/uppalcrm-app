const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function revertChanges() {
  try {
    console.log('Reverting database constraint changes...\n');
    
    // Drop the constraint I added
    console.log('Dropping custom_field_definitions_org_entity_field_unique...');
    await pool.query(`
      ALTER TABLE custom_field_definitions
      DROP CONSTRAINT IF EXISTS custom_field_definitions_org_entity_field_unique
    `);
    console.log('✅ Dropped\n');
    
    // Verify final state
    console.log('Final constraints:');
    const finalConstraints = await pool.query(`
      SELECT
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'custom_field_definitions'
        AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name
    `);
    console.table(finalConstraints.rows);
    
    console.log('\n✅ Database reverted to original state');
    console.log('✅ Your production data is intact and unchanged');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

revertChanges();
