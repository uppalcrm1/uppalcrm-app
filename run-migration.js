#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const { Client } = require('pg');

async function runMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();

    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'unique-email-migration.sql'),
      'utf8'
    );

    console.log('🚀 Running unique email migration...');
    await client.query(migrationSQL);

    console.log('✅ Migration completed successfully!');
    console.log('📊 Running verification queries...');

    // Verification: Check for duplicate emails
    const duplicatesResult = await client.query(`
      SELECT email, COUNT(*) as count 
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `);

    if (duplicatesResult.rows.length === 0) {
      console.log('✅ No duplicate emails found - migration successful!');
    } else {
      console.log('❌ Found duplicate emails:', duplicatesResult.rows);
    }

    // Show email statistics
    const statsResult = await client.query(`
      SELECT 
        COUNT(DISTINCT email) as unique_emails, 
        COUNT(*) as total_users 
      FROM users 
      WHERE is_active = true
    `);

    console.log('📈 User statistics:');
    console.log(`  - Unique emails: ${statsResult.rows[0].unique_emails}`);
    console.log(`  - Total active users: ${statsResult.rows[0].total_users}`);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed.');
  }
}

// Run the migration
runMigration()
  .then(() => {
    console.log('🎉 Migration process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });