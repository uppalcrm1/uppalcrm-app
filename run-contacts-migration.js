#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database connection
const { Client } = require('pg');

async function runContactsMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();

    console.log('📖 Reading contacts migration file...');
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'database', 'contacts-migration.sql'),
      'utf8'
    );

    console.log('🚀 Running Contact Management System migration...');
    console.log('   This will transform leads to contacts and add software licensing tables...');
    
    // Run the migration
    const result = await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Running verification queries...');

    // Verification 1: Check if all new tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (
        'contacts', 'software_editions', 'accounts', 'device_registrations',
        'software_licenses', 'trials', 'license_transfers', 'downloads_activations'
      )
      ORDER BY table_name
    `);

    console.log('📋 Created tables:');
    tablesResult.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });

    // Verification 2: Check contacts data migration
    const contactsResult = await client.query(`
      SELECT 
        COUNT(*) as total_contacts,
        COUNT(CASE WHEN contact_status = 'prospect' THEN 1 END) as prospects,
        COUNT(CASE WHEN contact_status = 'customer' THEN 1 END) as customers,
        COUNT(CASE WHEN contact_status = 'trial_user' THEN 1 END) as trial_users
      FROM contacts
    `);

    console.log('👥 Contacts migration statistics:');
    console.log(`  - Total contacts: ${contactsResult.rows[0].total_contacts}`);
    console.log(`  - Prospects: ${contactsResult.rows[0].prospects}`);
    console.log(`  - Customers: ${contactsResult.rows[0].customers}`);
    console.log(`  - Trial users: ${contactsResult.rows[0].trial_users}`);

    // Verification 3: Check software editions
    const editionsResult = await client.query(`
      SELECT name, display_name, price, trial_duration_hours
      FROM software_editions 
      ORDER BY price DESC
    `);

    console.log('💿 Software editions created:');
    editionsResult.rows.forEach(edition => {
      console.log(`  ✅ ${edition.display_name} - $${edition.price} (${edition.trial_duration_hours}h trial)`);
    });

    // Verification 4: Check indexes
    const indexesResult = await client.query(`
      SELECT 
        schemaname, tablename, indexname
      FROM pg_indexes 
      WHERE tablename IN (
        'contacts', 'software_editions', 'accounts', 'device_registrations',
        'software_licenses', 'trials', 'license_transfers', 'downloads_activations'
      )
      AND schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    console.log('🔍 Performance indexes created:', indexesResult.rows.length);

    // Verification 5: Check RLS policies
    const policiesResult = await client.query(`
      SELECT schemaname, tablename, policyname
      FROM pg_policies 
      WHERE tablename IN (
        'contacts', 'software_editions', 'accounts', 'device_registrations',
        'software_licenses', 'trials', 'license_transfers', 'downloads_activations'
      )
      AND schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('🔒 Row Level Security policies created:', policiesResult.rows.length);

    // Check if backup table exists
    const backupResult = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'contacts_backup'
      ) as backup_exists
    `);

    if (backupResult.rows[0].backup_exists) {
      console.log('💾 Original leads data preserved in contacts_backup table');
      console.log('   You can drop this table after verifying the migration: DROP TABLE contacts_backup;');
    }

    console.log('');
    console.log('🎉 Contact Management System is now ready!');
    console.log('');
    console.log('📋 What was created:');
    console.log('  • Contacts table (evolved from leads)');
    console.log('  • Software Editions (Gold, Jio, Smart)');
    console.log('  • Accounts (individual software accounts)');
    console.log('  • Device Registrations (MAC address tracking)');
    console.log('  • Software Licenses (1:1 device licensing)');
    console.log('  • Trials (24-hour trial management)');
    console.log('  • License Transfers (free transfers with time tracking)');
    console.log('  • Downloads/Activations (email delivery and activation tracking)');
    console.log('');
    console.log('🚀 Your CRM is now a complete software licensing platform!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Provide helpful debugging information
    if (error.message.includes('relation') && error.message.includes('does not exist')) {
      console.error('💡 Tip: This might be because the base schema is not set up. Run the main schema first.');
    }
    
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed.');
  }
}

// Run the migration
runContactsMigration()
  .then(() => {
    console.log('🎉 Contact Management System migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });