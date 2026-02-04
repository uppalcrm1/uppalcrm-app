#!/usr/bin/env node

const { Pool } = require('pg');

const dbConfig = {
  host: 'dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com',
  port: 5432,
  user: 'uppalcrm_devtest',
  password: 'YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs',
  database: 'uppalcrm_devtest',
  ssl: { rejectUnauthorized: false }
};

const pool = new Pool(dbConfig);

async function investigate() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('DEVTEST DATABASE INVESTIGATION');
    console.log('='.repeat(80) + '\n');

    // Check accounts table structure
    console.log('📋 ACCOUNTS TABLE STRUCTURE');
    console.log('-'.repeat(80));
    const columns = await pool.query(`
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'accounts'
      ORDER BY ordinal_position
    `);

    console.log(`\nColumns in accounts table (${columns.rows.length} total):\n`);
    columns.rows.forEach((col, i) => {
      const nullable = col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`  ${i + 1}. ${col.column_name} (${col.data_type}) - ${nullable}${defaultVal}`);
    });

    // Get record count
    const count = await pool.query('SELECT COUNT(*) as count FROM accounts');
    console.log(`\n✓ Total records in accounts table: ${count.rows[0].count}`);

    // Check for relationships
    console.log('\n' + '='.repeat(80));
    console.log('FOREIGN KEY RELATIONSHIPS');
    console.log('-'.repeat(80) + '\n');

    // Foreign keys FROM accounts
    const fkFrom = await pool.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'accounts'
    `);

    if (fkFrom.rows.length > 0) {
      console.log('Foreign Keys FROM accounts (references TO other tables):');
      fkFrom.rows.forEach(fk => {
        console.log(`  • ${fk.column_name} → ${fk.foreign_table_name}(${fk.foreign_column_name})`);
      });
    } else {
      console.log('Foreign Keys FROM accounts: None');
    }

    // Foreign keys TO accounts
    const fkTo = await pool.query(`
      SELECT
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.column_name AS referenced_column_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'accounts'
    `);

    if (fkTo.rows.length > 0) {
      console.log('\nForeign Keys TO accounts (other tables reference accounts):');
      fkTo.rows.forEach(fk => {
        console.log(`  • ${fk.table_name}(${fk.column_name}) → accounts(${fk.referenced_column_name})`);
      });
    } else {
      console.log('\nForeign Keys TO accounts: None');
    }

    // Check indexes
    console.log('\n' + '='.repeat(80));
    console.log('INDEXES');
    console.log('-'.repeat(80) + '\n');
    const indexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'accounts'
    `);

    if (indexes.rows.length > 0) {
      console.log(`Indexes on accounts table (${indexes.rows.length} total):`);
      indexes.rows.forEach((idx, i) => {
        console.log(`  ${i + 1}. ${idx.indexname}`);
      });
    } else {
      console.log('Indexes: None');
    }

    // Sample data
    console.log('\n' + '='.repeat(80));
    console.log('SAMPLE DATA');
    console.log('-'.repeat(80) + '\n');
    const sample = await pool.query('SELECT * FROM accounts LIMIT 3');
    if (sample.rows.length > 0) {
      console.log(`First ${sample.rows.length} records:`);
      console.log(JSON.stringify(sample.rows, null, 2));
    } else {
      console.log('No data in accounts table');
    }

    // Check if software_licenses exists
    console.log('\n' + '='.repeat(80));
    console.log('LICENSING TABLE CHECK');
    console.log('-'.repeat(80) + '\n');
    const softwareLicenses = await pool.query(`
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
      ) as exists
    `);

    if (softwareLicenses.rows[0].exists) {
      console.log('✅ software_licenses table EXISTS in devtest');
      const slCount = await pool.query('SELECT COUNT(*) as count FROM software_licenses');
      console.log(`   Records: ${slCount.rows[0].count}`);
    } else {
      console.log('❌ software_licenses table DOES NOT exist in devtest');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

investigate();
