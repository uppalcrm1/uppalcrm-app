#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Database connection
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

async function setAdminPassword() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Setting super admin password...');
    
    const email = 'admin@yourcrm.com';
    const password = 'admin123';
    
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Update or insert the super admin user
    const result = await client.query(`
      INSERT INTO super_admin_users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, 'Super', 'Admin')
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = NOW()
      RETURNING email, first_name, last_name
    `, [email, hashedPassword]);
    
    if (result.rows.length > 0) {
      const admin = result.rows[0];
      console.log(`✅ Super admin password set for: ${admin.first_name} ${admin.last_name} (${admin.email})`);
      console.log('🔑 Login credentials:');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
      console.log('🌐 Access at: http://localhost:3003/super-admin');
    }
    
  } catch (error) {
    console.error('❌ Failed to set password:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setAdminPassword();