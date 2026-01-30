const { Client } = require('pg');

async function check(name, connStr) {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT column_name, data_type, is_generated, generation_expression 
      FROM information_schema.columns 
      WHERE table_name = 'contacts'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n' + name + ' - CONTACT COLUMNS:');
    console.log('================================================');
    
    result.rows.forEach(row => {
      const statusCols = ['status', 'source', 'contact_status', 'contact_source'];
      const marker = statusCols.includes(row.column_name) ? ' <<< KEY' : '';
      const gen = row.is_generated ? 'GEN' : 'NORM';
      const expr = row.generation_expression || '(none)';
      console.log(row.column_name.padEnd(25) + ' | ' + gen + ' | ' + expr.substring(0, 30) + marker);
    });
    
    await client.end();
  } catch (error) {
    console.error(name + ' Error:', error.message);
  }
}

const devtest = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';
const staging = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';

(async () => {
  await check('DEVTEST', devtest);
  await check('STAGING', staging);
})();
