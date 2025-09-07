#!/usr/bin/env node

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

async function applySuperAdminMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Applying super admin migration...');
    
    // Read the super admin migration file
    const migrationPath = path.join(__dirname, '../database/migrations/004_super_admin.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🔧 Executing super admin migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Super admin migration applied successfully');
    
    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN (
          'super_admin_users', 'platform_metrics', 'organization_notes',
          'organization_engagement', 'super_admin_sessions'
        )
      ORDER BY table_name;
    `);
    
    console.log('📊 Super admin tables created:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });
    
    // Verify views were created
    const viewsResult = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name IN ('trial_overview', 'business_leads')
      ORDER BY table_name;
    `);
    
    console.log('📊 Super admin views created:');
    viewsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.table_name} (view)`);
    });
    
    // Verify functions were created
    const functionsResult = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name IN ('calculate_daily_metrics', 'get_expiring_trials')
        AND routine_schema = 'public'
      ORDER BY routine_name;
    `);
    
    console.log('📊 Super admin functions created:');
    functionsResult.rows.forEach(row => {
      console.log(`  ✓ ${row.routine_name}()`);
    });
    
    // Check if super admin user was created
    const adminResult = await client.query(`
      SELECT email, first_name, last_name FROM super_admin_users WHERE email = 'admin@yourcrm.com'
    `);
    
    if (adminResult.rows.length > 0) {
      const admin = adminResult.rows[0];
      console.log(`👑 Super admin user created: ${admin.first_name} ${admin.last_name} (${admin.email})`);
      console.log('🔑 Default login: admin@yourcrm.com / admin123');
    }
    
    console.log('🎉 Super admin system ready!');
    console.log('🌐 Access at: http://localhost:3003/super-admin');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

applySuperAdminMigration();