const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function test() {
  try {
    await client.connect();
    console.log('\n=== TESTING CONTACT UPDATE ===\n');

    // Get a contact ID
    const contactResult = await client.query('SELECT id FROM contacts LIMIT 1');
    if (contactResult.rows.length === 0) {
      console.log('No contacts found to test');
      await client.end();
      return;
    }

    const contactId = contactResult.rows[0].id;
    console.log('Testing with contact ID:', contactId);

    // Test 1: Update status
    console.log('\nTest 1: UPDATE status...');
    try {
      const result1 = await client.query(
        'UPDATE contacts SET status = $1 WHERE id = $2 RETURNING id, status',
        ['inactive', contactId]
      );
      console.log('✅ Status update WORKED:', result1.rows[0]);
    } catch (error) {
      console.log('❌ Status update FAILED:', error.message);
    }

    // Test 2: Update source
    console.log('\nTest 2: UPDATE source...');
    try {
      const result2 = await client.query(
        'UPDATE contacts SET source = $1 WHERE id = $2 RETURNING id, source',
        ['referral', contactId]
      );
      console.log('✅ Source update WORKED:', result2.rows[0]);
    } catch (error) {
      console.log('❌ Source update FAILED:', error.message);
    }

    // Test 3: Query with filters
    console.log('\nTest 3: Query with status filter...');
    try {
      const result3 = await client.query(
        'SELECT id, status, source FROM contacts WHERE status = $1 LIMIT 1',
        ['inactive']
      );
      console.log('✅ Query WORKED - Found', result3.rows.length, 'contact(s) with status=inactive');
    } catch (error) {
      console.log('❌ Query FAILED:', error.message);
    }

    console.log('\n=== ALL TESTS COMPLETE ===\n');
    await client.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

test();
