const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000
});

client.connect((err) => {
  if (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  }

  client.query('SELECT term, COUNT(*) as count FROM transactions GROUP BY term ORDER BY count DESC;', (err, res) => {
    if (err) {
      console.error('Query error:', err.message);
      client.end();
      process.exit(1);
    }
    
    console.log('\n=== TRANSACTIONS.TERM AUDIT ===\n');
    console.log('Term Value | Count');
    console.log('-----------+-------');
    
    res.rows.forEach(row => {
      console.log(`${String(row.term).padEnd(10)} | ${row.count}`);
    });
    
    console.log('\n' + res.rows.length + ' distinct term values found');
    console.log('Total transactions:', res.rows.reduce((sum, row) => sum + parseInt(row.count), 0));
    
    client.end();
  });
});
