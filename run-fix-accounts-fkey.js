require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration: Fix accounts foreign key constraint');
    console.log('Database:', DATABASE_URL.split('@')[1]);

    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'migrations', '018_fix_accounts_contact_fkey.sql'),
      'utf8'
    );

    // Run migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - Dropped old accounts_contact_id_fkey constraint');
    console.log('   - Added new constraint pointing to contacts table');

    // Verify the fix
    const result = await client.query(`
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
        AND tc.constraint_name = 'accounts_contact_id_fkey';
    `);

    console.log('\n✅ Verified foreign key constraint:');
    result.rows.forEach(row => {
      console.log(`   ${row.constraint_name}: ${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
