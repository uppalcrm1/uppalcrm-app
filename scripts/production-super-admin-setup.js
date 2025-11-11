#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// This script runs in production environment with production DB credentials
console.log('🚀 Running super admin setup in production environment...');

// Use production database connection
const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password'
});

async function setupSuperAdmin() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Applying super admin migration in production...');
    console.log('🌍 Environment:', process.env.NODE_ENV);
    
    // Check if table already exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'super_admin_users'
      );
    `);
    
    const superAdminExists = tableCheck.rows[0].exists;
    if (superAdminExists) {
      console.log('✅ Super admin tables already exist, skipping creation');
    } else {
      // Create minimal super admin tables without complex dependencies
      console.log('🔧 Creating super admin tables...');

      // Create super admin users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS super_admin_users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) DEFAULT 'super_admin',
        permissions JSONB DEFAULT '["all"]',
        is_active BOOLEAN DEFAULT true,
        last_login TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Create other essential super admin tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS super_admin_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE CASCADE,
        token_hash VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS platform_metrics (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        metric_date DATE NOT NULL UNIQUE,
        total_organizations INTEGER DEFAULT 0,
        active_organizations INTEGER DEFAULT 0,
        trial_organizations INTEGER DEFAULT 0,
        paid_organizations INTEGER DEFAULT 0,
        new_signups INTEGER DEFAULT 0,
        trial_conversions INTEGER DEFAULT 0,
        churn_count INTEGER DEFAULT 0,
        total_revenue DECIMAL(12,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE TABLE IF NOT EXISTS organization_notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        organization_id UUID NOT NULL,
        admin_id UUID NOT NULL REFERENCES super_admin_users(id) ON DELETE SET NULL,
        note_text TEXT NOT NULL,
        note_type VARCHAR(50) DEFAULT 'general',
        is_internal BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    console.log('✅ Super admin tables created');
    
    console.log('✅ Super admin migration applied successfully');
    
    // Verify and create super admin user if needed
    const userCheck = await client.query(
      'SELECT * FROM super_admin_users WHERE email = $1',
      ['admin@yourcrm.com']
    );
    
    if (userCheck.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await client.query(`
        INSERT INTO super_admin_users (email, password_hash, first_name, last_name)
        VALUES ($1, $2, 'Super', 'Admin')
      `, ['admin@yourcrm.com', hashedPassword]);
      
      console.log('👑 Super admin user created successfully');
    } else {
      console.log('✅ Super admin user already exists');
    }
    
    // Add trial columns to organizations table if they don't exist
    console.log('🔧 Ensuring trial columns exist...');
    
    const columnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'organizations' 
      AND column_name IN ('trial_status', 'trial_started_at', 'trial_ends_at', 'payment_status')
    `);
    
    const existingColumns = columnCheck.rows.map(row => row.column_name);
    
    const columnsToAdd = [
      { name: 'trial_status', type: 'VARCHAR(50)', default: "'no_trial'" },
      { name: 'trial_started_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'NULL' },
      { name: 'trial_ends_at', type: 'TIMESTAMP WITH TIME ZONE', default: 'NULL' },
      { name: 'payment_status', type: 'VARCHAR(50)', default: "'trial'" }
    ];
    
    for (const column of columnsToAdd) {
      if (!existingColumns.includes(column.name)) {
        console.log(`➕ Adding column: ${column.name}`);
        await client.query(`
          ALTER TABLE organizations 
          ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default};
        `);
      }
    }
    
    // Add some sample trial data to existing organizations
    const orgCount = await client.query('SELECT COUNT(*) FROM organizations WHERE trial_status = \'no_trial\' OR trial_status IS NULL');
    if (parseInt(orgCount.rows[0].count) > 0) {
      console.log('🎯 Adding sample trial data...');
      
      // Set some orgs as active trials
      await client.query(`
        UPDATE organizations 
        SET 
          trial_status = 'active',
          trial_started_at = CURRENT_DATE - INTERVAL '7 days',
          trial_ends_at = CURRENT_DATE + INTERVAL '14 days',
          payment_status = 'trial'
        WHERE id IN (
          SELECT id FROM organizations 
          WHERE trial_status = 'no_trial' OR trial_status IS NULL
          ORDER BY created_at DESC 
          LIMIT 5
        );
      `);
      
      // Set some as paid customers
      await client.query(`
        UPDATE organizations 
        SET 
          trial_status = 'converted',
          payment_status = 'paid'
        WHERE id IN (
          SELECT id FROM organizations 
          WHERE trial_status = 'no_trial' OR trial_status IS NULL
          ORDER BY RANDOM()
          LIMIT 2
        );
      `);
    }

    console.log('✅ Trial columns setup complete');
    } // End of superAdminExists else block

    // Create contacts and accounts tables if they don't exist (runs every time)
    console.log('🔧 Creating contacts and accounts tables...');
    try {
      // Contacts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS contacts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            company VARCHAR(255),
            title VARCHAR(100),
            address_line1 VARCHAR(255),
            address_line2 VARCHAR(255),
            city VARCHAR(100),
            state VARCHAR(100),
            postal_code VARCHAR(20),
            country VARCHAR(100),
            contact_type VARCHAR(50) DEFAULT 'customer',
            status VARCHAR(50) DEFAULT 'active',
            converted_from_lead_id UUID,
            source VARCHAR(100),
            notes TEXT,
            custom_fields JSONB DEFAULT '{}',
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_contact_date TIMESTAMP WITH TIME ZONE,
            UNIQUE(organization_id, email)
        );
      `);

      // Accounts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS accounts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            account_name VARCHAR(255) NOT NULL,
            account_type VARCHAR(50) DEFAULT 'trial',
            edition VARCHAR(100),
            device_name VARCHAR(255),
            mac_address VARCHAR(17),
            device_registered_at TIMESTAMP WITH TIME ZONE,
            license_key VARCHAR(255),
            license_status VARCHAR(50) DEFAULT 'pending',
            billing_cycle VARCHAR(50),
            price DECIMAL(12,2) DEFAULT 0,
            currency VARCHAR(10) DEFAULT 'USD',
            is_trial BOOLEAN DEFAULT false,
            trial_start_date TIMESTAMP WITH TIME ZONE,
            trial_end_date TIMESTAMP WITH TIME ZONE,
            subscription_start_date TIMESTAMP WITH TIME ZONE,
            subscription_end_date TIMESTAMP WITH TIME ZONE,
            next_renewal_date TIMESTAMP WITH TIME ZONE,
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            notes TEXT,
            custom_fields JSONB DEFAULT '{}'
        );
      `);

      // Lead-contact relationships table
      await client.query(`
        CREATE TABLE IF NOT EXISTS lead_contact_relationships (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            relationship_type VARCHAR(50) NOT NULL,
            interest_type VARCHAR(50),
            relationship_context TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_by UUID REFERENCES users(id),
            UNIQUE(lead_id, contact_id)
        );
      `);

      // Update leads table with new columns
      await client.query(`
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS linked_contact_id UUID REFERENCES contacts(id);
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(50);
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS interest_type VARCHAR(50);
        ALTER TABLE leads ADD COLUMN IF NOT EXISTS converted_date TIMESTAMP WITH TIME ZONE;
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
        CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
        CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at);
        CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
        CREATE INDEX IF NOT EXISTS idx_contacts_converted_from_lead ON contacts(converted_from_lead_id);

        CREATE INDEX IF NOT EXISTS idx_accounts_organization_id ON accounts(organization_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_contact_id ON accounts(contact_id);
        CREATE INDEX IF NOT EXISTS idx_accounts_mac_address ON accounts(mac_address);
        CREATE INDEX IF NOT EXISTS idx_accounts_license_status ON accounts(license_status);
        CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON accounts(account_type);
        CREATE INDEX IF NOT EXISTS idx_accounts_next_renewal_date ON accounts(next_renewal_date);

        CREATE INDEX IF NOT EXISTS idx_lead_contact_rel_lead_id ON lead_contact_relationships(lead_id);
        CREATE INDEX IF NOT EXISTS idx_lead_contact_rel_contact_id ON lead_contact_relationships(contact_id);
      `);

      // Enable RLS
      await client.query(`
        ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
        ALTER TABLE lead_contact_relationships ENABLE ROW LEVEL SECURITY;
      `);

      // Create RLS policies
      await client.query(`
        DROP POLICY IF EXISTS contact_isolation ON contacts;
        CREATE POLICY contact_isolation ON contacts
            FOR ALL
            TO PUBLIC
            USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

        DROP POLICY IF EXISTS account_isolation ON accounts;
        CREATE POLICY account_isolation ON accounts
            FOR ALL
            TO PUBLIC
            USING (organization_id = current_setting('app.current_organization_id', true)::uuid);

        DROP POLICY IF EXISTS lead_contact_rel_isolation ON lead_contact_relationships;
        CREATE POLICY lead_contact_rel_isolation ON lead_contact_relationships
            FOR ALL
            TO PUBLIC
            USING (
                EXISTS (
                    SELECT 1 FROM leads l
                    WHERE l.id = lead_contact_relationships.lead_id
                    AND l.organization_id = current_setting('app.current_organization_id', true)::uuid
                )
            );
      `);

      // Create triggers
      await client.query(`
        DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
        CREATE TRIGGER update_contacts_updated_at
            BEFORE UPDATE ON contacts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();

        DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
        CREATE TRIGGER update_accounts_updated_at
            BEFORE UPDATE ON accounts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
      `);

      console.log('✅ Contacts and accounts tables created');
    } catch (tableError) {
      console.log('⚠️  Contacts and accounts tables setup error:', tableError.message);
    }

    // Create lead tracking tables if they don't exist (runs every time)
    console.log('🔧 Creating lead tracking tables...');
    try {
      // Lead change history table
      await client.query(`
        CREATE TABLE IF NOT EXISTS lead_change_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            organization_id UUID NOT NULL,
            lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            changed_by UUID NOT NULL REFERENCES users(id),
            field_name VARCHAR(100) NOT NULL,
            old_value TEXT,
            new_value TEXT,
            change_type VARCHAR(50) DEFAULT 'field_update',
            change_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Lead status history table
      await client.query(`
        CREATE TABLE IF NOT EXISTS lead_status_history (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            organization_id UUID NOT NULL,
            lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
            from_status VARCHAR(50),
            to_status VARCHAR(50) NOT NULL,
            changed_by UUID NOT NULL REFERENCES users(id),
            change_reason TEXT,
            duration_in_previous_status INTERVAL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      // Create indexes
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_lead_change_history_lead ON lead_change_history(lead_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_lead_change_history_user ON lead_change_history(changed_by);
        CREATE INDEX IF NOT EXISTS idx_lead_change_history_org ON lead_change_history(organization_id);
        CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON lead_status_history(lead_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_lead_status_history_status ON lead_status_history(to_status);
        CREATE INDEX IF NOT EXISTS idx_lead_status_history_org ON lead_status_history(organization_id);
      `);

      console.log('✅ Lead tracking tables created');
    } catch (tableError) {
      console.log('⚠️  Lead tracking tables setup error:', tableError.message);
    }

    // Fix lead trigger column names
    console.log('🔧 Fixing lead trigger column names...');
    try {
      await client.query(`
        CREATE OR REPLACE FUNCTION track_lead_changes()
        RETURNS TRIGGER AS $$
        DECLARE
            user_id UUID;
        BEGIN
            -- Get the user_id from the current session or a default
            SELECT COALESCE(current_setting('app.current_user_id', true)::UUID, NEW.assigned_to) INTO user_id;

            -- Track status changes specifically
            IF OLD.status IS DISTINCT FROM NEW.status THEN
                INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value, change_type)
                VALUES (NEW.organization_id, NEW.id, user_id, 'status', OLD.status, NEW.status, 'status_change');

                INSERT INTO lead_status_history (organization_id, lead_id, from_status, to_status, changed_by)
                VALUES (NEW.organization_id, NEW.id, OLD.status, NEW.status, user_id);
            END IF;

            -- Track assignment changes
            IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
                INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value, change_type)
                VALUES (NEW.organization_id, NEW.id, user_id, 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT, 'assignment');
            END IF;

            -- Track field changes (FIXED: use correct column names - value and source, not lead_value and lead_source)
            IF OLD.value IS DISTINCT FROM NEW.value THEN
                INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
                VALUES (NEW.organization_id, NEW.id, user_id, 'value', OLD.value::TEXT, NEW.value::TEXT);
            END IF;

            IF OLD.priority IS DISTINCT FROM NEW.priority THEN
                INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
                VALUES (NEW.organization_id, NEW.id, user_id, 'priority', OLD.priority, NEW.priority);
            END IF;

            IF OLD.source IS DISTINCT FROM NEW.source THEN
                INSERT INTO lead_change_history (organization_id, lead_id, changed_by, field_name, old_value, new_value)
                VALUES (NEW.organization_id, NEW.id, user_id, 'source', OLD.source, NEW.source);
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      console.log('✅ Lead trigger fixed (value and source columns)');
    } catch (triggerError) {
      console.log('⚠️  Lead trigger fix skipped (may not exist yet):', triggerError.message);
    }

    // Add custom_fields column to leads table if it doesn't exist
    console.log('🔧 Adding custom_fields column to leads table...');
    try {
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'leads'
            AND column_name = 'custom_fields'
          ) THEN
            ALTER TABLE leads ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
            CREATE INDEX IF NOT EXISTS idx_leads_custom_fields ON leads USING gin(custom_fields);
            RAISE NOTICE 'Added custom_fields column to leads table';
          ELSE
            RAISE NOTICE 'custom_fields column already exists in leads table';
          END IF;
        END $$;
      `);
      console.log('✅ Custom fields column ensured in leads table');
    } catch (customFieldsError) {
      console.log('⚠️  Custom fields column setup error:', customFieldsError.message);
    }

    console.log('🎉 Production super admin setup complete!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupSuperAdmin().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});