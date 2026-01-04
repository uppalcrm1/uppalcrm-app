const { Pool } = require('pg');

const PRODUCTION_DB_URL = process.env.PRODUCTION_DATABASE_URL;

const pool = new Pool({
  connectionString: PRODUCTION_DB_URL,
  ssl: { rejectUnauthorized: false }
});

async function prepareProduction() {
  const client = await pool.connect();
  try {
    console.log('🚀 Preparing PRODUCTION for universal fields');
    console.log('================================================\n');

    // Step 1: Check current constraint
    console.log('Step 1: Checking entity_type column constraints...\n');
    const constraintCheck = await client.query(`
      SELECT
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'custom_field_definitions'
        AND column_name = 'entity_type'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('Current entity_type column:');
      console.table(constraintCheck.rows);
      console.log('');
    }

    // Step 2: Alter column to allow NULL
    console.log('Step 2: Altering entity_type column to allow NULL...\n');
    await client.query(`
      ALTER TABLE custom_field_definitions
      ALTER COLUMN entity_type DROP NOT NULL
    `);
    console.log('  ✅ entity_type column now allows NULL values\n');

    // Step 3: Drop the CHECK constraint if it exists
    console.log('Step 3: Removing entity_type CHECK constraint if it exists...\n');
    await client.query(`
      ALTER TABLE custom_field_definitions
      DROP CONSTRAINT IF EXISTS valid_entity_type
    `);
    console.log('  ✅ CHECK constraint removed (if it existed)\n');

    // Step 4: Verify changes
    console.log('Step 4: Verifying changes...\n');
    const finalCheck = await client.query(`
      SELECT
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'custom_field_definitions'
        AND column_name = 'entity_type'
    `);

    console.log('Final entity_type column configuration:');
    console.table(finalCheck.rows);

    console.log('\n✅ PRODUCTION PREPARATION SUCCESSFUL!');
    console.log('\nThe database is now ready for universal fields (entity_type = NULL)\n');

  } catch (error) {
    console.error('\n❌ PREPARATION FAILED:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

prepareProduction().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
