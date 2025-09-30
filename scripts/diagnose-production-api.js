#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function diagnoseProductionAPI() {
  console.log('🔍 Diagnosing Production API Issues...\n');

  // 1. Check Environment Variables
  console.log('1️⃣ Environment Variables Check:');
  console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Present' : '❌ Missing');
  console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Present' : '❌ Missing');
  console.log('   NODE_ENV:', process.env.NODE_ENV || 'Not set');
  console.log();

  // 2. Database Connection Test
  console.log('2️⃣ Database Connection Test:');
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
    // Test basic connection
    const client = await pool.connect();
    console.log('   ✅ Database connection successful');
    client.release();

    // 3. Check Super Admin Table
    console.log('\n3️⃣ Super Admin Table Check:');
    const tableCheck = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'super_admin_users'
    `);

    if (tableCheck.rows.length === 0) {
      console.log('   ❌ super_admin_users table does not exist');
      return;
    } else {
      console.log('   ✅ super_admin_users table exists');
    }

    // 4. Check Super Admin Users
    console.log('\n4️⃣ Super Admin Users Check:');
    const allUsers = await pool.query('SELECT email, is_active, created_at FROM super_admin_users ORDER BY created_at DESC');
    console.log(`   📊 Total super admin users: ${allUsers.rows.length}`);

    if (allUsers.rows.length > 0) {
      console.log('   📋 Users:');
      allUsers.rows.forEach((user, index) => {
        console.log(`      ${index + 1}. ${user.email} (Active: ${user.is_active}) - Created: ${user.created_at}`);
      });
    }

    // 5. Test Specific User
    console.log('\n5️⃣ Target User Test (admin@uppalcrm.com):');
    const targetUser = await pool.query(
      'SELECT * FROM super_admin_users WHERE email = $1 AND is_active = true',
      ['admin@uppalcrm.com']
    );

    if (targetUser.rows.length === 0) {
      console.log('   ❌ admin@uppalcrm.com not found or not active');

      // Try to create it
      console.log('\n6️⃣ Creating admin@uppalcrm.com user:');
      const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);
      await pool.query(
        'DELETE FROM super_admin_users WHERE email = $1',
        ['admin@uppalcrm.com']
      );

      const createResult = await pool.query(`
        INSERT INTO super_admin_users (email, password_hash, first_name, last_name, role, permissions, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, email
      `, ['admin@uppalcrm.com', hashedPassword, 'Super', 'Admin', 'super_admin', 'full_access', true]);

      console.log('   ✅ User created:', createResult.rows[0]);
    } else {
      console.log('   ✅ admin@uppalcrm.com found and active');
      const user = targetUser.rows[0];

      // 6. Test Password
      console.log('\n6️⃣ Password Test:');
      const passwordValid = await bcrypt.compare('SuperAdmin123!', user.password_hash);
      console.log(`   🔑 Password validation: ${passwordValid ? '✅ Valid' : '❌ Invalid'}`);

      // 7. Test JWT Creation
      if (process.env.JWT_SECRET) {
        console.log('\n7️⃣ JWT Token Test:');
        try {
          const token = jwt.sign(
            { user_id: user.id, email: user.email, is_super_admin: true },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
          );
          console.log('   ✅ JWT token created successfully');
          console.log(`   🔗 Token length: ${token.length} characters`);
        } catch (error) {
          console.log('   ❌ JWT token creation failed:', error.message);
        }
      }
    }

    // 8. API Endpoint Test
    console.log('\n8️⃣ Production API Test:');
    try {
      const response = await fetch('https://uppalcrm-api.onrender.com/api/test');
      const data = await response.text();
      console.log(`   📡 API Response (${response.status}):`, data.substring(0, 100));
    } catch (error) {
      console.log('   ❌ API test failed:', error.message);
    }

    console.log('\n🎉 Diagnosis complete!');
    console.log('\n💡 Recommended Actions:');
    console.log('   1. Ensure production environment has JWT_SECRET set');
    console.log('   2. Verify production database connection is stable');
    console.log('   3. Check production logs for detailed error messages');
    console.log('   4. Ensure latest code is deployed to production');

  } catch (error) {
    console.error('❌ Database error:', error.message);
    console.error('🔍 Error details:', error.stack);
  } finally {
    await pool.end();
  }
}

diagnoseProductionAPI();