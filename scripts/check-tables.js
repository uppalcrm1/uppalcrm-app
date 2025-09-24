#!/usr/bin/env node

const { query } = require('../database/connection');

async function checkTables() {
  try {
    console.log('🔍 Checking subscription tables structure...');

    // Check organization_subscriptions structure
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'organization_subscriptions'
      ORDER BY ordinal_position
    `);

    if (columns.rows.length === 0) {
      console.log('❌ organization_subscriptions table does not exist');
      console.log('💡 You need to run the subscription schema setup on your local database');
      return;
    }

    console.log('✅ organization_subscriptions table structure:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check if subscription exists
    const subscription = await query('SELECT * FROM organization_subscriptions LIMIT 1');
    console.log(`\n📊 Found ${subscription.rows.length} subscription records`);

    if (subscription.rows.length > 0) {
      console.log('First subscription record:', subscription.rows[0]);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkTables();