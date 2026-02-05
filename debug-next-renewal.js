const db = require('./database/connection');
require('dotenv').config();

async function debugNextRenewal() {
  try {
    console.log('Finding account: manjit test feb4 acc\n');

    // Get the account
    const result = await db.query(`
      SELECT 
        a.id,
        a.account_name,
        a.created_at,
        a.billing_term_months,
        a.price,
        a.is_trial,
        a.trial_end_date,
        c.first_name,
        c.last_name
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      WHERE a.account_name ILIKE $1
      LIMIT 1
    `, ['%manjit test feb4 acc%']);

    if (result.rows.length === 0) {
      console.log('Account not found');
      return;
    }

    const account = result.rows[0];
    console.log('Account Details:');
    console.log('  Name:', account.account_name);
    console.log('  Contact:', `${account.first_name} ${account.last_name}`);
    console.log('  Created At:', account.created_at);
    console.log('  Billing Term Months:', account.billing_term_months);
    console.log('  Price:', account.price);
    console.log('  Is Trial:', account.is_trial);
    console.log('  Trial End Date:', account.trial_end_date);
    console.log('\n');

    // Calculate what the next renewal should be
    if (account.is_trial && account.trial_end_date) {
      console.log('Calculated Next Renewal (should be trial end date):');
      console.log('  ', account.trial_end_date);
    } else if (account.billing_term_months) {
      const created = new Date(account.created_at);
      let renewal = new Date(created);
      
      switch(account.billing_term_months) {
        case 1:
          renewal.setMonth(renewal.getMonth() + 1);
          break;
        case 3:
          renewal.setMonth(renewal.getMonth() + 3);
          break;
        case 6:
          renewal.setMonth(renewal.getMonth() + 6);
          break;
        case 12:
          renewal.setFullYear(renewal.getFullYear() + 1);
          break;
      }
      
      console.log('Calculated Next Renewal Date:');
      console.log('  ', renewal.toISOString());
      console.log('\nBreakdown:');
      console.log('  Created:', created.toLocaleDateString());
      console.log('  + ', account.billing_term_months, 'months');
      console.log('  = ', renewal.toLocaleDateString());
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await db.closePool();
  }
}

debugNextRenewal();
