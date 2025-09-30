#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createSuperAdminSimple() {
  const productionDbConfig = process.env.DATABASE_URL ? {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  } : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: false
  };

  const pool = new Pool(productionDbConfig);

  try {
    console.log('🔧 Creating super admin user...');

    // Create table with simple structure
    await pool.query(`
      CREATE TABLE IF NOT EXISTS super_admin_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'super_admin',
        permissions TEXT DEFAULT 'full_access',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Check if already exists
    const existing = await pool.query('SELECT id FROM super_admin_users WHERE email = $1', ['admin@uppalcrm.com']);

    if (existing.rows.length > 0) {
      console.log('✅ Super admin already exists!');
    } else {
      // Insert without array
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
      await pool.query(`
        INSERT INTO super_admin_users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
      `, ['admin@uppalcrm.com', hashedPassword, 'Super', 'Admin']);

      console.log('✅ Created super admin user!');
    }

    console.log('\n🎉 Super Admin Setup Complete!');
    console.log('\n🔑 Access your multi-tenant admin interface:');
    console.log('   API Base: https://uppalcrm-api.onrender.com/api/super-admin/');
    console.log('   Email: admin@uppalcrm.com');
    console.log('   Password: SuperAdmin123!');
    console.log('\n📋 Available API Endpoints:');
    console.log('   POST /api/super-admin/login - Login and get auth token');
    console.log('   GET /api/super-admin/dashboard - View all organizations dashboard');
    console.log('   GET /api/super-admin/organizations - List all businesses/organizations');
    console.log('   GET /api/super-admin/debug-organizations - Simple org list');
    console.log('\n💡 To see all businesses subscribed to your B2B CRM:');
    console.log('   1. Login via API to get token');
    console.log('   2. Use token to access /organizations or /dashboard');
    console.log('   3. Or create a frontend admin panel that calls these APIs');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createSuperAdminSimple();