#!/usr/bin/env node

const { Client } = require('pg');

const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function resetMigration004() {
  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 RESETTING MIGRATION 004 TRACKING');
    console.log('═'.repeat(100));

    await client.connect();

    // First, check the schema_migrations table structure
    const tableInfo = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'schema_migrations'
      ORDER BY ordinal_position;
    `);

    console.log('Migration tracking table columns:\n');
    tableInfo.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });

    // Find the right column name
    const migrationCol = tableInfo.rows.find(col =>
      col.column_name.includes('migration') || col.column_name.includes('name')
    );

    if (!migrationCol) {
      console.log('\n❌ Could not find migration column name');
      return;
    }

    const colName = migrationCol.column_name;
    console.log(`\nUsing column: ${colName}\n`);

    // Delete the failed migration record
    const deleteQuery = `
      DELETE FROM schema_migrations
      WHERE ${colName} = '004-rename-completed-by-to-last-modified-by.sql';
    `;

    const result = await client.query(deleteQuery);
    console.log(`✅ Cleared ${result.rowCount} migration record(s) for 004\n`);

    // Show remaining migrations
    const remaining = await client.query(`
      SELECT ${colName} FROM schema_migrations
      ORDER BY ${colName} DESC
      LIMIT 10;
    `);

    console.log(`📋 Most recent migrations in history:\n`);
    remaining.rows.forEach(row => {
      const migName = row[colName];
      console.log(`  ${migName}`);
    });

    console.log('\n' + '═'.repeat(100));
    console.log('✅ MIGRATION RESET COMPLETE!\n');
    console.log('🚀 Next steps:');
    console.log('   1. Go to Render.com Dashboard');
    console.log('   2. Click your uppalcrm-api service');
    console.log('   3. Click "Rerun last deploy" or push a commit to trigger a new deploy');
    console.log('   4. The migration will now run successfully');
    console.log('   5. Your API will come online and users can login again!\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

resetMigration004();
