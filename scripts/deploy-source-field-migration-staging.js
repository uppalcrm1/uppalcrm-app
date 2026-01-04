#!/usr/bin/env node

/**
 * Deploy Source Field Migration to Staging
 *
 * This script runs the source field migration on the staging database
 * Usage: node scripts/deploy-source-field-migration-staging.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Get database connection from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable not set');
  console.log('💡 Make sure DATABASE_URL is set in your environment');
  process.exit(1);
}

console.log('🚀 Starting Source Field Migration Deployment\n');
console.log('Database:', connectionString.split('@')[1]?.split('/')[0] || 'Unknown');
console.log('═'.repeat(70) + '\n');

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('📊 Step 1: Checking current state...\n');

    // Check current source field definitions
    const checkQuery = `
      SELECT entity_type, COUNT(*) as count
      FROM custom_field_definitions
      WHERE field_name = 'source'
      GROUP BY entity_type
      ORDER BY entity_type;
    `;

    const beforeState = await client.query(checkQuery);
    console.log('Before migration:');
    if (beforeState.rows.length > 0) {
      console.table(beforeState.rows);
    } else {
      console.log('  No source field definitions found\n');
    }

    console.log('🔧 Step 2: Running migration...\n');

    // Get all organizations
    const orgsResult = await client.query('SELECT id, name FROM organizations ORDER BY name');
    const organizations = orgsResult.rows;

    console.log(`Found ${organizations.length} organization(s)\n`);

    const entityTypes = ['leads', 'contacts', 'transactions', 'accounts'];
    let totalCreated = 0;
    let totalUpdated = 0;

    // Process each organization
    for (const org of organizations) {
      console.log(`Processing organization: ${org.name}`);

      // Process each entity type
      for (const entityType of entityTypes) {
        const insertQuery = `
          INSERT INTO custom_field_definitions (
              organization_id,
              field_name,
              field_label,
              field_description,
              entity_type,
              field_type,
              is_required,
              is_searchable,
              is_filterable,
              display_order,
              show_in_list_view,
              show_in_detail_view,
              show_in_create_form,
              show_in_edit_form,
              field_options,
              default_value,
              placeholder,
              field_group,
              is_active,
              is_enabled,
              created_at,
              updated_at
          )
          VALUES (
              $1,
              'source',
              'Source',
              'How this lead/contact/transaction/account was acquired',
              $2,
              'select',
              false,
              true,
              true,
              10,
              true,
              true,
              true,
              true,
              $3::jsonb,
              'website',
              'Select source',
              'Lead Information',
              true,
              true,
              NOW(),
              NOW()
          )
          ON CONFLICT (organization_id, entity_type, field_name) DO UPDATE
          SET
              field_label = EXCLUDED.field_label,
              field_description = EXCLUDED.field_description,
              field_type = EXCLUDED.field_type,
              field_options = EXCLUDED.field_options,
              is_active = true,
              is_enabled = true,
              updated_at = NOW()
          RETURNING id, (xmax = 0) as inserted;
        `;

        const fieldOptions = JSON.stringify([
          { value: 'website', label: 'Website' },
          { value: 'referral', label: 'Referral' },
          { value: 'social-media', label: 'Social Media' },
          { value: 'cold-call', label: 'Cold Call' },
          { value: 'email', label: 'Email' },
          { value: 'advertisement', label: 'Advertisement' },
          { value: 'trade-show', label: 'Trade Show' },
          { value: 'other', label: 'Other' }
        ]);

        const result = await client.query(insertQuery, [org.id, entityType, fieldOptions]);

        if (result.rows[0].inserted) {
          totalCreated++;
          console.log(`  ✅ Created source field for ${entityType}`);
        } else {
          totalUpdated++;
          console.log(`  🔄 Updated source field for ${entityType}`);
        }
      }
      console.log('');
    }

    // Add source column to accounts table if it doesn't exist
    console.log('🔧 Step 3: Adding source column to accounts table...\n');
    await client.query('ALTER TABLE accounts ADD COLUMN IF NOT EXISTS source VARCHAR(100)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_accounts_source ON accounts(source)');
    console.log('  ✅ Accounts table updated\n');

    console.log('📊 Step 4: Verifying migration...\n');

    // Check final state
    const afterState = await client.query(checkQuery);
    console.log('After migration:');
    console.table(afterState.rows);

    // Detailed verification per organization
    const verifyQuery = `
      SELECT
        o.name as organization,
        COUNT(DISTINCT cfd.entity_type) as entity_types_count,
        array_agg(DISTINCT cfd.entity_type ORDER BY cfd.entity_type) as entity_types
      FROM organizations o
      LEFT JOIN custom_field_definitions cfd ON cfd.organization_id = o.id AND cfd.field_name = 'source'
      GROUP BY o.id, o.name
      ORDER BY o.name;
    `;

    const verifyResult = await client.query(verifyQuery);
    console.log('\nPer organization verification:');
    console.table(verifyResult.rows);

    await client.query('COMMIT');

    console.log('\n═'.repeat(70));
    console.log('✅ Migration completed successfully!\n');
    console.log('Summary:');
    console.log(`  • Source fields created: ${totalCreated}`);
    console.log(`  • Source fields updated: ${totalUpdated}`);
    console.log(`  • Total organizations: ${organizations.length}`);
    console.log(`  • Expected total: ${organizations.length * 4} (4 entity types per org)`);
    console.log('\n💡 Next steps:');
    console.log('  1. Restart your backend to load the new configuration');
    console.log('  2. Test the Leads form - should now show consistent source options');
    console.log('  3. Verify in Field Configuration UI that you can edit source options\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
