const axios = require('axios');
const db = require('./database/connection');

async function test() {
  // Check what accounts have renewal dates
  console.log('Checking accounts with renewal dates in DevTest database:\n');
  
  try {
    const result = await db.query(`
      SELECT 
        a.id,
        a.account_name,
        a.next_renewal_date,
        CURRENT_DATE,
        (a.next_renewal_date::date - CURRENT_DATE) as days_until_renewal
      FROM accounts a
      WHERE a.next_renewal_date IS NOT NULL
      ORDER BY a.next_renewal_date ASC
      LIMIT 10
    `);
    
    console.log('Accounts with renewal dates:');
    result.rows.forEach(row => {
      console.log(`  ${row.account_name}`);
      console.log(`    Renewal Date: ${row.next_renewal_date}`);
      console.log(`    Days Until: ${row.days_until_renewal}`);
    });
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

test().then(() => process.exit(0));
