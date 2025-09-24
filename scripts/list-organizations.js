#!/usr/bin/env node

const { query } = require('../database/connection');

async function listOrganizations() {
  try {
    console.log('🔍 Listing all organizations...');

    const result = await query('SELECT id, name FROM organizations ORDER BY name');

    if (result.rows.length === 0) {
      console.log('❌ No organizations found');
      return;
    }

    console.log(`✅ Found ${result.rows.length} organizations:`);
    result.rows.forEach(org => {
      console.log(`  - ${org.name} (${org.id})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

listOrganizations();