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

  client.query(`
    SELECT billing_term_months, billing_cycle, COUNT(*) as count 
    FROM accounts 
    WHERE deleted_at IS NULL
    GROUP BY billing_term_months, billing_cycle 
    ORDER BY count DESC;
  `, (err, res) => {
    if (err) {
      console.error('Query error:', err.message);
      client.end();
      process.exit(1);
    }
    
    console.log('\n=== ACCOUNTS BILLING TERMS AUDIT ===\n');
    console.log('Months | Billing Cycle    | Count');
    console.log('-------|------------------+-------');
    
    res.rows.forEach(row => {
      const months = String(row.billing_term_months || 'NULL').padEnd(6);
      const cycle = String(row.billing_cycle || 'NULL').padEnd(16);
      console.log(`${months} | ${cycle} | ${row.count}`);
    });
    
    console.log('\nTotal account records:', res.rows.reduce((sum, row) => sum + parseInt(row.count), 0));
    
    // Analyze matches
    console.log('\n=== VERIFICATION ===');
    const mappings = {
      '1': 'monthly',
      '3': 'quarterly',
      '6': 'semi-annual',
      '12': 'annual',
      '24': 'biennial'
    };
    
    let allMatch = true;
    res.rows.forEach(row => {
      const expectedCycle = mappings[row.billing_term_months];
      const matches = expectedCycle === (row.billing_cycle || '').toLowerCase();
      if (!matches) {
        allMatch = false;
      }
      const status = matches ? '✅' : '❌';
      console.log(`${status} billing_term_months=${row.billing_term_months} → billing_cycle="${row.billing_cycle}" (expected: "${expectedCycle}")`);
    });
    
    console.log('\n' + (allMatch ? '✅ All records match!' : '⚠️  Some records do not match'));
    
    client.end();
  });
});
