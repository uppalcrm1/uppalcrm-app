const { Pool } = require('pg');

// PRODUCTION DATABASE URL - Update this before running
const PRODUCTION_DB_URL = process.env.PRODUCTION_DATABASE_URL || 'REPLACE_WITH_PRODUCTION_DB_URL';

const pool = new Pool({
  connectionString: PRODUCTION_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function deployToProduction() {
  const client = await pool.connect();
  try {
    console.log('🚀 PRODUCTION DEPLOYMENT: Source Field Standardization');
    console.log('================================================\n');

    // Step 1: Check current state
    console.log('Step 1: Checking current source field configuration...\n');
    const currentState = await client.query(`
      SELECT
        organization_id,
        field_name,
        field_label,
        entity_type,
        field_options,
        is_enabled
      FROM custom_field_definitions
      WHERE field_name = 'source'
    `);

    console.log(`Found ${currentState.rows.length} source field(s):\n`);
    currentState.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. Organization: ${row.organization_id.substring(0, 8)}...`);
      console.log(`     Entity Type: ${row.entity_type || 'NULL (universal)'}`);
      console.log(`     Enabled: ${row.is_enabled}`);
      console.log(`     Options: ${row.field_options ? row.field_options.length : 0} options\n`);
    });

    // Step 2: Update entity_type to NULL
    console.log('Step 2: Setting entity_type to NULL (universal field)...\n');

    const updateResult = await client.query(`
      UPDATE custom_field_definitions
      SET entity_type = NULL,
          updated_at = NOW()
      WHERE field_name = 'source'
        AND entity_type IS NOT NULL
      RETURNING organization_id, field_name, entity_type;
    `);

    if (updateResult.rows.length > 0) {
      console.log(`✅ Updated ${updateResult.rows.length} source field(s) to universal (entity_type = NULL)\n`);
    } else {
      console.log('ℹ️  Source field already set to universal (entity_type = NULL)\n');
    }

    // Step 3: Verify final state
    console.log('Step 3: Verifying final state...\n');
    const finalState = await client.query(`
      SELECT
        organization_id,
        field_name,
        field_label,
        entity_type,
        is_enabled,
        jsonb_array_length(field_options) as option_count
      FROM custom_field_definitions
      WHERE field_name = 'source'
    `);

    console.log('Final state:');
    console.table(finalState.rows.map(row => ({
      organization: row.organization_id.substring(0, 12) + '...',
      field: row.field_name,
      entity_type: row.entity_type || 'NULL (universal)',
      enabled: row.is_enabled,
      options: row.option_count
    })));

    console.log('\n✅ PRODUCTION DEPLOYMENT SUCCESSFUL!');
    console.log('\nNext steps:');
    console.log('1. Deploy backend code changes to production');
    console.log('2. Deploy frontend code changes to production');
    console.log('3. Test source field in Leads, Contacts, and Transactions');
    console.log('4. Verify Field Configuration page works correctly\n');

  } catch (error) {
    console.error('\n❌ DEPLOYMENT FAILED:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

deployToProduction().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
