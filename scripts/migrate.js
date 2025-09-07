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
    
    // Read and execute base schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🔧 Creating base schema (organizations, users, sessions)...');
    await client.query(schema);
    
    // Read and execute comprehensive leads migration
    const leadsSchemaPath = path.join(__dirname, '../database/comprehensive-leads-migration.sql');
    const leadsSchema = fs.readFileSync(leadsSchemaPath, 'utf8');
    
    console.log('🔧 Creating comprehensive lead management tables...');
    await client.query(leadsSchema);
    
    // Read and execute trial management migration
    const trialSchemaPath = path.join(__dirname, '../database/migrations/003_trial_management.sql');
    const trialSchema = fs.readFileSync(trialSchemaPath, 'utf8');
    
    console.log('🔧 Creating trial management system...');
    await client.query(trialSchema);
    
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
    
    // Drop all tables in correct order
    await client.query(`
      -- Drop trial management tables first (due to foreign keys)
      DROP TABLE IF EXISTS organization_trial_history CASCADE;
      DROP TABLE IF EXISTS organization_subscriptions CASCADE;
      
      -- Drop lead-related tables (due to foreign keys)
      DROP TABLE IF EXISTS lead_documents CASCADE;
      DROP TABLE IF EXISTS lead_tag_assignments CASCADE;
      DROP TABLE IF EXISTS lead_tags CASCADE;
      DROP TABLE IF EXISTS lead_scoring_rules CASCADE;
      DROP TABLE IF EXISTS lead_interactions CASCADE;
      DROP TABLE IF EXISTS lead_assignments CASCADE;
      DROP TABLE IF EXISTS leads CASCADE;
      DROP TABLE IF EXISTS lead_statuses CASCADE;
      DROP TABLE IF EXISTS lead_sources CASCADE;
      
      -- Drop contact management tables
      DROP TABLE IF EXISTS license_transfers CASCADE;
      DROP TABLE IF EXISTS software_licenses CASCADE;
      DROP TABLE IF EXISTS trials CASCADE;
      DROP TABLE IF EXISTS downloads_activations CASCADE;
      DROP TABLE IF EXISTS device_registrations CASCADE;
      DROP TABLE IF EXISTS accounts CASCADE;
      DROP TABLE IF EXISTS contacts CASCADE;
      DROP TABLE IF EXISTS contacts_backup CASCADE;
      DROP TABLE IF EXISTS software_editions CASCADE;
      
      -- Drop auth tables
      DROP TABLE IF EXISTS user_sessions CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
      DROP TABLE IF EXISTS organizations CASCADE;
      
      -- Drop functions
      DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
      DROP FUNCTION IF EXISTS check_user_limit() CASCADE;
      DROP FUNCTION IF EXISTS create_organization_with_admin() CASCADE;
      DROP FUNCTION IF EXISTS start_organization_trial() CASCADE;
      DROP FUNCTION IF EXISTS can_start_new_trial() CASCADE;
      DROP FUNCTION IF EXISTS expire_trials() CASCADE;
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
      let dataQuery = `
        SELECT 
          (SELECT COUNT(*) FROM organizations) as organizations,
          (SELECT COUNT(*) FROM users) as users,
          (SELECT COUNT(*) FROM user_sessions) as sessions`;
      
      // Add leads data if leads table exists
      const hasLeadsTable = tablesResult.rows.some(row => row.table_name === 'leads');
      if (hasLeadsTable) {
        dataQuery += `,
          (SELECT COUNT(*) FROM leads) as leads,
          (SELECT COUNT(*) FROM lead_sources) as lead_sources,
          (SELECT COUNT(*) FROM lead_statuses) as lead_statuses,
          (SELECT COUNT(*) FROM lead_interactions) as lead_interactions`;
      }
      
      dataQuery += ';';
      
      const dataResult = await client.query(dataQuery);
      const data = dataResult.rows[0];
      
      console.log('📈 Data counts:');
      console.log(`  - Organizations: ${data.organizations}`);
      console.log(`  - Users: ${data.users}`);
      console.log(`  - Active Sessions: ${data.sessions}`);
      
      if (hasLeadsTable) {
        console.log(`  - Leads: ${data.leads}`);
        console.log(`  - Lead Sources: ${data.lead_sources}`);
        console.log(`  - Lead Statuses: ${data.lead_statuses}`);
        console.log(`  - Lead Interactions: ${data.lead_interactions}`);
      }
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