const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest',
  ssl: { rejectUnauthorized: false }
});

async function analyzeFields() {
  const client = await pool.connect();

  try {
    console.log('📊 Field Analysis: account_type vs license_status\n');

    // Check unique values for each field
    const uniqueValues = await client.query(`
      SELECT
        DISTINCT account_type,
        license_status,
        COUNT(*) as count
      FROM accounts
      WHERE deleted_at IS NULL
      GROUP BY account_type, license_status
      ORDER BY count DESC
    `);

    console.log('Current value combinations:');
    console.log('account_type | license_status | count');
    console.log('-------------|----------------|------');
    uniqueValues.rows.forEach(row => {
      console.log(`${row.account_type.padEnd(11)} | ${row.license_status.padEnd(14)} | ${row.count}`);
    });

    console.log('\n📋 Analysis:');

    // Check if they're always the same
    const sameCheck = await client.query(`
      SELECT COUNT(*) as total,
      COUNT(CASE WHEN account_type = license_status THEN 1 END) as matching
      FROM accounts
      WHERE deleted_at IS NULL
    `);

    const { total, matching } = sameCheck.rows[0];
    const percentage = total > 0 ? (matching / total * 100).toFixed(1) : 0;

    console.log(`Accounts where account_type = license_status: ${matching}/${total} (${percentage}%)`);

    if (percentage < 100) {
      console.log('\n⚠️  Fields do NOT always match! Examples of mismatches:');
      const mismatches = await client.query(`
        SELECT account_name, account_type, license_status
        FROM accounts
        WHERE deleted_at IS NULL AND account_type != license_status
        LIMIT 5
      `);
      mismatches.rows.forEach(row => {
        console.log(`  - ${row.account_name}: account_type='${row.account_type}', license_status='${row.license_status}'`);
      });
    } else {
      console.log('✅ All accounts have matching values!');
    }

    console.log('\n💡 Conclusion:');
    if (percentage === 100) {
      console.log('Fields appear to be REDUNDANT - they always have the same value.');
      console.log('Recommendation: Consolidate into a single "status" field.');
    } else {
      console.log('Fields serve different purposes - keep both but ensure consistent mapping.');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

analyzeFields();
