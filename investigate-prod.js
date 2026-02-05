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

async function investigate() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('PRODUCTION DATABASE INVESTIGATION');
    console.log('='.repeat(80) + '\n');

    // Check what account-related tables exist
    console.log('📋 ACCOUNT-RELATED TABLES');
    console.log('-'.repeat(80));

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE '%account%' OR table_name LIKE '%license%')
      ORDER BY table_name
    `);

    if (tables.rows.length > 0) {
      console.log('Found tables:\n');
      for (const table of tables.rows) {
        const count = await pool.query(`SELECT COUNT(*) as count FROM "${table.table_name}"`);
        console.log(`  • ${table.table_name} (${count.rows[0].count} records)`);
      }
    } else {
      console.log('No account or license related tables found');
    }

    // Check for software_licenses
    console.log('\n' + '='.repeat(80));
    console.log('SOFTWARE_LICENSES TABLE');
    console.log('-'.repeat(80) + '\n');

    const sl = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
      ) as exists
    `);

    if (sl.rows[0].exists) {
      console.log('✅ software_licenses table EXISTS in production');

      const count = await pool.query('SELECT COUNT(*) as count FROM software_licenses');
      console.log(`   Records: ${count.rows[0].count}`);

      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
        ORDER BY ordinal_position
        LIMIT 10
      `);
      console.log(`   Columns (first 10):`);
      columns.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ software_licenses table DOES NOT exist in production');
    }

    // Check for accounts
    console.log('\n' + '='.repeat(80));
    console.log('ACCOUNTS TABLE');
    console.log('-'.repeat(80) + '\n');

    const ac = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'accounts'
      ) as exists
    `);

    if (ac.rows[0].exists) {
      console.log('✅ accounts table EXISTS in production');

      const count = await pool.query('SELECT COUNT(*) as count FROM accounts');
      console.log(`   Records: ${count.rows[0].count}`);

      const columns = await pool.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'accounts'
        ORDER BY ordinal_position
        LIMIT 10
      `);
      console.log(`   Columns (first 10):`);
      columns.rows.forEach(col => {
        console.log(`     - ${col.column_name} (${col.data_type})`);
      });
    } else {
      console.log('❌ accounts table DOES NOT exist in production');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

investigate();
