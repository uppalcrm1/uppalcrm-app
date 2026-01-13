const { Pool } = require('pg');
require('dotenv').config();

// DevTest database connection
const devtestPool = new Pool({
  connectionString: process.env.DEVTEST_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function applyMigration024() {
  const client = await devtestPool.connect();
  
  try {
    console.log('🔄 Starting migration 024 for devtest database...\n');
    
    await client.query('BEGIN');
    
    // 1. Create field_mappings table
    console.log('📝 Creating field_mappings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS field_mappings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        source_entity_type VARCHAR(50) NOT NULL,
        target_entity_type VARCHAR(50) NOT NULL,
        source_field_name VARCHAR(100) NOT NULL,
        target_field_name VARCHAR(100) NOT NULL,
        transformation_rule VARCHAR(50),
        is_required BOOLEAN DEFAULT false,
        priority INTEGER DEFAULT 100,
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(organization_id, source_entity_type, target_entity_type, source_field_name, target_field_name)
      );
    `);
    console.log('✅ field_mappings table created\n');
    
    // 2. Create field_mapping_templates table
    console.log('📝 Creating field_mapping_templates table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS field_mapping_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
        template_name VARCHAR(100) NOT NULL,
        description TEXT,
        template_type VARCHAR(20) DEFAULT 'custom',
        is_system_template BOOLEAN DEFAULT false,
        icon VARCHAR(50),
        color VARCHAR(20),
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ field_mapping_templates table created\n');
    
    // 3. Create field_mapping_template_items table
    console.log('📝 Creating field_mapping_template_items table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS field_mapping_template_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        template_id UUID NOT NULL REFERENCES field_mapping_templates(id) ON DELETE CASCADE,
        source_entity_type VARCHAR(50) NOT NULL,
        target_entity_type VARCHAR(50) NOT NULL,
        applies_to_entity VARCHAR(50) NOT NULL,
        source_field_name VARCHAR(100) NOT NULL,
        target_field_name VARCHAR(100) NOT NULL,
        transformation_rule VARCHAR(50),
        is_required BOOLEAN DEFAULT false,
        priority INTEGER DEFAULT 100,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ field_mapping_template_items table created\n');
    
    // 4. Create conversion_field_history table
    console.log('📝 Creating conversion_field_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversion_field_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        lead_id UUID NOT NULL,
        contact_id UUID,
        account_id UUID,
        field_mapping_id UUID REFERENCES field_mappings(id) ON DELETE SET NULL,
        source_field_name VARCHAR(100) NOT NULL,
        target_field_name VARCHAR(100) NOT NULL,
        source_value TEXT,
        transformed_value TEXT,
        transformation_applied VARCHAR(50),
        conversion_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id)
      );
    `);
    console.log('✅ conversion_field_history table created\n');
    
    // 5. Create indexes
    console.log('📝 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_field_mappings_org 
        ON field_mappings(organization_id);
      
      CREATE INDEX IF NOT EXISTS idx_field_mappings_source_target 
        ON field_mappings(source_entity_type, target_entity_type);
      
      CREATE INDEX IF NOT EXISTS idx_field_mapping_templates_org 
        ON field_mapping_templates(organization_id);
      
      CREATE INDEX IF NOT EXISTS idx_field_mapping_template_items_template 
        ON field_mapping_template_items(template_id);
      
      CREATE INDEX IF NOT EXISTS idx_conversion_history_lead 
        ON conversion_field_history(lead_id);
      
      CREATE INDEX IF NOT EXISTS idx_conversion_history_org 
        ON conversion_field_history(organization_id);
    `);
    console.log('✅ Indexes created\n');
    
    // 6. Insert system templates
    console.log('📝 Inserting system templates...');
    
    // Full Conversion Template
    const fullTemplateResult = await client.query(`
      INSERT INTO field_mapping_templates (
        template_name, description, template_type, is_system_template, icon, color
      ) VALUES (
        'Full Lead Conversion',
        'Complete field mapping for lead to contact/account conversion',
        'system',
        true,
        '🔄',
        'blue'
      )
      ON CONFLICT DO NOTHING
      RETURNING id;
    `);
    
    if (fullTemplateResult.rows.length > 0) {
      const templateId = fullTemplateResult.rows[0].id;
      
      await client.query(`
        INSERT INTO field_mapping_template_items (
          template_id, source_entity_type, target_entity_type, applies_to_entity,
          source_field_name, target_field_name, priority
        ) VALUES
          ($1, 'lead', 'contact', 'contacts', 'first_name', 'first_name', 10),
          ($1, 'lead', 'contact', 'contacts', 'last_name', 'last_name', 20),
          ($1, 'lead', 'contact', 'contacts', 'email', 'email', 30),
          ($1, 'lead', 'contact', 'contacts', 'phone', 'phone', 40),
          ($1, 'lead', 'contact', 'contacts', 'company', 'company', 50),
          ($1, 'lead', 'account', 'accounts', 'company', 'account_name', 10),
          ($1, 'lead', 'account', 'accounts', 'phone', 'phone', 20),
          ($1, 'lead', 'account', 'accounts', 'email', 'email', 30)
        ON CONFLICT DO NOTHING;
      `, [templateId]);
      
      console.log('✅ Full Conversion template created\n');
    }
    
    await client.query('COMMIT');
    
    console.log('✅ Migration 024 completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ field_mappings table');
    console.log('   ✓ field_mapping_templates table');
    console.log('   ✓ field_mapping_template_items table');
    console.log('   ✓ conversion_field_history table');
    console.log('   ✓ Indexes');
    console.log('   ✓ System templates');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await devtestPool.end();
  }
}

// Run migration
applyMigration024()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
