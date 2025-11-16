const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Use production database URL
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
    console.log('🔄 Starting migration: Make price column nullable');
    console.log('Database:', DATABASE_URL.split('@')[1]);

    // Read migration file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'migrations', '015_products_price_nullable.sql'),
      'utf8'
    );

    // Run migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('   - price column now allows NULL values');
    console.log('   - Products can be created without a price');

    // Verify the change
    const result = await client.query(`
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'products' AND column_name = 'price'
    `);

    if (result.rows[0]) {
      console.log('\n📋 Column info:');
      console.log('   Name:', result.rows[0].column_name);
      console.log('   Type:', result.rows[0].data_type);
      console.log('   Nullable:', result.rows[0].is_nullable);
    }

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
