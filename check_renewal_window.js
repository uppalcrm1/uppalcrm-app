const db = require('./database/connection');

async function test() {
  console.log('Checking accounts in 30-day renewal window:\n');
  
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
        AND a.next_renewal_date >= CURRENT_DATE
        AND a.next_renewal_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY a.next_renewal_date ASC
    `);
    
    console.log(`Total accounts in 30-day renewal window: ${result.rows.length}\n`);
    
    result.rows.forEach((row, i) => {
      console.log(`${i + 1}. ${row.account_name}`);
      console.log(`   Renewal: ${row.next_renewal_date}`);
      console.log(`   Days: ${row.days_until_renewal}\n`);
    });
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

test().then(() => process.exit(0));
