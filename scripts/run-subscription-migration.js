#!/usr/bin/env node

/**
 * Script to run the subscription fields migration
 * Usage: npm run migrate:subscription
 */

const fs = require('fs');
const path = require('path');
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

/**
 * Run subscription fields migration
 */
async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting subscription fields migration...');
    console.log('📍 Database:', process.env.DATABASE_URL ? 'Production (Render)' : 'Local');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/002_add_subscription_fields.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('🔧 Applying subscription fields migration...');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');

    // Verify the new columns were added
    console.log('🔍 Verifying new columns...');
    const verifyResult = await client.query(`
      SELECT column_name, data_type, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'organizations'
        AND column_name IN (
          'contact_email', 'contact_phone', 'subscription_status',
          'trial_ends_at', 'billing_email', 'payment_method',
          'last_payment_date', 'next_billing_date', 'monthly_cost', 'notes'
        )
      ORDER BY column_name;
    `);

    if (verifyResult.rows.length === 0) {
      console.warn('⚠️  Warning: Could not verify new columns. They may already exist or there was an issue.');
    } else {
      console.log('📊 New columns added:');
      verifyResult.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    }

    // Verify indexes
    const indexResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'organizations'
        AND indexname IN (
          'idx_organizations_subscription_status',
          'idx_organizations_trial_ends_at',
          'idx_organizations_next_billing_date'
        )
      ORDER BY indexname;
    `);

    console.log('📈 Indexes created:');
    if (indexResult.rows.length === 0) {
      console.log('  - (None found - may already exist)');
    } else {
      indexResult.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
    }

    // Verify constraint
    const constraintResult = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conname = 'check_subscription_status'
        AND conrelid = 'organizations'::regclass;
    `);

    console.log('🔒 Constraints:');
    if (constraintResult.rows.length === 0) {
      console.log('  - (check_subscription_status constraint may already exist)');
    } else {
      constraintResult.rows.forEach(row => {
        console.log(`  - ${row.conname}`);
      });
    }

    // Show sample organization data with new fields
    const sampleResult = await client.query(`
      SELECT
        id,
        name,
        subscription_status,
        trial_ends_at,
        contact_email,
        monthly_cost
      FROM organizations
      LIMIT 3;
    `);

    if (sampleResult.rows.length > 0) {
      console.log('📋 Sample organizations:');
      sampleResult.rows.forEach(org => {
        console.log(`  - ${org.name}:`);
        console.log(`    Status: ${org.subscription_status || 'Not set'}`);
        console.log(`    Trial Ends: ${org.trial_ends_at || 'Not set'}`);
        console.log(`    Contact: ${org.contact_email || 'Not set'}`);
        console.log(`    Monthly Cost: $${org.monthly_cost || 0}`);
      });
    }

    console.log('');
    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('📝 Next Steps:');
    console.log('  1. Update super admin UI to display subscription fields');
    console.log('  2. Add API endpoints for managing subscriptions');
    console.log('  3. Set up automated trial expiry checks');
    console.log('  4. Configure billing reminders');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Error details:');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration();
