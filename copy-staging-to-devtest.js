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
    console.log('🔄 Connecting to staging database...');
    await stagingClient.connect();
    console.log('✅ Connected to staging');

    console.log('🔄 Connecting to devtest database...');
    await devtestClient.connect();
    console.log('✅ Connected to devtest');

    // Get all tables from staging
    console.log('\n📊 Fetching table list...');
    const tablesResult = await stagingClient.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const tables = tablesResult.rows.map(r => r.tablename);
    console.log(`Found ${tables.length} tables`);

    // Clear devtest database
    console.log('\n🗑️  Clearing devtest database...');
    await devtestClient.query('BEGIN');

    for (const table of tables) {
      try {
        await devtestClient.query(`TRUNCATE TABLE "${table}" CASCADE`);
        console.log(`   ✅ Cleared ${table}`);
      } catch (e) {
        console.log(`   ⚠️  Skipped ${table}`);
      }
    }

    // Copy data from staging to devtest
    console.log('\n📋 Copying data...');
    for (const table of tables) {
      try {
        const data = await stagingClient.query(`SELECT * FROM "${table}"`);

        if (data.rows.length === 0) {
          console.log(`   ℹ️  ${table}: 0 rows`);
          continue;
        }

        // Use COPY for large datasets
        const columns = Object.keys(data.rows[0]);
        const values = data.rows.map(row => {
          return columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
            return val;
          }).join(',');
        }).map(v => `(${v})`).join(',');

        const insertSql = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES ${values}`;

        // Split into chunks if too large
        if (insertSql.length > 5000000) {
          const chunkSize = Math.ceil(data.rows.length / (insertSql.length / 5000000));
          let copied = 0;

          for (let i = 0; i < data.rows.length; i += chunkSize) {
            const chunk = data.rows.slice(i, i + chunkSize);
            const chunkValues = chunk.map(row => {
              return columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
                return val;
              }).join(',');
            }).map(v => `(${v})`).join(',');

            const chunkSql = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES ${chunkValues}`;
            await devtestClient.query(chunkSql);
            copied += chunk.length;
          }

          console.log(`   ✅ ${table}: ${copied} rows copied (in chunks)`);
        } else {
          await devtestClient.query(insertSql);
          console.log(`   ✅ ${table}: ${data.rows.length} rows copied`);
        }
      } catch (e) {
        console.log(`   ❌ ${table}: ${e.message.substring(0, 80)}`);
      }
    }

    await devtestClient.query('COMMIT');
    console.log('\n✅ Database copy complete!');
    console.log('✅ Devtest database now matches staging');

  } catch (error) {
    console.error('❌ Error:', error.message);
    try {
      await devtestClient.query('ROLLBACK');
    } catch (e) {
      // ignore
    }
  } finally {
    await stagingClient.end();
    await devtestClient.end();
  }
}

copyDatabase();
