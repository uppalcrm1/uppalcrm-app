#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Database connection
const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
});

/**
 * Run database migrations
 */
async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting database migration...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await client.query(schema);
    
    console.log('✅ Database schema created successfully');
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('📊 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Verify RLS is enabled
    const rlsResult = await client.query(`
      SELECT schemaname, tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND rowsecurity = true;
    `);
    
    console.log('🔒 Row Level Security enabled on:');
    rlsResult.rows.forEach(row => {
      console.log(`  - ${row.tablename}`);
    });
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Reset database (drop all tables and recreate)
 */
async function reset() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Resetting database...');
    
    // Drop all tables
    await client.query(`
      DROP TABLE IF EXISTS user_sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
      DROP FUNCTION IF EXISTS check_user_limit() CASCADE;
      DROP FUNCTION IF EXISTS create_organization_with_admin() CASCADE;
    `);
    
    console.log('🗑️  Dropped existing tables and functions');
    
    // Run migration
    await migrate();
    
  } catch (error) {
    console.error('❌ Reset failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
  }
}

/**
 * Check database status
 */
async function status() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking database status...');
    
    // Check connection
    const timeResult = await client.query('SELECT NOW() as current_time');
    console.log(`⏰ Database time: ${timeResult.rows[0].current_time}`);
    
    // Check tables
    const tablesResult = await client.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    
    if (tablesResult.rows.length === 0) {
      console.log('❌ No tables found. Run migration first.');
    } else {
      console.log('📊 Database tables:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name} (${row.column_count} columns)`);
      });
    }
    
    // Check for data
    if (tablesResult.rows.length > 0) {
      const dataResult = await client.query(`
        SELECT 
          (SELECT COUNT(*) FROM organizations) as organizations,
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM user_sessions) as sessions;
      `);
      
      const data = dataResult.rows[0];
      console.log('📈 Data counts:');
      console.log(`  - Organizations: ${data.organizations}`);
      console.log(`  - Users: ${data.users}`);
      console.log(`  - Active Sessions: ${data.sessions}`);
    }
    
  } catch (error) {
    console.error('❌ Status check failed:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Command line interface
const command = process.argv[2];

switch (command) {
  case 'migrate':
    migrate();
    break;
  case 'reset':
    reset();
    break;
  case 'status':
    status();
    break;
  default:
    console.log('UppalCRM Database Migration Tool');
    console.log('');
    console.log('Usage:');
    console.log('  npm run migrate        Run database migrations');
    console.log('  node scripts/migrate.js migrate   Run database migrations');
    console.log('  node scripts/migrate.js reset     Reset database (destructive)');
    console.log('  node scripts/migrate.js status    Check database status');
    console.log('');
    console.log('Environment Variables:');
    console.log('  DB_HOST     Database host (default: localhost)');
    console.log('  DB_PORT     Database port (default: 5432)');
    console.log('  DB_NAME     Database name (default: uppal_crm)');
    console.log('  DB_USER     Database user (default: postgres)');
    console.log('  DB_PASSWORD Database password (required)');
    break;
}

module.exports = { migrate, reset, status };