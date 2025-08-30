const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

/**
 * Production Database Migration Script for UppalCRM
 * Run this script after creating your Render PostgreSQL database
 */

const runMigration = async () => {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    console.log('Usage: DATABASE_URL="your_postgres_url" node scripts/production-migrate.js');
    process.exit(1);
  }

  console.log('🚀 Starting production database migration...');

  // Render-optimized connection configuration
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('render.com') || databaseUrl.includes('onrender.com') ? { 
      rejectUnauthorized: false,
      sslmode: 'require'
    } : false,
    // Optimized settings for Render PostgreSQL
    max: 5, // Smaller pool for migrations
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000
  });

  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful');

    // Read and execute migration files in order
    const migrationFiles = [
      '../database/schema.sql',
      '../database/add-leads-table.sql'
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, file);
      
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Migration file not found: ${file}`);
        continue;
      }

      console.log(`Executing migration: ${file}`);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split on semicolons and execute each statement
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement);
        }
      }
      
      console.log(`✅ Completed migration: ${file}`);
    }

    console.log('🎉 All migrations completed successfully!');
    console.log('Your production database is ready for UppalCRM');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };