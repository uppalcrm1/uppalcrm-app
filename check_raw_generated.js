const { Client } = require('pg');

async function check(name, connStr) {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query(`
      SELECT column_name, is_generated, generation_expression 
      FROM information_schema.columns 
      WHERE table_name = 'contacts'
      AND column_name IN ('status', 'source', 'contact_status', 'contact_source')
      ORDER BY column_name;
    `);
    
    console.log('\n' + name + ':');
    result.rows.forEach(row => {
      console.log('  ' + row.column_name.padEnd(18) + ' | is_generated=' + row.is_generated + ' | expr=' + (row.generation_expression || 'NULL'));
    });
    
    await client.end();
  } catch (error) {
    console.error(name + ' Error:', error.message);
  }
}

const devtest = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';
const staging = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const production = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

(async () => {
  await check('PRODUCTION', production);
  await check('DEVTEST', devtest);
  await check('STAGING', staging);
})();
