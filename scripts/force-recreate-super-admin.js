#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function forceRecreateSuperAdmin() {
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
    console.log('🔧 Force recreating super admin user...');

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

    // Delete existing user if exists
    console.log('🗑️ Removing existing super admin...');
    await pool.query('DELETE FROM super_admin_users WHERE email = $1', ['admin@uppalcrm.com']);

    // Create new user
    console.log('👤 Creating new super admin...');
    const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
    await pool.query(`
      INSERT INTO super_admin_users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
    `, ['admin@uppalcrm.com', hashedPassword, 'Super', 'Admin']);

    console.log('✅ Super admin user recreated successfully!');

    // Verify the user was created
    const verifyUser = await pool.query('SELECT email, first_name, last_name, role FROM super_admin_users WHERE email = $1', ['admin@uppalcrm.com']);
    if (verifyUser.rows.length > 0) {
      console.log('✅ Verification successful:', verifyUser.rows[0]);
    } else {
      console.log('❌ Verification failed - user not found');
    }

    console.log('\n🎉 Super Admin Setup Complete!');
    console.log('\n🔑 Login Credentials:');
    console.log('   Email: admin@uppalcrm.com');
    console.log('   Password: SuperAdmin123!');
    console.log('\n📋 Test login with:');
    console.log('   curl -X POST https://uppalcrm-api.onrender.com/api/super-admin/login \\');
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"email":"admin@uppalcrm.com","password":"SuperAdmin123!"}\'');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

forceRecreateSuperAdmin();