#!/usr/bin/env node

const { query } = require('../database/connection');

async function renameOldSubscriptionTable() {
  try {
    console.log('🔄 Renaming old subscription table...');

    // Rename old table
    await query('ALTER TABLE organization_subscriptions RENAME TO organization_subscriptions_old');
    console.log('✅ Renamed old organization_subscriptions table to organization_subscriptions_old');

    // The new subscription system table should already exist from our earlier creation
    // Let's verify it exists
    const newTableCheck = await query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'subscription_organization_subscriptions'
    `);

    if (newTableCheck.rows.length > 0) {
      // Rename the new table to the correct name
      await query('ALTER TABLE subscription_organization_subscriptions RENAME TO organization_subscriptions');
      console.log('✅ Renamed subscription_organization_subscriptions to organization_subscriptions');
    }

    console.log('✅ Table renaming completed successfully!');

  } catch (error) {
    console.error('❌ Table renaming failed:', error.message);
  } finally {
    process.exit(0);
  }
}

renameOldSubscriptionTable();