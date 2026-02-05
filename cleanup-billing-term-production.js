const { Pool } = require('pg');

// Production database connection
const productionDb = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function runCleanup() {
  const client = await productionDb.connect();

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚨 RUNNING DATA CLEANUP MIGRATION ON PRODUCTION');
    console.log('='.repeat(80));
    console.log('⚠️  WARNING: This is the LIVE production environment\n');

    // Start transaction
    await client.query('BEGIN');
    console.log('🔄 Transaction started\n');

    // 1. Get database name
    const dbResult = await client.query('SELECT current_database() as db_name');
    const dbName = dbResult.rows[0].db_name;
    console.log(`🔧 Running in database: ${dbName}\n`);

    // 2. Create backup
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
    const backupTableName = `accounts_backup_${timestamp}`;
    await client.query(`CREATE TABLE ${backupTableName} AS SELECT * FROM accounts`);
    console.log(`✅ Backup created: ${backupTableName}\n`);

    // 3. Show BEFORE state
    console.log('════════════════════════════════════════');
    console.log('BEFORE DATA CLEANUP');
    console.log('════════════════════════════════════════\n');

    const beforeResult = await client.query(`
      SELECT
        billing_term_months,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
      FROM accounts
      WHERE deleted_at IS NULL
      GROUP BY billing_term_months
      ORDER BY billing_term_months
    `);

    console.log('billing_term_months | count | percentage');
    console.log('-'.repeat(45));
    beforeResult.rows.forEach(row => {
      const months = row.billing_term_months !== null ? row.billing_term_months : 'NULL';
      console.log(`${String(months).padEnd(19)} | ${String(row.count).padEnd(5)} | ${row.percentage}%`);
    });

    // 4. Update from transactions
    console.log('\n📊 Updating accounts from transactions...\n');

    const updateResult = await client.query(`
      UPDATE accounts a
      SET billing_term_months = CAST(t.term AS INTEGER)
      FROM (
        SELECT DISTINCT ON (account_id)
          account_id,
          term
        FROM transactions
        WHERE term IS NOT NULL
        ORDER BY account_id, transaction_date DESC
      ) t
      WHERE a.id = t.account_id
        AND a.deleted_at IS NULL
    `);

    const updatedCount = updateResult.rowCount;
    console.log(`✅ Updated ${updatedCount} active accounts\n`);

    // 5. Show AFTER state
    console.log('════════════════════════════════════════');
    console.log('AFTER DATA CLEANUP');
    console.log('════════════════════════════════════════\n');

    const afterResult = await client.query(`
      SELECT
        billing_term_months,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
      FROM accounts
      WHERE deleted_at IS NULL
      GROUP BY billing_term_months
      ORDER BY billing_term_months
    `);

    console.log('billing_term_months | count | percentage');
    console.log('-'.repeat(45));
    afterResult.rows.forEach(row => {
      const months = row.billing_term_months !== null ? row.billing_term_months : 'NULL';
      console.log(`${String(months).padEnd(19)} | ${String(row.count).padEnd(5)} | ${row.percentage}%`);
    });

    // 6. Verification checks
    console.log('\n════════════════════════════════════════');
    console.log('VERIFICATION CHECKS');
    console.log('════════════════════════════════════════\n');

    // Check 1: No NULL values
    const nullCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM accounts
      WHERE billing_term_months IS NULL AND deleted_at IS NULL
    `);
    const nullCount = nullCheck.rows[0].count;
    if (nullCount > 0) {
      throw new Error(`❌ Found ${nullCount} accounts with NULL billing_term_months`);
    }
    console.log('✅ Check 1: No NULL values');

    // Check 2: Valid values only
    const invalidCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM accounts
      WHERE billing_term_months NOT IN (1, 3, 6, 12, 24) AND deleted_at IS NULL
    `);
    const invalidCount = invalidCheck.rows[0].count;
    if (invalidCount > 0) {
      throw new Error(`❌ Found ${invalidCount} accounts with invalid values`);
    }
    console.log('✅ Check 2: All values valid (1, 3, 6, 12, or 24)');

    // Check 3: Match with transactions
    const mismatchCheck = await client.query(`
      SELECT COUNT(*) as count
      FROM accounts a
      JOIN LATERAL (
        SELECT term FROM transactions
        WHERE account_id = a.id
        ORDER BY transaction_date DESC LIMIT 1
      ) t ON true
      WHERE a.billing_term_months != CAST(t.term AS INTEGER) AND a.deleted_at IS NULL
    `);
    const mismatchCount = mismatchCheck.rows[0].count;
    if (mismatchCount > 0) {
      throw new Error(`❌ Found ${mismatchCount} mismatched accounts`);
    }
    console.log('✅ Check 3: All values match latest transaction');

    console.log('\n✅ ALL CHECKS PASSED\n');

    // 7. Sample data
    console.log('════════════════════════════════════════');
    console.log('SAMPLE DATA (10 accounts)');
    console.log('════════════════════════════════════════\n');

    const sampleResult = await client.query(`
      SELECT
        a.account_name,
        a.billing_cycle,
        a.billing_term_months,
        t.term as transaction_term
      FROM accounts a
      JOIN LATERAL (
        SELECT term FROM transactions
        WHERE account_id = a.id
        ORDER BY transaction_date DESC LIMIT 1
      ) t ON true
      WHERE a.deleted_at IS NULL
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    console.log('Account Name                    | billing_cycle | billing_term_months | transaction_term');
    console.log('-'.repeat(95));
    sampleResult.rows.forEach(row => {
      const name = (row.account_name || 'N/A').substring(0, 30).padEnd(30);
      const cycle = String(row.billing_cycle || 'N/A').padEnd(13);
      const term = String(row.billing_term_months || 'N/A').padEnd(19);
      const txTerm = String(row.transaction_term || 'N/A');
      console.log(`${name} | ${cycle} | ${term} | ${txTerm}`);
    });

    console.log('\n');

    // Commit transaction
    await client.query('COMMIT');
    console.log('✅ Transaction committed successfully!\n');

    console.log('='.repeat(80));
    console.log('📊 DATA CLEANUP COMPLETED SUCCESSFULLY');
    console.log('='.repeat(80));
    console.log('\n✅ SUMMARY:');
    console.log(`   ✓ Database: ${dbName}`);
    console.log(`   ✓ Backup: ${backupTableName}`);
    console.log(`   ✓ Accounts updated: ${updatedCount}`);
    console.log(`   ✓ Verification: PASSED\n`);

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    try {
      await client.query('ROLLBACK');
      console.error('✅ Transaction rolled back');
    } catch (rollbackErr) {
      console.error('Could not rollback:', rollbackErr.message);
    }
    process.exit(1);
  } finally {
    client.release();
    await productionDb.end();
    console.log('✅ Database connection closed\n');
    process.exit(0);
  }
}

runCleanup();
