const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    await client.connect();
    const result = await client.query(`
      SELECT column_name, data_type, is_generated, generation_expression 
      FROM information_schema.columns 
      WHERE table_name = 'contacts' 
      AND column_name IN ('status', 'source', 'contact_status', 'contact_source') 
      ORDER BY column_name;
    `);
    
    console.log('\n✅ DEVTEST SCHEMA:\n');
    result.rows.forEach(row => {
      console.log(
        row.column_name.padEnd(18) + ' | ' +
        row.data_type.padEnd(17) + ' | ' +
        (row.is_generated ? 'GENERATED' : 'NORMAL   ') + ' | ' +
        (row.generation_expression || '(none)')
      );
    });
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();
