#!/usr/bin/env node

/**
 * Apply Products Table Migration
 *
 * Creates the products table and seeds initial products
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/connection');

async function applyMigration() {
  try {
    console.log('🚀 Applying products table migration...\n');

    const migrationPath = path.join(__dirname, '..', 'database', 'products-table-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running migration: products-table-migration.sql');
    console.log('='.repeat(60));

    await db.query(migrationSQL);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📊 What changed:');
    console.log('  ✓ products table created');
    console.log('  ✓ product_id column added to accounts table');
    console.log('  ✓ accounts.edition made nullable');
    console.log('  ✓ Indexes created for performance');
    console.log('  ✓ Row Level Security enabled');
    console.log('  ✓ RLS policy created for tenant isolation');
    console.log('  ✓ Triggers created (updated_at, single default)');
    console.log('  ✓ Initial products seeded for all organizations');

    // Verify products were created
    const verifyQuery = `
      SELECT
        o.name as organization_name,
        COUNT(p.id) as product_count
      FROM organizations o
      LEFT JOIN products p ON p.organization_id = o.id
      GROUP BY o.id, o.name
      ORDER BY o.name;
    `;

    const result = await db.query(verifyQuery);
    console.log('\n✅ Verification - Products per organization:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.organization_name}: ${row.product_count} products`);
    });

    console.log('\n🎉 Product catalog system is ready!');
    console.log('   Products: Standard ($49), Gold ($99), Jio ($149), Smart ($199)');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.detail) console.error('Detail:', error.detail);
    if (error.hint) console.error('Hint:', error.hint);
    process.exit(1);
  }
}

applyMigration();
