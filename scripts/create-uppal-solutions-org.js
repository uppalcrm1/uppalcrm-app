#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function createUppalSolutionsOrg() {
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
    console.log('🏢 Creating Uppal Solutions Ltd organization in production...');

    // Check if organization already exists
    const existingOrg = await pool.query('SELECT id FROM organizations WHERE name = $1', ['Uppal Solutions Ltd']);

    let orgId;
    if (existingOrg.rows.length > 0) {
      orgId = existingOrg.rows[0].id;
      console.log('✅ Organization already exists');
    } else {
      // Create organization
      const orgResult = await pool.query(`
        INSERT INTO organizations (name, slug, subscription_plan, max_users)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, ['Uppal Solutions Ltd', 'uppal-solutions', 'trial', 10]);

      orgId = orgResult.rows[0].id;
      console.log(`✅ Created organization: Uppal Solutions Ltd (${orgId})`);
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@uppalsolutions.com']);

    if (existingUser.rows.length > 0) {
      console.log('✅ User already exists');
    } else {
      // Create admin user
      const hashedPassword = await bcrypt.hash('admin123', 10);

      await pool.query(`
        INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, ['admin@uppalsolutions.com', hashedPassword, 'Admin', 'User', 'admin', orgId]);

      console.log('✅ Created user: admin@uppalsolutions.com');
    }

    // Create trial subscription
    const trialPlan = await pool.query("SELECT id FROM subscription_plans WHERE name = 'trial'");

    if (trialPlan.rows.length > 0) {
      const planId = trialPlan.rows[0].id;

      // Check if subscription already exists
      const existingSub = await pool.query('SELECT id FROM organization_subscriptions WHERE organization_id = $1', [orgId]);

      if (existingSub.rows.length === 0) {
        await pool.query(`
          INSERT INTO organization_subscriptions (
            organization_id,
            subscription_plan_id,
            status,
            trial_ends_at,
            current_period_start,
            current_period_end
          ) VALUES ($1, $2, 'trial', NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '1 month')
        `, [orgId, planId]);

        console.log('✅ Created trial subscription');
      } else {
        console.log('✅ Subscription already exists');
      }
    }

    console.log('\n🎉 Uppal Solutions Ltd setup complete!');
    console.log('\n🔑 Production Login Credentials:');
    console.log('   Email: admin@uppalsolutions.com');
    console.log('   Password: admin123');
    console.log('   Organization: Uppal Solutions Ltd');

  } catch (error) {
    console.error('❌ Error creating organization:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the creation
createUppalSolutionsOrg()
  .then(() => {
    console.log('\n✅ Organization creation completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Organization creation failed:', error);
    process.exit(1);
  });