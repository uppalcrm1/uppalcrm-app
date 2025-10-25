const { Pool } = require('pg');
require('dotenv').config();

// Use production DATABASE_URL from environment
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function addEntityTypeColumn() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration to add entity_type to default_field_configurations...');
    console.log('📍 Database:', process.env.DATABASE_URL ? '✅ Connected' : '❌ No DATABASE_URL');

    await client.query('BEGIN');

    console.log('1️⃣  Adding entity_type column...');
    await client.query(`
      ALTER TABLE default_field_configurations
      ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'leads';
    `);

    console.log('2️⃣  Updating existing records to have entity_type = leads...');
    await client.query(`
      UPDATE default_field_configurations
      SET entity_type = 'leads'
      WHERE entity_type IS NULL OR entity_type = '';
    `);

    console.log('3️⃣  Making entity_type NOT NULL...');
    await client.query(`
      ALTER TABLE default_field_configurations
      ALTER COLUMN entity_type SET NOT NULL;
    `);

    console.log('4️⃣  Dropping old unique constraint...');
    await client.query(`
      ALTER TABLE default_field_configurations
      DROP CONSTRAINT IF EXISTS default_field_configurations_organization_id_field_name_key;
    `);

    console.log('5️⃣  Adding new unique constraint with entity_type...');
    await client.query(`
      ALTER TABLE default_field_configurations
      ADD CONSTRAINT default_field_configurations_org_field_entity_unique
      UNIQUE (organization_id, field_name, entity_type);
    `);

    console.log('6️⃣  Adding field_options column if it doesn\'t exist...');
    await client.query(`
      ALTER TABLE default_field_configurations
      ADD COLUMN IF NOT EXISTS field_options JSONB;
    `);

    console.log('7️⃣  Creating index on entity_type...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_default_fields_entity_type
      ON default_field_configurations(organization_id, entity_type);
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');

    // Verify the changes
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'default_field_configurations'
      ORDER BY ordinal_position;
    `);

    console.log('\n📊 Table structure after migration:');
    console.table(result.rows);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addEntityTypeColumn().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
