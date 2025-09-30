#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createSuperAdmin() {
  // Production database configuration
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
    console.log('🔧 Creating super admin user and table...');

    // First, create the super_admin_users table if it doesn't exist
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

    console.log('✅ Super admin table created/verified');

    // Check if super admin already exists
    const existingSuperAdmin = await pool.query(
      'SELECT id FROM super_admin_users WHERE email = $1',
      ['admin@uppalcrm.com']
    );

    if (existingSuperAdmin.rows.length > 0) {
      console.log('✅ Super admin already exists');
      console.log('\n🔑 Super Admin Login Credentials:');
      console.log('   URL: https://uppalcrm-api.onrender.com/api/super-admin/login');
      console.log('   Frontend: Create a super admin login page');
      console.log('   Email: admin@uppalcrm.com');
      console.log('   Password: SuperAdmin123!');
      return;
    }

    // Create the super admin user
    const hashedPassword = await bcrypt.hash('SuperAdmin123!', 10);

    await pool.query(`
      INSERT INTO super_admin_users (email, password_hash, first_name, last_name, role, permissions)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      'admin@uppalcrm.com',
      hashedPassword,
      'Super',
      'Admin',
      'super_admin',
      'full_access'
    ]);

    console.log('✅ Created super admin user: admin@uppalcrm.com');

    console.log('\n🎉 Super Admin setup complete!');
    console.log('\n🔑 Super Admin Login Credentials:');
    console.log('   API Login URL: https://uppalcrm-api.onrender.com/api/super-admin/login');
    console.log('   Dashboard URL: https://uppalcrm-api.onrender.com/api/super-admin/dashboard');
    console.log('   Organizations URL: https://uppalcrm-api.onrender.com/api/super-admin/organizations');
    console.log('   Email: admin@uppalcrm.com');
    console.log('   Password: SuperAdmin123!');
    console.log('\n📋 Available Endpoints:');
    console.log('   GET /api/super-admin/dashboard - Main dashboard with all organizations');
    console.log('   GET /api/super-admin/organizations - List all organizations with subscriptions');
    console.log('   GET /api/super-admin/expiring-trials - View trials expiring soon');
    console.log('   PUT /api/super-admin/organizations/:id/trial - Extend trials');
    console.log('   PUT /api/super-admin/organizations/:id/convert-to-paid - Convert to paid');

    // Show sample organizations for testing
    const orgs = await pool.query(`
      SELECT
        o.id, o.name, o.trial_status, o.payment_status,
        (SELECT COUNT(*) FROM users WHERE organization_id = o.id) as user_count
      FROM organizations o
      ORDER BY o.created_at DESC
      LIMIT 5
    `);

    console.log('\n📊 Sample Organizations Available:');
    orgs.rows.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} - ${org.trial_status || 'no_trial'} (${org.user_count} users)`);
    });

  } catch (error) {
    console.error('❌ Error creating super admin:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the creation
createSuperAdmin()
  .then(() => {
    console.log('\n✅ Super admin creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Super admin creation failed:', error);
    process.exit(1);
  });