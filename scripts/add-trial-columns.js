#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

console.log('🔧 Adding trial columns to production database...');

// Use production database connection
const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: false
});

async function addTrialColumns() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Checking current schema...');
    
    // Check if trial columns already exist
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      AND column_name IN ('trial_status', 'trial_started_at', 'trial_ends_at', 'payment_status')
      ORDER BY column_name;
    `);
    
    const existingColumns = columnCheck.rows.map(row => row.column_name);
    console.log('✅ Existing trial columns:', existingColumns.length > 0 ? existingColumns : 'none');
    
    const columnsToAdd = [
      { name: 'trial_status', type: 'VARCHAR(50)', default: "'no_trial'" },
      { name: 'trial_started_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'NULL' },
      { name: 'trial_ends_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'NULL' },
      { name: 'payment_status', type: 'VARCHAR(50)', default: "'trial'" }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name}`);
        await client.query(`
          ALTER TABLE organizations 
          ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default};
        `);
      } else {
        console.log(`✅ Column already exists: ${column.name}`);
      }
    }
    
    console.log('\n🎯 Setting up sample trial data for existing organizations...');
    
    // Get count of organizations
    const orgCount = await client.query('SELECT COUNT(*) as count FROM organizations WHERE trial_status IS NULL OR trial_status = \'no_trial\'');
    const orgsToUpdate = parseInt(orgCount.rows[0].count);
    
    if (orgsToUpdate > 0) {
      console.log(`🔄 Updating ${orgsToUpdate} organizations with trial data...`);
      
      // Update some organizations to have active trials
      await client.query(`
        UPDATE organizations 
        SET 
          trial_status = 'active',
          trial_started_at = CURRENT_DATE - INTERVAL '7 days',
          trial_ends_at = CURRENT_DATE + INTERVAL '14 days',
          payment_status = 'trial'
        WHERE id IN (
          SELECT id FROM organizations 
          WHERE (trial_status IS NULL OR trial_status = 'no_trial')
          ORDER BY created_at DESC 
          LIMIT 5
        );
      `);
      
      // Update some to have expired trials
      await client.query(`
        UPDATE organizations 
        SET 
          trial_status = 'expired',
          trial_started_at = CURRENT_DATE - INTERVAL '30 days',
          trial_ends_at = CURRENT_DATE - INTERVAL '2 days',
          payment_status = 'trial'
        WHERE id IN (
          SELECT id FROM organizations 
          WHERE (trial_status IS NULL OR trial_status = 'no_trial')
          ORDER BY created_at ASC
          LIMIT 3
        );
      `);
      
      // Update some to be paid customers
      await client.query(`
        UPDATE organizations 
        SET 
          trial_status = 'converted',
          trial_started_at = CURRENT_DATE - INTERVAL '20 days',
          trial_ends_at = CURRENT_DATE - INTERVAL '5 days',
          payment_status = 'paid'
        WHERE id IN (
          SELECT id FROM organizations 
          WHERE (trial_status IS NULL OR trial_status = 'no_trial')
          ORDER BY RANDOM()
          LIMIT 2
        );
      `);
      
      console.log('✅ Sample trial data added');
    }
    
    // Verify the changes
    console.log('\n📊 Verifying trial data...');
    const trialStats = await client.query(`
      SELECT 
        trial_status,
        COUNT(*) as count
      FROM organizations 
      GROUP BY trial_status
      ORDER BY count DESC;
    `);
    
    console.log('📈 Trial status distribution:');
    trialStats.rows.forEach(stat => {
      console.log(`   ${stat.trial_status}: ${stat.count} organizations`);
    });
    
    // Test a sample query
    console.log('\n🧪 Testing dashboard query...');
    const testQuery = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM organizations WHERE trial_status = 'active') as active_trials,
        (SELECT COUNT(*) FROM organizations WHERE trial_status = 'expired') as expired_trials,
        (SELECT COUNT(*) FROM organizations WHERE payment_status = 'paid') as paid_customers,
        (SELECT COUNT(*) FROM organizations) as total_organizations
    `);
    
    console.log('✅ Dashboard query test:', testQuery.rows[0]);
    
    console.log('\n🎉 Trial columns migration completed successfully!');
    console.log('✅ Your super admin dashboard should now work in production');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  addTrialColumns().catch(error => {
    console.error('Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = { addTrialColumns };