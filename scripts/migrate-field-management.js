const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function migrateFieldManagement() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Creating custom field definitions table...');

    // Custom field definitions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_field_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        field_name VARCHAR(50) NOT NULL,
        field_label VARCHAR(100) NOT NULL,
        field_type VARCHAR(20) NOT NULL CHECK (field_type IN ('text', 'select', 'number', 'date', 'email', 'tel', 'textarea')),
        field_options JSONB,
        is_required BOOLEAN DEFAULT FALSE,
        is_enabled BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_by UUID REFERENCES users(id),

        UNIQUE(organization_id, field_name),
        CONSTRAINT field_name_length CHECK (length(field_name) <= 50),
        CONSTRAINT field_label_length CHECK (length(field_label) <= 100)
      );
    `);

    console.log('Creating default field configurations table...');

    // Default field configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS default_field_configurations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        field_name VARCHAR(50) NOT NULL,
        is_enabled BOOLEAN DEFAULT TRUE,
        is_required BOOLEAN DEFAULT FALSE,
        sort_order INTEGER DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        UNIQUE(organization_id, field_name)
      );
    `);

    console.log('Creating organization usage tracking table...');

    // Organization usage tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS organization_usage (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        custom_fields_count INTEGER DEFAULT 0,
        contacts_count INTEGER DEFAULT 0,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        UNIQUE(organization_id)
      );
    `);

    console.log('Adding custom fields column to leads table...');

    // Add custom fields to leads table
    await client.query(`
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';
    `);

    console.log('Creating indexes...');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_custom_fields_org_id ON custom_field_definitions(organization_id);
      CREATE INDEX IF NOT EXISTS idx_custom_fields_enabled ON custom_field_definitions(organization_id, is_enabled);
      CREATE INDEX IF NOT EXISTS idx_default_fields_org_id ON default_field_configurations(organization_id);
      CREATE INDEX IF NOT EXISTS idx_leads_custom_fields ON leads USING GIN (custom_fields);
    `);

    console.log('Enabling Row Level Security...');

    // Enable RLS
    await client.query(`
      ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE default_field_configurations ENABLE ROW LEVEL SECURITY;
      ALTER TABLE organization_usage ENABLE ROW LEVEL SECURITY;
    `);

    console.log('Creating RLS policies...');

    // Create RLS policies
    await client.query(`
      DROP POLICY IF EXISTS custom_fields_isolation ON custom_field_definitions;
      CREATE POLICY custom_fields_isolation ON custom_field_definitions
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);

    await client.query(`
      DROP POLICY IF EXISTS default_fields_isolation ON default_field_configurations;
      CREATE POLICY default_fields_isolation ON default_field_configurations
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);

    await client.query(`
      DROP POLICY IF EXISTS usage_isolation ON organization_usage;
      CREATE POLICY usage_isolation ON organization_usage
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);

    console.log('Creating trigger functions...');

    // Function to update custom field count
    await client.query(`
      CREATE OR REPLACE FUNCTION update_custom_field_count()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO organization_usage (organization_id, custom_fields_count, last_updated)
          VALUES (NEW.organization_id, 1, NOW())
          ON CONFLICT (organization_id)
          DO UPDATE SET
            custom_fields_count = organization_usage.custom_fields_count + 1,
            last_updated = NOW();
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          UPDATE organization_usage
          SET custom_fields_count = GREATEST(custom_fields_count - 1, 0),
              last_updated = NOW()
          WHERE organization_id = OLD.organization_id;
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Function to check field limits
    await client.query(`
      CREATE OR REPLACE FUNCTION check_custom_field_limit()
      RETURNS TRIGGER AS $$
      DECLARE
        current_count INTEGER;
        max_fields INTEGER := 15;
      BEGIN
        SELECT COALESCE(custom_fields_count, 0) INTO current_count
        FROM organization_usage
        WHERE organization_id = NEW.organization_id;

        IF current_count >= max_fields THEN
          RAISE EXCEPTION 'Custom field limit exceeded. Maximum % fields allowed.', max_fields;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('Creating triggers...');

    // Create triggers
    await client.query(`
      DROP TRIGGER IF EXISTS custom_field_count_trigger ON custom_field_definitions;
      CREATE TRIGGER custom_field_count_trigger
        AFTER INSERT OR DELETE ON custom_field_definitions
        FOR EACH ROW EXECUTE FUNCTION update_custom_field_count();
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS check_field_limit_trigger ON custom_field_definitions;
      CREATE TRIGGER check_field_limit_trigger
        BEFORE INSERT ON custom_field_definitions
        FOR EACH ROW EXECUTE FUNCTION check_custom_field_limit();
    `);

    console.log('Field management migration completed successfully!');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateFieldManagement()
    .then(() => {
      console.log('Migration completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = migrateFieldManagement;