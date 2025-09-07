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
    
    // Create minimal super admin tables without complex dependencies
    console.log('🔧 Creating super admin tables...');
    
    // Create super admin users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS super_admin_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'super_admin',
        permissions JSONB DEFAULT '["all"]',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create other essential super admin tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS super_admin_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        metric_date DATE NOT NULL UNIQUE,
        total_organizations INTEGER DEFAULT 0,
        active_organizations INTEGER DEFAULT 0,
        trial_organizations INTEGER DEFAULT 0,
        paid_organizations INTEGER DEFAULT 0,
        new_signups INTEGER DEFAULT 0,
        trial_conversions INTEGER DEFAULT 0,
        churn_count INTEGER DEFAULT 0,
        total_revenue DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS organization_notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL,
        admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE SET NULL,
        note_text TEXT NOT NULL,
        note_type VARCHAR(50) DEFAULT 'general',
        is_internal BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✅ Super admin tables created');
    
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