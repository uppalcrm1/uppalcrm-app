const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to PRODUCTION');

    console.log('Dropping status column...');
    await client.query('ALTER TABLE contacts DROP COLUMN IF EXISTS status CASCADE');
    console.log('OK');

    console.log('Dropping source column...');
    await client.query('ALTER TABLE contacts DROP COLUMN IF EXISTS source CASCADE');
    console.log('OK');

    console.log('Renaming contact_status to status...');
    await client.query('ALTER TABLE contacts RENAME COLUMN contact_status TO status');
    console.log('OK');

    console.log('Renaming contact_source to source...');
    await client.query('ALTER TABLE contacts RENAME COLUMN contact_source TO source');
    console.log('OK');

    console.log('\nVerifying...');
    const result = await client.query('SELECT column_name, is_generated FROM information_schema.columns WHERE table_name = "contacts" AND column_name IN (\'status\', \'source\') ORDER BY column_name');
    
    console.log('Results:');
    result.rows.forEach(row => {
      console.log('  ' + row.column_name + ' | ' + row.is_generated);
    });

    console.log('\nMigration complete!');
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

run();
