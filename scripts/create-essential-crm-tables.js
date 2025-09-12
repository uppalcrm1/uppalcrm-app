const { query } = require('../database/connection');

async function createEssentialCRMTables() {
  console.log('🚀 Creating essential CRM tables...');
  
  try {
    // Create leads table
    console.log('📝 Creating leads table...');
    await query(`
      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        title VARCHAR(255),
        company VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(255),
        phone VARCHAR(50),
        source VARCHAR(100) DEFAULT 'manual',
        status VARCHAR(50) DEFAULT 'new',
        priority VARCHAR(20) DEFAULT 'medium',
        value DECIMAL(10,2) DEFAULT 0,
        notes TEXT,
        assigned_to UUID REFERENCES users(id),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_contact_date TIMESTAMP WITH TIME ZONE,
        next_follow_up TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log('✅ Leads table created');

    // Create contacts table
    console.log('📝 Creating contacts table...');
    await query(`
      CREATE TABLE IF NOT EXISTS contacts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        company VARCHAR(255),
        position VARCHAR(255),
        notes TEXT,
        tags TEXT[],
        created_by UUID REFERENCES users(id),
        assigned_to UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_contact_date TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log('✅ Contacts table created');

    // Create indexes for performance
    console.log('📝 Creating indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_leads_organization_id ON leads(organization_id);
      CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
      CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
    `);
    console.log('✅ Indexes created');

    // Check table creation
    const tablesCheck = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('leads', 'contacts')
      ORDER BY table_name
    `);
    
    console.log('📊 Tables created:', tablesCheck.rows.map(r => r.table_name));
    console.log('🎉 Essential CRM tables setup complete!');
    
  } catch (error) {
    console.error('❌ Error creating CRM tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createEssentialCRMTables()
    .then(() => {
      console.log('Migration complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createEssentialCRMTables };