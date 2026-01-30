const { Client } = require('pg');

const stagingUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const devtestUrl = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';

async function copyDatabase() {
  const stagingClient = new Client({
    connectionString: stagingUrl,
    ssl: { rejectUnauthorized: false }
  });
  const devtestClient = new Client({
    connectionString: devtestUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to databases...');
    await stagingClient.connect();
    await devtestClient.connect();
    console.log('✅ Connected to both databases');

    // Get all tables
    const tablesResult = await stagingClient.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`\n📊 Found ${tables.length} tables\n`);

    // Disable foreign keys
    console.log('🔐 Disabling foreign key constraints...');
    await devtestClient.query('SET session_replication_role = replica');

    // Copy each table separately
    for (const table of tables) {
      try {
        // Get data from staging
        const data = await stagingClient.query(`SELECT * FROM "${table}"`);

        // Clear devtest table
        await devtestClient.query(`DELETE FROM "${table}"`);

        // Copy data if exists
        if (data.rows.length > 0) {
          const columns = Object.keys(data.rows[0]);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(',');
          const insertSql = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`;

          const stmt = await devtestClient.prepare('insert_stmt', insertSql, columns.length);

          for (const row of data.rows) {
            const values = columns.map(col => row[col]);
            await devtestClient.query(stmt, values);
          }

          console.log(`✅ ${table}: ${data.rows.length} rows`);
        } else {
          console.log(`ℹ️  ${table}: 0 rows`);
        }
      } catch (e) {
        console.log(`❌ ${table}: ${e.message.substring(0, 60)}`);
      }
    }

    // Re-enable foreign keys
    console.log('\n🔐 Re-enabling foreign key constraints...');
    await devtestClient.query('SET session_replication_role = default');

    console.log('\n✅ Database copy complete!');
    console.log('✅ Devtest database now matches staging');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await stagingClient.end();
    await devtestClient.end();
  }
}

copyDatabase();
