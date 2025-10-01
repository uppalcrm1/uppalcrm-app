#!/usr/bin/env node

const bcrypt = require('bcrypt');
const { query } = require('../database/connection');

async function createPlatformAdmin() {
  try {
    const email = 'admin@uppalcrm.com';
    const password = 'Admin123!';
    const name = 'Platform Administrator';

    console.log('🔐 Creating Platform Admin...');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Password: ${password}`);
    console.log(`👤 Name: ${name}`);
    console.log('');

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Check if admin already exists
    const existingAdmin = await query(
      'SELECT * FROM platform_admins WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingAdmin.rows.length > 0) {
      console.log('⚠️  Platform admin already exists!');
      console.log('');
      console.log('🎯 Use these credentials to login:');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      console.log('');
      console.log('🌐 Login URL: http://localhost:3004/super-admin/login');
      return;
    }

    // Create the platform admin
    const result = await query(`
      INSERT INTO platform_admins (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [email.toLowerCase(), hashedPassword, name]);

    if (result.rows.length > 0) {
      console.log('✅ Platform admin created successfully!');
      console.log('');
      console.log('🎯 Use these credentials to login:');
      console.log(`📧 Email: ${email}`);
      console.log(`🔑 Password: ${password}`);
      console.log('');
      console.log('🌐 Login URL: http://localhost:3004/super-admin/login');
      console.log('');
      console.log('📋 Admin Details:');
      console.log(`   ID: ${result.rows[0].id}`);
      console.log(`   Created: ${result.rows[0].created_at}`);
    } else {
      throw new Error('Failed to create platform admin');
    }

  } catch (error) {
    console.error('❌ Error creating platform admin:', error.message);

    if (error.code === '42P01') {
      console.log('');
      console.log('💡 It looks like the platform_admins table doesn\'t exist.');
      console.log('   Please run the database migration first:');
      console.log('   psql -d your_database -f database/platform-admin-migration.sql');
    }

    process.exit(1);
  }
}

async function main() {
  console.log('🚀 Platform Admin Creation Script');
  console.log('==================================');
  console.log('');

  try {
    await createPlatformAdmin();
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { createPlatformAdmin };