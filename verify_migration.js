const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function verify() {
  try {
    await client.connect();
    const result = await client.query(`SELECT column_name, is_generated FROM information_schema.columns WHERE table_name = 'contacts' AND column_name IN ('status', 'source') ORDER BY column_name`);
    
    console.log('\nMIGRATION VERIFICATION:');
    console.log('=====================\n');
    result.rows.forEach(row => {
      const marker = row.is_generated === 'NEVER' ? '✅' : '❌';
      console.log(marker + ' ' + row.column_name.padEnd(10) + ' | is_generated = ' + row.is_generated);
    });
    
    if (result.rows.length === 2 && result.rows.every(r => r.is_generated === 'NEVER')) {
      console.log('\n✅ MIGRATION SUCCESSFUL - PRODUCTION FIXED!');
    }
    
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

verify();
