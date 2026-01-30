const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest',
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await client.connect();
  
  console.log('Checking DEVTEST schema...');
  const schemaResult = await client.query(`
    SELECT column_name, is_generated, generation_expression 
    FROM information_schema.columns 
    WHERE table_name = 'contacts' 
    AND column_name IN ('status', 'source', 'contact_status', 'contact_source')
    ORDER BY column_name;
  `);
  
  console.log('\nDEVTEST Schema:');
  schemaResult.rows.forEach(row => {
    console.log('  ' + row.column_name.padEnd(18) + ' | ' + row.is_generated + ' | ' + (row.generation_expression || 'NULL'));
  });
  
  console.log('\nTesting UPDATE on DEVTEST...');
  try {
    const result = await client.query(
      'UPDATE contacts SET status = $1 WHERE id = (SELECT id FROM contacts LIMIT 1) RETURNING id, status',
      ['active']
    );
    console.log('✅ UPDATE WORKED:', result.rows);
  } catch (error) {
    console.log('❌ UPDATE FAILED:', error.message);
  }
  
  await client.end();
})();
