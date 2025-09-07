#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables
require('dotenv').config();

// Database connection
const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Supabase
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
});

/**
 * Apply trial management migration
 */
async function applyTrialMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Applying trial management migration...');
    
    // Read the trial management migration file
    const trialSchemaPath = path.join(__dirname, '../database/migrations/003_trial_management.sql');
    const trialSchema = fs.readFileSync(trialSchemaPath, 'utf8');
    
    console.log('🔧 Applying trial management schema...');
    
    // Execute the migration with error handling
    try {
      await client.query(trialSchema);
    } catch (error) {
      // Check if it's just a "column already exists" error
      if (error.message.includes('already exists')) {
        console.log('⚠️  Some components already exist, continuing...');
      } else {
        throw error;
      }
    }
    
    console.log('✅ Trial management schema applied successfully');
    
    // Verify new tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('organization_trial_history', 'organization_subscriptions')
      ORDER BY table_name;
    `);
    
    console.log('📊 Trial management tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Verify columns were added to organizations table
    const orgColumnsResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
        AND column_name IN (
          'trial_started_at', 'trial_ends_at', 'trial_status', 'trial_days',
          'payment_status', 'subscription_ends_at', 'grace_period_ends_at',
          'total_trial_count', 'last_trial_at'
        )
      ORDER BY column_name;
    `);
    
    console.log('📊 Trial columns added to organizations:');
    orgColumnsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name}`);
    });
    
    // Verify functions were created
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_type = 'FUNCTION'
        AND routine_name IN ('start_organization_trial', 'can_start_new_trial', 'expire_trials')
      ORDER BY routine_name;
    `);
    
    console.log('📊 Trial management functions created:');
    functionsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.routine_name}()`);
    });
    
    console.log('🎉 Trial management migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
applyTrialMigration();