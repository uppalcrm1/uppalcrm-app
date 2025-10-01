#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createPlatformAdminTables() {
  console.log('🚀 Creating Platform Admin System Tables...\n');

  const dbConfig = process.env.DATABASE_URL ? {
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

  const pool = new Pool(dbConfig);

  try {
    // 1. Create platform_admins table
    console.log('1️⃣ Creating platform_admins table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS platform_admins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ platform_admins table created');

    // 2. Create trial_signups table
    console.log('\n2️⃣ Creating trial_signups table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trial_signups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        company VARCHAR(255),
        website VARCHAR(255),
        phone VARCHAR(50),
        industry VARCHAR(100),
        team_size VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        utm_source VARCHAR(100),
        utm_campaign VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_term VARCHAR(100),
        utm_content VARCHAR(100),
        notes TEXT,
        converted_organization_id UUID,
        converted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (converted_organization_id) REFERENCES organizations(id)
      )
    `);
    console.log('   ✅ trial_signups table created');

    // 3. Create indexes for better performance
    console.log('\n3️⃣ Creating indexes...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_trial_signups_email ON trial_signups(email);
      CREATE INDEX IF NOT EXISTS idx_trial_signups_status ON trial_signups(status);
      CREATE INDEX IF NOT EXISTS idx_trial_signups_created_at ON trial_signups(created_at);
      CREATE INDEX IF NOT EXISTS idx_trial_signups_utm_source ON trial_signups(utm_source);
      CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON platform_admins(email);
    `);
    console.log('   ✅ Performance indexes created');

    // 4. Create initial platform admin
    console.log('\n4️⃣ Creating initial platform admin...');

    // Check if admin already exists
    const existingAdmin = await pool.query(
      'SELECT id FROM platform_admins WHERE email = $1',
      ['admin@uppalcrm.com']
    );

    if (existingAdmin.rows.length === 0) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      const result = await pool.query(`
        INSERT INTO platform_admins (email, password_hash, name)
        VALUES ($1, $2, $3)
        RETURNING id, email, name
      `, ['admin@uppalcrm.com', hashedPassword, 'Platform Administrator']);

      console.log('   ✅ Initial platform admin created:', result.rows[0]);
    } else {
      console.log('   ℹ️  Platform admin already exists: admin@uppalcrm.com');
    }

    // 5. Add some sample trial signups for testing
    console.log('\n5️⃣ Adding sample trial signups...');
    const sampleSignups = [
      {
        first_name: 'John',
        last_name: 'Smith',
        email: 'john.smith@techcorp.com',
        company: 'TechCorp Solutions',
        website: 'https://techcorp.com',
        phone: '+1-555-0123',
        industry: 'Technology',
        team_size: '11-50',
        utm_source: 'google',
        utm_campaign: 'crm-search',
        utm_medium: 'cpc'
      },
      {
        first_name: 'Sarah',
        last_name: 'Johnson',
        email: 'sarah@innovateplus.com',
        company: 'InnovatePlus',
        website: 'https://innovateplus.com',
        phone: '+1-555-0456',
        industry: 'Marketing',
        team_size: '1-10',
        utm_source: 'linkedin',
        utm_campaign: 'b2b-outreach',
        utm_medium: 'social'
      },
      {
        first_name: 'Michael',
        last_name: 'Brown',
        email: 'mike@growthventures.com',
        company: 'Growth Ventures',
        website: 'https://growthventures.com',
        phone: '+1-555-0789',
        industry: 'Consulting',
        team_size: '51-200',
        utm_source: 'facebook',
        utm_campaign: 'business-tools',
        utm_medium: 'social'
      }
    ];

    for (const signup of sampleSignups) {
      const existing = await pool.query('SELECT id FROM trial_signups WHERE email = $1', [signup.email]);
      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO trial_signups (
            first_name, last_name, email, company, website, phone,
            industry, team_size, utm_source, utm_campaign, utm_medium
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          signup.first_name, signup.last_name, signup.email, signup.company,
          signup.website, signup.phone, signup.industry, signup.team_size,
          signup.utm_source, signup.utm_campaign, signup.utm_medium
        ]);
        console.log(`   ✅ Added sample signup: ${signup.email}`);
      } else {
        console.log(`   ℹ️  Sample signup already exists: ${signup.email}`);
      }
    }

    console.log('\n🎉 Platform Admin System Setup Complete!');
    console.log('\n📋 Summary:');
    console.log('   ✅ platform_admins table created');
    console.log('   ✅ trial_signups table created');
    console.log('   ✅ Performance indexes created');
    console.log('   ✅ Initial platform admin created');
    console.log('   ✅ Sample trial signups added');

    console.log('\n🔑 Platform Admin Credentials:');
    console.log('   Email: admin@uppalcrm.com');
    console.log('   Password: Admin123!');

    console.log('\n📊 Next Steps:');
    console.log('   1. Platform admin models will be created');
    console.log('   2. Authentication middleware will be implemented');
    console.log('   3. API routes will be added');
    console.log('   4. Frontend dashboard will be built');

  } catch (error) {
    console.error('❌ Error creating platform admin tables:', error.message);
    console.error('🔍 Error details:', error.stack);
  } finally {
    await pool.end();
  }
}

createPlatformAdminTables();