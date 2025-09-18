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

    // Drop and recreate organizations table to fix schema
    await pool.query('DROP TABLE IF EXISTS organizations CASCADE');

    // Create organizations table with complete schema
    await pool.query(`
      CREATE TABLE organizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT true,
        settings JSONB DEFAULT '{}',
        subscription_plan VARCHAR(50) DEFAULT 'starter',
        max_users INTEGER DEFAULT 10,
        purchased_licenses INTEGER DEFAULT 10,
        domain VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Drop and recreate users table to fix schema
    await pool.query('DROP TABLE IF EXISTS users CASCADE');

    // Create users table with complete schema
    await pool.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        email_verified BOOLEAN DEFAULT false,
        permissions JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'active',
        created_by UUID,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create user_sessions table for token management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id),
        organization_id UUID NOT NULL REFERENCES organizations(id),
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create leads table for CRM functionality
    console.log('📝 Creating leads table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        title VARCHAR(255),
        company VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        source VARCHAR(100) DEFAULT 'manual',
        status VARCHAR(50) DEFAULT 'new',
        priority VARCHAR(20) DEFAULT 'medium',
        value DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        assigned_to UUID REFERENCES users(id),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_contact_date TIMESTAMP WITH TIME ZONE,
        next_follow_up TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create contacts table for CRM functionality
    console.log('📝 Creating contacts table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        company VARCHAR(255),
        position VARCHAR(255),
        notes TEXT,
        tags TEXT[],
        created_by UUID REFERENCES users(id),
        assigned_to UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_contact_date TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create indexes for performance
    console.log('📝 Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
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