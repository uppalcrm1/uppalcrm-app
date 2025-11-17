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
    console.log('🔄 Starting migration: Create transactions table');
    console.log('Database:', DATABASE_URL.split('@')[1]);

    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'migrations', '017_create_transactions_table.sql'),
      'utf8'
    );

    // Run migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - transactions table created');
    console.log('   - Indexes created');
    console.log('   - RLS policy enabled');
    console.log('   - Triggers created');

    // Verify the table
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position
    `);

    console.log('\n📋 Transactions table columns:');
    result.rows.forEach(row => {
      const nullable = row.is_nullable === 'YES' ? '(nullable)' : '(required)';
      console.log(`   ${row.column_name}: ${row.data_type} ${nullable}`);
    });

    // Check indexes
    const indexes = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'transactions'
    `);

    console.log('\n📊 Indexes created:');
    indexes.rows.forEach(row => {
      console.log(`   ✓ ${row.indexname}`);
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
