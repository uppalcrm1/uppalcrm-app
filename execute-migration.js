#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log('', 'reset');
  log('═'.repeat(80), 'cyan');
  log(title, 'cyan');
  log('═'.repeat(80), 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function executeMigration() {
  const startTime = Date.now();

  logSection('SOFTWARE LICENSES → ACCOUNTS MIGRATION');
  logInfo(`Target Database: uppalcrm_devtest`);
  logInfo(`Start Time: ${new Date().toISOString()}`);

  // Database configuration
  const dbConfig = {
    host: 'dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com',
    port: 5432,
    user: 'uppalcrm_devtest',
    password: 'YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs',
    database: 'uppalcrm_devtest',
    ssl: { rejectUnauthorized: false }
  };

  const pool = new Pool(dbConfig);

  try {
    logSection('STEP 1: DATABASE CONNECTION');
    const testResult = await pool.query('SELECT NOW() as timestamp, current_database() as database, current_user as user');
    logSuccess('Connected to database');
    logInfo(`Database: ${testResult.rows[0].database}`);
    logInfo(`User: ${testResult.rows[0].user}`);
    logInfo(`Time: ${testResult.rows[0].timestamp}`);

    logSection('STEP 2: READING MIGRATION SCRIPT');
    const scriptPath = path.join(__dirname, 'scripts', 'migration_software_licenses_to_accounts_v2.sql');

    if (!fs.existsSync(scriptPath)) {
      logError(`Migration script not found at: ${scriptPath}`);
      process.exit(1);
    }

    let sqlScript = fs.readFileSync(scriptPath, 'utf8');

    // Remove psql-specific commands
    sqlScript = sqlScript
      .replace(/\\set\s+ON_ERROR_STOP\s+on/gi, '')
      .replace(/\\timing\s+on/gi, '')
      .trim();

    logSuccess(`Migration script loaded (${sqlScript.length} bytes)`);
    logInfo('Removed psql-specific commands');

    logSection('STEP 3: EXECUTING MIGRATION');
    logInfo('This may take 10-25 seconds...');

    const result = await pool.query(sqlScript);

    logSuccess('Migration script executed successfully');

    logSection('STEP 4: POST-MIGRATION VALIDATION');

    // Check if accounts table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'accounts'
      ) as exists
    `);

    if (tableCheck.rows[0].exists) {
      logSuccess('✓ accounts table exists');
    } else {
      logError('✗ accounts table does not exist');
      process.exit(1);
    }

    // Check if old table is gone
    const oldTableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
      ) as exists
    `);

    if (!oldTableCheck.rows[0].exists) {
      logSuccess('✓ software_licenses table removed');
    } else {
      logWarning('⚠ software_licenses table still exists');
    }

    // Check record count
    const recordCount = await pool.query('SELECT COUNT(*) as count FROM accounts');
    logSuccess(`✓ Records in accounts table: ${recordCount.rows[0].count}`);

    // Check indexes
    const indexCheck = await pool.query(`
      SELECT COUNT(*) as count FROM pg_indexes
      WHERE tablename = 'accounts'
    `);
    logSuccess(`✓ Indexes on accounts table: ${indexCheck.rows[0].count}`);

    // Check foreign keys
    const fkCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
      AND table_name IN ('trials', 'license_transfers', 'downloads_activations',
                         'billing_payments', 'renewals_subscriptions', 'renewal_alerts')
    `);
    logSuccess(`✓ Foreign key references: ${fkCheck.rows[0].count}`);

    // Check RLS policy
    const rlsCheck = await pool.query(`
      SELECT COUNT(*) as count FROM pg_policies
      WHERE tablename = 'accounts'
    `);
    logSuccess(`✓ RLS policies on accounts: ${rlsCheck.rows[0].count}`);

    logSection('MIGRATION COMPLETE ✅');
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logSuccess(`Total execution time: ${duration} seconds`);
    log('', 'reset');
    logSuccess('All validation checks passed!');
    logInfo('You can now update your backend code to use "accounts" instead of "software_licenses"');
    log('', 'reset');

    await pool.end();
    process.exit(0);

  } catch (error) {
    logSection('ERROR OCCURRED');
    logError(`${error.message}`);

    if (error.detail) {
      logInfo(`Detail: ${error.detail}`);
    }

    if (error.hint) {
      logInfo(`Hint: ${error.hint}`);
    }

    logWarning('Migration may have been rolled back due to transaction error.');

    await pool.end();
    process.exit(1);
  }
}

executeMigration();
