require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runProductionLicensingMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to production database');
    
    // Check if tables already exist
    const existingTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('organization_licenses', 'license_usage_history', 'billing_events')
    `);
    
    if (existingTables.rows.length > 0) {
      console.log('⚠️  Some licensing tables already exist:', existingTables.rows.map(r => r.table_name));
      console.log('Skipping table creation, checking for missing columns...');
      
      // Check if columns exist in organizations table
      const orgColumns = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'organizations'
        AND column_name IN ('purchased_licenses', 'license_price_per_user', 'billing_cycle')
      `);
      
      if (orgColumns.rows.length === 0) {
        console.log('🔄 Adding licensing columns to organizations table...');
        await client.query(`
          ALTER TABLE organizations 
          ADD COLUMN purchased_licenses INTEGER DEFAULT 5,
          ADD COLUMN license_price_per_user DECIMAL(10,2) DEFAULT 15.00,
          ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly',
          ADD COLUMN next_billing_date TIMESTAMP WITH TIME ZONE,
          ADD COLUMN auto_billing BOOLEAN DEFAULT false
        `);
        console.log('✅ Added licensing columns');
      }
      
      return;
    }
    
    console.log('🔄 Running full licensing migration...');
    
    // Step 1: Add licensing fields to organizations table
    console.log('🔄 Adding licensing columns to organizations table...');
    try {
      await client.query(`
        ALTER TABLE organizations 
        ADD COLUMN purchased_licenses INTEGER DEFAULT 5,
        ADD COLUMN license_price_per_user DECIMAL(10,2) DEFAULT 15.00,
        ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly',
        ADD COLUMN next_billing_date TIMESTAMP WITH TIME ZONE,
        ADD COLUMN auto_billing BOOLEAN DEFAULT false
      `);
      console.log('✅ Added licensing columns to organizations');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('⚠️  Licensing columns already exist in organizations table');
      } else {
        throw error;
      }
    }
    
    // Step 2: Create organization_licenses table
    console.log('🔄 Creating organization_licenses table...');
    await client.query(`
      CREATE TABLE organization_licenses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        license_type VARCHAR(50) DEFAULT 'user_seat',
        quantity INTEGER NOT NULL DEFAULT 1,
        price_per_license DECIMAL(10,2) NOT NULL DEFAULT 15.00,
        billing_cycle VARCHAR(20) DEFAULT 'monthly',
        status VARCHAR(20) DEFAULT 'active',
        purchased_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_billed_date TIMESTAMP WITH TIME ZONE,
        next_billing_date TIMESTAMP WITH TIME ZONE,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Created organization_licenses table');
    
    // Step 3: Create license_usage_history table
    console.log('🔄 Creating license_usage_history table...');
    await client.query(`
      CREATE TABLE license_usage_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        action VARCHAR(50) NOT NULL,
        previous_count INTEGER,
        new_count INTEGER,
        price_change DECIMAL(10,2),
        reason TEXT,
        performed_by UUID REFERENCES users(id),
        performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        effective_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('✅ Created license_usage_history table');
    
    // Step 4: Create billing_events table
    console.log('🔄 Creating billing_events table...');
    await client.query(`
      CREATE TABLE billing_events (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        billing_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
        billing_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
        licenses_count INTEGER NOT NULL,
        price_per_license DECIMAL(10,2) NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        billing_status VARCHAR(20) DEFAULT 'pending',
        payment_method TEXT,
        payment_reference TEXT,
        invoice_number VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        paid_at TIMESTAMP WITH TIME ZONE
      )
    `);
    console.log('✅ Created billing_events table');
    
    // Step 5: Create indexes
    console.log('🔄 Creating indexes...');
    await client.query(`
      CREATE INDEX idx_org_licenses_organization_id ON organization_licenses(organization_id);
      CREATE INDEX idx_license_history_organization_id ON license_usage_history(organization_id);
      CREATE INDEX idx_billing_events_organization_id ON billing_events(organization_id);
      CREATE INDEX idx_billing_events_status ON billing_events(billing_status);
    `);
    console.log('✅ Created indexes');
    
    // Step 6: Add constraints
    console.log('🔄 Adding constraints...');
    await client.query(`
      ALTER TABLE organization_licenses 
      ADD CONSTRAINT check_license_quantity CHECK (quantity > 0),
      ADD CONSTRAINT check_license_price CHECK (price_per_license >= 0);
      
      ALTER TABLE organizations 
      ADD CONSTRAINT check_purchased_licenses CHECK (purchased_licenses >= 0);
    `);
    console.log('✅ Added constraints');
    
    // Step 7: Enable RLS on new tables
    console.log('🔄 Setting up Row Level Security...');
    await client.query(`
      ALTER TABLE organization_licenses ENABLE ROW LEVEL SECURITY;
      ALTER TABLE license_usage_history ENABLE ROW LEVEL SECURITY;
      ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
    `);
    
    await client.query(`
      CREATE POLICY license_isolation ON organization_licenses
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
        
      CREATE POLICY license_history_isolation ON license_usage_history
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
        
      CREATE POLICY billing_events_isolation ON billing_events
        FOR ALL TO PUBLIC
        USING (organization_id = current_setting('app.current_organization_id')::uuid);
    `);
    console.log('✅ Set up Row Level Security');
    
    // Step 8: Initialize existing organizations with default licenses
    console.log('🔄 Initializing existing organizations with default licenses...');
    const result = await client.query(`
      INSERT INTO organization_licenses (organization_id, quantity, price_per_license, billing_cycle, status)
      SELECT 
        id as organization_id,
        COALESCE(purchased_licenses, 5) as quantity,
        15.00 as price_per_license,
        'monthly' as billing_cycle,
        'active' as status
      FROM organizations 
      WHERE NOT EXISTS (
        SELECT 1 FROM organization_licenses ol WHERE ol.organization_id = organizations.id
      )
    `);
    console.log(`✅ Initialized ${result.rowCount} organizations with default licenses`);
    
    console.log('\n🎉 Production licensing migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Production migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('✅ Database connection closed');
  }
}

// Run migration
console.log('🚀 Starting production licensing migration...');
console.log('Environment:', process.env.NODE_ENV);
runProductionLicensingMigration();