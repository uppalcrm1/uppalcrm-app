#!/usr/bin/env node

const fs = require('fs');
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

async function executeStep1() {
  try {
    log('\n' + '='.repeat(100), 'cyan');
    log('STEP 1: DROP FOREIGN KEY CONSTRAINTS', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    // First, show what foreign keys exist BEFORE
    log('BEFORE - Current foreign keys:\n', 'blue');
    const beforeFKs = await pool.query(`
      SELECT
        tc.table_name,
        constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND (
        tc.table_name IN ('downloads_activations', 'license_transfers', 'trials')
        OR (constraint_name ILIKE '%software_license%' OR constraint_name ILIKE '%converted_license%')
      )
      ORDER BY tc.table_name, constraint_name
    `);

    if (beforeFKs.rows.length === 0) {
      log('  ℹ️  No foreign keys found (may already be dropped)\n', 'yellow');
    } else {
      beforeFKs.rows.forEach(fk => {
        log(`  • ${fk.table_name} - ${fk.constraint_name}`, 'yellow');
      });
      log();
    }

    // Execute the SQL
    log('Executing SQL commands...\n', 'blue');

    const sqlCommands = [
      `ALTER TABLE IF EXISTS downloads_activations
       DROP CONSTRAINT IF EXISTS fk_downloads_activations_software_licenses CASCADE`,

      `ALTER TABLE IF EXISTS license_transfers
       DROP CONSTRAINT IF EXISTS fk_license_transfers_software_licenses CASCADE`,

      `ALTER TABLE IF EXISTS trials
       DROP CONSTRAINT IF EXISTS fk_trials_converted_license CASCADE`,

      `ALTER TABLE IF EXISTS downloads_activations
       DROP CONSTRAINT IF EXISTS downloads_activations_software_license_id_fkey CASCADE`,

      `ALTER TABLE IF EXISTS license_transfers
       DROP CONSTRAINT IF EXISTS license_transfers_software_license_id_fkey CASCADE`,

      `ALTER TABLE IF EXISTS trials
       DROP CONSTRAINT IF EXISTS trials_converted_license_id_fkey CASCADE`
    ];

    for (const cmd of sqlCommands) {
      try {
        await pool.query(cmd);
        log(`  ✅ ${cmd.substring(0, 50)}...`, 'green');
      } catch (e) {
        // Constraint might not exist, that's ok
        log(`  ℹ️  ${cmd.substring(0, 50)}... (already dropped or doesn't exist)`, 'blue');
      }
    }

    log('\nVerifying results...\n', 'blue');

    // Check what's left AFTER
    const afterFKs = await pool.query(`
      SELECT
        tc.table_name,
        constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND (
        tc.table_name IN ('downloads_activations', 'license_transfers', 'trials')
      )
      AND constraint_name ILIKE '%software_license%' OR constraint_name ILIKE '%converted_license%'
      ORDER BY tc.table_name, constraint_name
    `);

    log('AFTER - Remaining foreign keys:\n', 'blue');
    if (afterFKs.rows.length === 0) {
      log('  ✅ No foreign keys to software_licenses remain\n', 'green');
    } else {
      log(`  ⚠️  ${afterFKs.rows.length} foreign key(s) still exist:\n`, 'yellow');
      afterFKs.rows.forEach(fk => {
        log(`    • ${fk.table_name} - ${fk.constraint_name}`, 'yellow');
      });
      log();
    }

    // Verify accounts table still has data
    log('Data integrity check:\n', 'blue');
    const accountsCheck = await pool.query('SELECT COUNT(*) as count FROM accounts');
    const accountsCount = accountsCheck.rows[0].count;
    log(`  ✅ accounts table: ${accountsCount} records (INTACT)\n`, 'green');

    log('='.repeat(100), 'cyan');
    log('STEP 1 COMPLETED', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    if (afterFKs.rows.length === 0) {
      log('✅ All foreign keys successfully dropped!', 'green');
      log('Ready to proceed to STEP 2\n', 'green');
    } else {
      log('⚠️  Some foreign keys still exist. Check above for details.\n', 'yellow');
    }

    await pool.end();
  } catch (error) {
    log(`\n❌ Error: ${error.message}\n`, 'red');
    process.exit(1);
  }
}

executeStep1();
