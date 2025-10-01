const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function runPlatformMigration() {
  console.log('🚀 Running Platform Admin Migration...\n');

  // Create database pool
  const pool = new Pool(process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  } : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'uppal_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: false
  });

  const client = await pool.connect();

  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/platform-admin-migration.sql');
    console.log('📄 Reading migration file:', migrationPath);
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    console.log('⚡ Executing migration...');
    await client.query(migrationSQL);

    console.log('✅ Platform admin tables created successfully!\n');

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('platform_admins', 'trial_signups')
      ORDER BY table_name;
    `);

    console.log('📊 Created tables:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runPlatformMigration();