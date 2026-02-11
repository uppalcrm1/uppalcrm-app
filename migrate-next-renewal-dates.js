const { Pool } = require('pg');

const devTestPool = new Pool({
  connectionString: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest',
  ssl: { rejectUnauthorized: false }
});

async function migrateNextRenewalDates() {
  const client = await devTestPool.connect();

  try {
    console.log('🔄 Starting migration of next_renewal_date for existing accounts...\n');

    // Step 1: Check how many accounts need updating
    const checkResult = await client.query(`
      SELECT COUNT(*) as count FROM accounts
      WHERE next_renewal_date IS NULL AND deleted_at IS NULL
    `);

    const accountsNeedingUpdate = checkResult.rows[0].count;
    console.log(`📊 Accounts needing next_renewal_date: ${accountsNeedingUpdate}`);

    if (accountsNeedingUpdate === 0) {
      console.log('✅ All accounts already have next_renewal_date set!');
      return;
    }

    // Step 2: Update accounts without next_renewal_date
    console.log('\n🔄 Updating accounts...');

    const updateResult = await client.query(`
      UPDATE accounts
      SET next_renewal_date = (
        CASE
          WHEN is_trial = true AND trial_end_date IS NOT NULL THEN trial_end_date
          WHEN billing_term_months IS NOT NULL AND billing_term_months > 0
            THEN created_at + (billing_term_months * INTERVAL '1 month')
          ELSE created_at + INTERVAL '1 month'
        END
      )
      WHERE next_renewal_date IS NULL AND deleted_at IS NULL
      RETURNING id, account_name, created_at, billing_term_months, next_renewal_date
    `);

    console.log(`✅ Updated ${updateResult.rows.length} accounts\n`);

    // Step 3: Show sample of updated accounts
    console.log('📋 Sample of updated accounts:');
    updateResult.rows.slice(0, 5).forEach((row, idx) => {
      const created = new Date(row.created_at).toLocaleDateString();
      const renewed = new Date(row.next_renewal_date).toLocaleDateString();
      console.log(`  ${idx + 1}. ${row.account_name}`);
      console.log(`     Created: ${created}, Term: ${row.billing_term_months}mo, Renewal: ${renewed}`);
    });

    if (updateResult.rows.length > 5) {
      console.log(`  ... and ${updateResult.rows.length - 5} more`);
    }

    console.log('\n✅ Migration complete!');
    console.log('\n📝 Next steps:');
    console.log('   1. Both list and detail endpoints now use STORED next_renewal_date');
    console.log('   2. No more CASE calculations in queries');
    console.log('   3. Transactions continue to update this value');
    console.log('   4. Impossible for endpoints to diverge now!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await devTestPool.end();
  }
}

migrateNextRenewalDates();
