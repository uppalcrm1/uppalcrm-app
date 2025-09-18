#!/usr/bin/env node

/**
 * Setup script to create admin user for staging environment
 */

const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function setupStagingUser() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Setting up staging user...');

    // Enable UUID extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create organizations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Check if staging organization exists
    const orgResult = await pool.query(
      'SELECT id FROM organizations WHERE slug = $1',
      ['staging-test']
    );

    let orgId;
    if (orgResult.rows.length === 0) {
      // Create staging organization
      const newOrg = await pool.query(
        'INSERT INTO organizations (name, slug) VALUES ($1, $2) RETURNING id',
        ['Staging Test Organization', 'staging-test']
      );
      orgId = newOrg.rows[0].id;
      console.log('✅ Created staging organization');
    } else {
      orgId = orgResult.rows[0].id;
      console.log('✅ Staging organization already exists');
    }

    // Check if admin user exists
    const userResult = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      ['admin@staging.uppalcrm.com']
    );

    if (userResult.rows.length === 0) {
      // Hash password
      const hashedPassword = await bcrypt.hash('staging123', 12);

      // Create admin user
      await pool.query(`
        INSERT INTO users (organization_id, first_name, last_name, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [orgId, 'Admin', 'User', 'admin@staging.uppalcrm.com', hashedPassword, 'admin']);

      console.log('✅ Created staging admin user');
    } else {
      console.log('✅ Staging admin user already exists');
    }

    console.log('\n🎉 Staging setup complete!');
    console.log('📋 Login credentials:');
    console.log('   Email: admin@staging.uppalcrm.com');
    console.log('   Password: staging123');
    console.log('   URL: https://uppalcrm-frontend-staging.onrender.com');

  } catch (error) {
    console.error('❌ Setup failed:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  setupStagingUser();
}

module.exports = setupStagingUser;