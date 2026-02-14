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

  // First query: billing_term_months distribution
  client.query(`
    SELECT billing_term_months, COUNT(*) as count 
    FROM accounts 
    WHERE deleted_at IS NULL
    GROUP BY billing_term_months 
    ORDER BY count DESC;
  `, (err, res) => {
    if (err) {
      console.error('Query error:', err.message);
      client.end();
      process.exit(1);
    }
    
    console.log('\n=== ACCOUNTS.BILLING_TERM_MONTHS AUDIT ===\n');
    console.log('Billing Term Months | Count');
    console.log('--------------------+-------');
    
    let totalCount = 0;
    res.rows.forEach(row => {
      const months = String(row.billing_term_months || 'NULL').padEnd(19);
      console.log(`${months} | ${row.count}`);
      totalCount += parseInt(row.count);
    });
    
    console.log('\nTotal active accounts:', totalCount);
    
    // Check for NULL values
    const hasNull = res.rows.some(r => r.billing_term_months === null);
    if (hasNull) {
      console.log('⚠️  WARNING: Found NULL values in billing_term_months');
    } else {
      console.log('✅ No NULL values found');
    }
    
    // Verify all values are expected
    const expectedValues = [1, 3, 6, 12, 24];
    const foundValues = res.rows.map(r => r.billing_term_months).filter(v => v !== null);
    const unexpected = foundValues.filter(v => !expectedValues.includes(v));
    
    if (unexpected.length > 0) {
      console.log('⚠️  WARNING: Found unexpected values:', unexpected);
    } else {
      console.log('✅ All values are expected billing terms (1, 3, 6, 12, 24)');
    }
    
    // Check if billing_cycle exists in custom_fields
    console.log('\n=== CHECKING FOR BILLING_CYCLE IN CUSTOM_FIELDS ===\n');
    client.query(`
      SELECT 
        billing_term_months,
        custom_fields->>'billing_cycle' as billing_cycle_from_custom,
        COUNT(*) as count
      FROM accounts 
      WHERE deleted_at IS NULL
      GROUP BY billing_term_months, custom_fields->>'billing_cycle'
      ORDER BY count DESC;
    `, (err2, res2) => {
      if (err2) {
        console.log('Could not query custom_fields for billing_cycle');
      } else {
        console.log('Billing Term Months | Billing Cycle (from custom_fields) | Count');
        console.log('--------------------+-----------------------------------+-------');
        
        res2.rows.forEach(row => {
          const months = String(row.billing_term_months || 'NULL').padEnd(19);
          const cycle = String(row.billing_cycle_from_custom || 'NOT SET').padEnd(33);
          console.log(`${months} | ${cycle} | ${row.count}`);
        });
      }
      
      client.end();
    });
  });
});
