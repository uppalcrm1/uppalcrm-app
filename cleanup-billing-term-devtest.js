const { Pool } = require('pg');

// DevTest database connection
const devtestDb = new Pool({
  connectionString: 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest',
  ssl: { rejectUnauthorized: false }
});

// The cleanup migration SQL
const cleanupSQL = `
BEGIN;

-- Environment check
DO $
DECLARE
  env_name TEXT;
BEGIN
  env_name := current_database();
  RAISE NOTICE '🔧 Running in database: %', env_name;
END $;

-- Backup
DO $
DECLARE
  backup_table_name TEXT;
BEGIN
  backup_table_name := 'accounts_backup_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');
  EXECUTE format('CREATE TABLE %I AS SELECT * FROM accounts', backup_table_name);
  RAISE NOTICE '✅ Backup created: %', backup_table_name;
END $;

-- Show BEFORE state
RAISE NOTICE '';
RAISE NOTICE '════════════════════════════════════════';
RAISE NOTICE 'BEFORE DATA CLEANUP';
RAISE NOTICE '════════════════════════════════════════';

SELECT
  billing_term_months,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM accounts
WHERE deleted_at IS NULL
GROUP BY billing_term_months
ORDER BY billing_term_months;

-- Update from transactions
UPDATE accounts a
SET billing_term_months = CAST(t.term AS INTEGER)
FROM (
  SELECT DISTINCT ON (account_id)
    account_id,
    term
  FROM transactions
  WHERE term IS NOT NULL
  ORDER BY account_id, payment_date DESC
) t
WHERE a.id = t.account_id
  AND a.deleted_at IS NULL;

DO $
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE '';
  RAISE NOTICE '✅ Updated % active accounts', updated_count;
END $;

-- Show AFTER state
RAISE NOTICE '';
RAISE NOTICE '════════════════════════════════════════';
RAISE NOTICE 'AFTER DATA CLEANUP';
RAISE NOTICE '════════════════════════════════════════';

SELECT
  billing_term_months,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM accounts
WHERE deleted_at IS NULL
GROUP BY billing_term_months
ORDER BY billing_term_months;

-- Verification
DO $
DECLARE
  null_count INTEGER;
  invalid_count INTEGER;
  mismatch_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════';
  RAISE NOTICE 'VERIFICATION CHECKS';
  RAISE NOTICE '════════════════════════════════════════';

  SELECT COUNT(*) INTO null_count
  FROM accounts
  WHERE billing_term_months IS NULL AND deleted_at IS NULL;

  IF null_count > 0 THEN
    RAISE EXCEPTION '❌ Found % accounts with NULL', null_count;
  END IF;
  RAISE NOTICE '✅ Check 1: No NULL values';

  SELECT COUNT(*) INTO invalid_count
  FROM accounts
  WHERE billing_term_months NOT IN (1, 3, 6, 12, 24) AND deleted_at IS NULL;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION '❌ Found % accounts with invalid values', invalid_count;
  END IF;
  RAISE NOTICE '✅ Check 2: All values valid';

  SELECT COUNT(*) INTO mismatch_count
  FROM accounts a
  JOIN LATERAL (
    SELECT term FROM transactions
    WHERE account_id = a.id
    ORDER BY payment_date DESC LIMIT 1
  ) t ON true
  WHERE a.billing_term_months != CAST(t.term AS INTEGER) AND a.deleted_at IS NULL;

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION '❌ Found % mismatched accounts', mismatch_count;
  END IF;
  RAISE NOTICE '✅ Check 3: All match transactions';

  RAISE NOTICE '';
  RAISE NOTICE '✅ ALL CHECKS PASSED';
END $;

-- Sample
SELECT
  a.account_name,
  a.billing_cycle,
  a.billing_term_months,
  t.term as transaction_term
FROM accounts a
JOIN LATERAL (
  SELECT term FROM transactions
  WHERE account_id = a.id
  ORDER BY payment_date DESC LIMIT 1
) t ON true
WHERE a.deleted_at IS NULL
LIMIT 10;

COMMIT;
`;

async function runCleanup() {
  const client = await devtestDb.connect();

  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 RUNNING DATA CLEANUP MIGRATION ON DEVTEST');
    console.log('='.repeat(80) + '\n');

    // Execute the entire cleanup migration
    const result = await client.query(cleanupSQL);

    console.log('✅ Migration executed successfully!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    if (error.detail) {
      console.error('Details:', error.detail);
    }
    process.exit(1);
  } finally {
    client.release();
    await devtestDb.end();
    console.log('\n' + '='.repeat(80));
    console.log('✅ Database connection closed');
    console.log('='.repeat(80) + '\n');
    process.exit(0);
  }
}

// Handle client messages (for RAISE NOTICE)
devtestDb.on('notice', (notice) => {
  console.log(notice.message);
});

// Also handle query event for notices
const originalQuery = devtestDb.query.bind(devtestDb);
devtestDb.query = function(...args) {
  const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;

  if (callback) {
    return originalQuery(...args);
  }

  return originalQuery(...args).then(result => {
    if (result.notice) {
      console.log(result.notice);
    }
    return result;
  });
};

runCleanup();
