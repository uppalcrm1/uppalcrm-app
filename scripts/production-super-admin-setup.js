#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// This script runs in production environment with production DB credentials
console.log('🚀 Running super admin setup in production environment...');

// Use production database connection
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

async function setupSuperAdmin() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Applying super admin migration in production...');
    console.log('🌍 Environment:', process.env.NODE_ENV);
    
    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'super_admin_users'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ Super admin tables already exist');
      return;
    }
    
    // Apply trial management migration first (dependency)
    console.log('🔧 Checking trial management migration...');
    const trialTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'organization_subscriptions'
      );
    `);
    
    if (!trialTableCheck.rows[0].exists) {
      console.log('🔧 Applying trial management migration first...');
      const trialMigrationPath = path.join(__dirname, '../database/migrations/003_trial_management.sql');
      const trialMigrationSQL = fs.readFileSync(trialMigrationPath, 'utf8');
      await client.query(trialMigrationSQL);
      console.log('✅ Trial management migration applied');
    }
    
    // Read and execute super admin migration
    const migrationPath = path.join(__dirname, '../database/migrations/004_super_admin.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔧 Executing super admin migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Super admin migration applied successfully');
    
    // Verify and create super admin user if needed
    const userCheck = await client.query(
      'SELECT * FROM super_admin_users WHERE email = $1',
      ['admin@yourcrm.com']
    );
    
    if (userCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await client.query(`
        INSERT INTO super_admin_users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, 'Super', 'Admin')
      `, ['admin@yourcrm.com', hashedPassword]);
      
      console.log('👑 Super admin user created successfully');
    } else {
      console.log('✅ Super admin user already exists');
    }
    
    console.log('🎉 Production super admin setup complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupSuperAdmin().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});