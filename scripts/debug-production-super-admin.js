#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function debugProductionSuperAdmin() {
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
    console.log('🔍 Debugging production super admin...');

    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'super_admin_users'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('❌ super_admin_users table does not exist!');

      // Create the table
      console.log('🔧 Creating super_admin_users table...');
      await pool.query(`
        CREATE TABLE super_admin_users (
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
      console.log('✅ Table created!');
    } else {
      console.log('✅ super_admin_users table exists');
    }

    // Check all users
    const allUsers = await pool.query('SELECT * FROM super_admin_users');
    console.log('📋 All super admin users:', allUsers.rows);

    // Check specific user
    const adminUser = await pool.query('SELECT * FROM super_admin_users WHERE email = $1', ['admin@uppalcrm.com']);

    if (adminUser.rows.length === 0) {
      console.log('❌ admin@uppalcrm.com user not found!');

      // Create the user
      console.log('👤 Creating admin@uppalcrm.com user...');
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
      const result = await pool.query(`
        INSERT INTO super_admin_users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, ['admin@uppalcrm.com', hashedPassword, 'Super', 'Admin']);

      console.log('✅ User created:', result.rows[0]);
    } else {
      console.log('✅ admin@uppalcrm.com user found:', adminUser.rows[0]);

      // Test password
      const storedHash = adminUser.rows[0].password_hash;
      const passwordMatch = await bcrypt.compare('SuperAdmin123!', storedHash);
      console.log('🔑 Password test result:', passwordMatch ? 'MATCH ✅' : 'NO MATCH ❌');

      if (!passwordMatch) {
        console.log('🔧 Updating password...');
        const newHash = await bcrypt.hash('SuperAdmin123!', 10);
        await pool.query('UPDATE super_admin_users SET password_hash = $1 WHERE email = $2', [newHash, 'admin@uppalcrm.com']);
        console.log('✅ Password updated!');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

debugProductionSuperAdmin();