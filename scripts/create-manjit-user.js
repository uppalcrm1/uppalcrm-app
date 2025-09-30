#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createManjitUser() {
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
    console.log('👤 Creating manjitsingh@uppalsolutions.com user in production...');

    // Get the Uppal Solutions Ltd organization ID
    const orgResult = await pool.query('SELECT id FROM organizations WHERE name = $1', ['Uppal Solutions Ltd']);

    if (orgResult.rows.length === 0) {
      console.log('❌ Uppal Solutions Ltd organization not found');
      return;
    }

    const orgId = orgResult.rows[0].id;
    console.log(`✅ Found organization: Uppal Solutions Ltd (${orgId})`);

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', ['manjitsingh@uppalsolutions.com']);

    if (existingUser.rows.length > 0) {
      console.log('✅ User already exists');
      console.log('\n🔑 Use these credentials:');
      console.log('   Email: manjitsingh@uppalsolutions.com');
      console.log('   Password: admin123');
      return;
    }

    // Create the user
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, ['manjitsingh@uppalsolutions.com', hashedPassword, 'Manjit', 'Singh', 'admin', orgId]);

    console.log('✅ Created user: manjitsingh@uppalsolutions.com');

    console.log('\n🎉 User creation complete!');
    console.log('\n🔑 Production Login Credentials:');
    console.log('   URL: https://uppalcrm-frontend.onrender.com/login');
    console.log('   Email: manjitsingh@uppalsolutions.com');
    console.log('   Password: admin123');
    console.log('   Organization: Uppal Solutions Ltd');

  } catch (error) {
    console.error('❌ Error creating user:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the creation
createManjitUser()
  .then(() => {
    console.log('\n✅ User creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ User creation failed:', error);
    process.exit(1);
  });