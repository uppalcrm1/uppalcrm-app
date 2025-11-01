#!/usr/bin/env node

/**
 * Apply Comprehensive History Tracking for ALL Entities
 *
 * This script applies migrations 011, 012, 013 which:
 * - Creates history tables for Contacts, Accounts, Transactions
 * - Creates comprehensive triggers to track ALL field changes
 * - Tracks entity creation
 * - Tracks all updates (status, fields, assignments)
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function applyMigrations() {
  try {
    console.log('🚀 Applying comprehensive history tracking for all entities...\n');

    const migrations = [
      {
        file: '011_comprehensive_contact_history.sql',
        name: 'Contact History Tracking',
        entity: 'contacts'
      },
      {
        file: '012_comprehensive_account_history.sql',
        name: 'Account History Tracking',
        entity: 'accounts'
      },
      {
        file: '013_comprehensive_transaction_history.sql',
        name: 'Transaction History Tracking',
        entity: 'transactions'
      }
    ];

    for (const migration of migrations) {
      console.log(`📄 Running migration: ${migration.file}`);
      console.log(`   ${migration.name}`);
      console.log('='.repeat(60));

      // Check if the table exists first
      const tableExistsQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = $1
        );
      `;

      const tableExists = await db.query(tableExistsQuery, [migration.entity]);

      if (!tableExists.rows[0].exists) {
        console.log(`⏭️  Skipping - ${migration.entity} table does not exist\n`);
        continue;
      }

      const migrationPath = path.join(__dirname, '..', 'database', 'migrations', migration.file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

      await db.query(migrationSQL);

      console.log(`✅ ${migration.name} completed!\n`);
    }

    console.log('\n📊 Summary of Changes:');
    console.log('='.repeat(60));

    // Verify all tables exist
    const verifyTablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'contact_change_history', 'contact_status_history',
        'account_change_history', 'account_status_history',
        'transaction_change_history', 'transaction_status_history'
      )
      ORDER BY table_name;
    `;

    const tables = await db.query(verifyTablesQuery);
    console.log('\n✅ History Tables Created:');
    tables.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });

    // Verify all triggers exist
    const verifyTriggersQuery = `
      SELECT trigger_name, event_object_table, event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      AND event_object_table IN ('contacts', 'accounts', 'transactions')
      AND trigger_name LIKE 'track_%'
      ORDER BY event_object_table, trigger_name;
    `;

    const triggers = await db.query(verifyTriggersQuery);
    console.log('\n✅ Triggers Installed:');
    let currentTable = null;
    triggers.rows.forEach(row => {
      if (row.event_object_table !== currentTable) {
        console.log(`\n   ${row.event_object_table.toUpperCase()}:`);
        currentTable = row.event_object_table;
      }
      console.log(`   ✓ ${row.trigger_name} (${row.event_manipulation})`);
    });

    console.log('\n🎉 All history tracking is now fully operational!');
    console.log('   All changes to Contacts, Accounts, and Transactions will be logged.');
    console.log('\n💡 What is tracked:');
    console.log('   CONTACTS: status, assignments, contact info, type, priority, value, address, notes');
    console.log('   ACCOUNTS: status, owner, account details, financial data, billing/shipping address');
    console.log('   TRANSACTIONS: status, amount, payment info, dates, relationships, references');

    console.log('\n✨ Test it:');
    console.log('   1. Go to any Contact/Account/Transaction detail page');
    console.log('   2. Change any field or status');
    console.log('   3. Check the History tab - changes should appear!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

// Run the migrations
applyMigrations();
