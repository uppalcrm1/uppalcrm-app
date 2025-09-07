const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function checkContactsTable() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'contacts'
      ORDER BY ordinal_position
    `);
    
    console.log('CURRENT CONTACTS TABLE STRUCTURE:');
    console.log('='.repeat(70));
    console.log('Column Name          | Data Type                 | Nullable | Default');
    console.log('='.repeat(70));
    result.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(20)} | ${col.data_type.padEnd(25)} | ${col.is_nullable.padEnd(8)} | ${col.column_default || 'NULL'}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkContactsTable();