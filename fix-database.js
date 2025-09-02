const { query } = require('./database/connection');

async function fixDatabase() {
  try {
    console.log('🔧 Fixing database schema...\n');
    
    // 1. Add missing columns to contacts table
    console.log('1️⃣ Adding missing columns to contacts table...');
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';`);
      console.log('✅ Added status column');
    } catch (error) {
      console.log('ℹ️ Status column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS software_edition VARCHAR(50);`);
      console.log('✅ Added software_edition column');
    } catch (error) {
      console.log('ℹ️ Software_edition column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source VARCHAR(100);`);
      console.log('✅ Added lead_source column');
    } catch (error) {
      console.log('ℹ️ Lead_source column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS conversion_date TIMESTAMP WITH TIME ZONE;`);
      console.log('✅ Added conversion_date column');
    } catch (error) {
      console.log('ℹ️ Conversion_date column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'customer';`);
      console.log('✅ Added type column');
    } catch (error) {
      console.log('ℹ️ Type column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS source VARCHAR(100);`);
      console.log('✅ Added source column');
    } catch (error) {
      console.log('ℹ️ Source column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS value DECIMAL(12,2) DEFAULT 0;`);
      console.log('✅ Added value column');
    } catch (error) {
      console.log('ℹ️ Value column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';`);
      console.log('✅ Added priority column');
    } catch (error) {
      console.log('ℹ️ Priority column might already exist');
    }
    
    try {
      await query(`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS converted_from_lead_id UUID;`);
      console.log('✅ Added converted_from_lead_id column');
    } catch (error) {
      console.log('ℹ️ Converted_from_lead_id column might already exist');
    }
    
    // 2. Create leads table
    console.log('\n2️⃣ Creating leads table...');
    
    const createLeadsTable = `
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20),
        company VARCHAR(200),
        title VARCHAR(100),
        status VARCHAR(50) DEFAULT 'new',
        priority VARCHAR(20) DEFAULT 'medium',
        value DECIMAL(12,2) DEFAULT 0,
        source VARCHAR(100),
        assigned_to UUID REFERENCES users(id),
        next_follow_up TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await query(createLeadsTable);
    console.log('✅ Leads table created');
    
    // 3. Create indexes for better performance
    console.log('\n3️⃣ Creating indexes...');
    
    try {
      await query(`CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);`);
      await query(`CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);`);
      console.log('✅ Indexes created');
    } catch (error) {
      console.log('ℹ️ Some indexes might already exist');
    }
    
    // 4. Update existing contacts to have default status
    console.log('\n4️⃣ Updating existing contacts...');
    
    const updateResult = await query(`UPDATE contacts SET status = 'active' WHERE status IS NULL;`);
    console.log(`✅ Updated ${updateResult.rowCount} contacts with default status`);
    
    console.log('\n🎉 Database schema fixed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Added missing columns to contacts table');
    console.log('✅ Created leads table with all required fields');
    console.log('✅ Created performance indexes');
    console.log('✅ Updated existing data');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing database:', error.message);
    process.exit(1);
  }
}

fixDatabase();