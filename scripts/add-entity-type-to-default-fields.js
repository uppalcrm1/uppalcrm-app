const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addEntityTypeColumn() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Adding entity_type column to default_field_configurations...');

    // Add entity_type column
    await client.query(`
      ALTER TABLE default_field_configurations
      ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) DEFAULT 'leads';
    `);

    console.log('Updating existing records to have entity_type = leads...');

    // Update existing records to use 'leads' as default
    await client.query(`
      UPDATE default_field_configurations
      SET entity_type = 'leads'
      WHERE entity_type IS NULL;
    `);

    console.log('Making entity_type NOT NULL...');

    // Make it NOT NULL now that all records have a value
    await client.query(`
      ALTER TABLE default_field_configurations
      ALTER COLUMN entity_type SET NOT NULL;
    `);

    console.log('Dropping old unique constraint...');

    // Drop the old unique constraint
    await client.query(`
      ALTER TABLE default_field_configurations
      DROP CONSTRAINT IF EXISTS default_field_configurations_organization_id_field_name_key;
    `);

    console.log('Adding new unique constraint with entity_type...');

    // Add new unique constraint including entity_type
    await client.query(`
      ALTER TABLE default_field_configurations
      ADD CONSTRAINT default_field_configurations_org_field_entity_unique
      UNIQUE (organization_id, field_name, entity_type);
    `);

    console.log('Adding field_options column if it doesn\'t exist...');

    // Add field_options column if it doesn't exist (for storing custom options)
    await client.query(`
      ALTER TABLE default_field_configurations
      ADD COLUMN IF NOT EXISTS field_options JSONB;
    `);

    console.log('Creating index on entity_type...');

    // Create index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_default_fields_entity_type
      ON default_field_configurations(organization_id, entity_type);
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addEntityTypeColumn().catch(console.error);
