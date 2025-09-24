#!/usr/bin/env node

const { query } = require('../database/connection');

async function listSubscriptionTables() {
  try {
    console.log('🔍 Listing subscription-related tables...');

    const tables = await query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE '%subscription%' OR table_name LIKE '%plan%')
      ORDER BY table_name
    `);

    console.log(`✅ Found ${tables.rows.length} subscription-related tables:`);
    tables.rows.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

listSubscriptionTables();