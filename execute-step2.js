#!/usr/bin/env node

const { Pool } = require('pg');

const dbConfig = {
  host: 'dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com',
  port: 5432,
  user: 'uppalcrm_database_user',
  password: 'PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk',
  database: 'uppalcrm_database',
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

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

async function executeStep2() {
  try {
    log('\n' + '='.repeat(100), 'cyan');
    log('STEP 2: DROP EMPTY TABLES', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    // Verify tables exist and are empty BEFORE
    log('BEFORE - Verify tables to be deleted:\n', 'blue');

    const tablesToDrop = ['downloads_activations', 'license_transfers', 'software_licenses'];
    const beforeCounts = {};

    for (const table of tablesToDrop) {
      const exists = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        ) as exists
      `, [table]);

      if (!exists.rows[0].exists) {
        log(`  ℹ️  ${table.padEnd(35)} - Does not exist`, 'yellow');
        beforeCounts[table] = 'N/A';
      } else {
        const count = await pool.query(`SELECT COUNT(*) as count FROM "${table}"`);
        beforeCounts[table] = count.rows[0].count;
        log(`  ${count.rows[0].count === 0 ? '✅' : '⚠️'} ${table.padEnd(35)} - ${count.rows[0].count} records`, 'green');
      }
    }

    // Verify accounts before drop
    const accountsBeforeCount = await pool.query('SELECT COUNT(*) as count FROM accounts');
    log(`\n  ✅ accounts table (should not be dropped): ${accountsBeforeCount.rows[0].count} records\n`, 'green');

    // Drop the tables
    log('Dropping tables...\n', 'blue');

    const dropCommands = [
      `DROP TABLE IF EXISTS downloads_activations CASCADE`,
      `DROP TABLE IF EXISTS license_transfers CASCADE`,
      `DROP TABLE IF EXISTS software_licenses CASCADE`
    ];

    const results = {
      success: [],
      failed: []
    };

    for (const cmd of dropCommands) {
      try {
        await pool.query(cmd);
        const tableName = cmd.match(/downloads_activations|license_transfers|software_licenses/)[0];
        log(`  ✅ Dropped ${tableName}`, 'green');
        results.success.push(tableName);
      } catch (e) {
        log(`  ❌ Error: ${e.message}`, 'red');
        results.failed.push(cmd);
      }
    }

    log('\n' + '='.repeat(100), 'cyan');
    log('VERIFICATION - AFTER DELETION', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    // Verify tables are gone
    log('Verify tables deleted:\n', 'blue');

    for (const table of tablesToDrop) {
      const exists = await pool.query(`
        SELECT EXISTS(
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        ) as exists
      `, [table]);

      if (exists.rows[0].exists) {
        log(`  ❌ ${table.padEnd(35)} - Still exists (ERROR)`, 'red');
      } else {
        log(`  ✅ ${table.padEnd(35)} - Successfully deleted`, 'green');
      }
    }

    // Verify accounts table still intact
    log('\nData integrity check:\n', 'blue');
    const accountsAfterCount = await pool.query('SELECT COUNT(*) as count FROM accounts');
    const accountsRecords = accountsAfterCount.rows[0].count;

    if (accountsRecords === 407) {
      log(`  ✅ accounts table: ${accountsRecords} records - INTACT AND UNCHANGED`, 'green');
    } else if (accountsRecords === 0) {
      log(`  ❌ accounts table: ${accountsRecords} records - DELETED (CRITICAL ERROR!)`, 'red');
    } else {
      log(`  ⚠️  accounts table: ${accountsRecords} records - Changed from 407 (WARNING)`, 'yellow');
    }

    // Get sample of data
    log('\nSample accounts records:\n', 'blue');
    const sample = await pool.query(`
      SELECT id, account_name, license_key, license_status, created_at
      FROM accounts
      ORDER BY created_at DESC
      LIMIT 3
    `);

    sample.rows.forEach((row, i) => {
      log(`  ${i + 1}. ${row.account_name} | Status: ${row.license_status} | Key: ${row.license_key}`, 'green');
    });

    log('\n' + '='.repeat(100), 'cyan');
    log('STEP 2 SUMMARY', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    if (results.failed.length === 0 && accountsRecords === 407) {
      log('✅ STEP 2 COMPLETED SUCCESSFULLY', 'green');
      log(`   • ${results.success.length} tables dropped`, 'green');
      log(`   • accounts table: 407 records (INTACT)`, 'green');
      log(`   • No errors occurred`, 'green');
      log(`\n✅ Ready to proceed to STEP 3\n`, 'green');
    } else if (results.failed.length === 0) {
      log('⚠️  STEP 2 PARTIALLY COMPLETE', 'yellow');
      log(`   • ${results.success.length} tables dropped`, 'green');
      log(`   • accounts table: ${accountsRecords} records (WARNING: Expected 407)`, 'yellow');
    } else {
      log('❌ STEP 2 FAILED', 'red');
      log(`   • Failed drops: ${results.failed.length}`, 'red');
      log(`   • Check errors above`, 'red');
    }

    await pool.end();
  } catch (error) {
    log(`\n❌ Error: ${error.message}\n`, 'red');
    process.exit(1);
  }
}

executeStep2();
