const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('🔌 Connecting to database...');
    const client = await pool.connect();

    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'contacts-accounts-migration.sql'),
      'utf8'
    );

    console.log('🚀 Running migration...');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify tables were created
    const tables = await client.query(\`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('contacts', 'accounts', 'lead_contact_relationships')
      ORDER BY table_name
    \`);

    console.log('📋 Created tables:');
    tables.rows.forEach(row => console.log(\`  - \${row.table_name}\`));

    client.release();
    await pool.end();

    console.log('\n✨ All done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
