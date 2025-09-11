-- License Compatibility Migration
-- Ensures backward compatibility for trial-to-paid conversion with license support
-- This migration adds missing columns and handles edge cases

-- Step 1: Add missing license columns to organizations table if they don't exist
DO $$ 
BEGIN
    -- Add purchased_licenses column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'purchased_licenses') THEN
        ALTER TABLE organizations ADD COLUMN purchased_licenses INTEGER DEFAULT 5;
        COMMENT ON COLUMN organizations.purchased_licenses IS 'Number of user licenses purchased for this organization';
    END IF;
    
    -- Add license_price_per_user column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'license_price_per_user') THEN
        ALTER TABLE organizations ADD COLUMN license_price_per_user DECIMAL(10,2) DEFAULT 15.00;
        COMMENT ON COLUMN organizations.license_price_per_user IS 'Price per user license in USD';
    END IF;
    
    -- Add billing_cycle column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_cycle') THEN
        ALTER TABLE organizations ADD COLUMN billing_cycle VARCHAR(20) DEFAULT 'monthly';
        COMMENT ON COLUMN organizations.billing_cycle IS 'Billing frequency: monthly, quarterly, annual';
    END IF;
    
    -- Add converted_at column for tracking trial conversions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'converted_at') THEN
        ALTER TABLE organizations ADD COLUMN converted_at TIMESTAMP WITH TIME ZONE;
        COMMENT ON COLUMN organizations.converted_at IS 'Timestamp when trial was converted to paid';
    END IF;
    
    -- Add billing_notes column for payment details
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'billing_notes') THEN
        ALTER TABLE organizations ADD COLUMN billing_notes TEXT;
        COMMENT ON COLUMN organizations.billing_notes IS 'Notes about billing, payment method, or special terms';
    END IF;
    
    -- Ensure payment_status column exists (might be from earlier migrations)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'payment_status') THEN
        ALTER TABLE organizations ADD COLUMN payment_status VARCHAR(20) DEFAULT 'trial';
        COMMENT ON COLUMN organizations.payment_status IS 'Payment status: trial, paid, overdue, cancelled';
    END IF;
END $$;

-- Step 2: Create audit_logs table if it doesn't exist (for conversion tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    performed_by VARCHAR(255),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for audit_logs if table was just created
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_organization') THEN
        CREATE INDEX idx_audit_logs_organization ON audit_logs(organization_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_action') THEN
        CREATE INDEX idx_audit_logs_action ON audit_logs(action);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_audit_logs_performed_at') THEN
        CREATE INDEX idx_audit_logs_performed_at ON audit_logs(performed_at);
    END IF;
END $$;

-- Step 3: Update existing organizations to have proper license defaults
UPDATE organizations 
SET 
    purchased_licenses = COALESCE(purchased_licenses, 5),
    license_price_per_user = COALESCE(license_price_per_user, 15.00),
    billing_cycle = COALESCE(billing_cycle, 'monthly'),
    payment_status = COALESCE(payment_status, 'trial')
WHERE 
    purchased_licenses IS NULL 
    OR license_price_per_user IS NULL 
    OR billing_cycle IS NULL 
    OR payment_status IS NULL;

-- Step 4: Add constraints for data integrity
DO $$
BEGIN
    -- Add constraint for purchased_licenses if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_purchased_licenses_positive') THEN
        ALTER TABLE organizations ADD CONSTRAINT check_purchased_licenses_positive CHECK (purchased_licenses >= 0);
    END IF;
    
    -- Add constraint for license_price_per_user if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_license_price_positive') THEN
        ALTER TABLE organizations ADD CONSTRAINT check_license_price_positive CHECK (license_price_per_user >= 0);
    END IF;
    
    -- Add constraint for billing_cycle values
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_billing_cycle_values') THEN
        ALTER TABLE organizations ADD CONSTRAINT check_billing_cycle_values CHECK (billing_cycle IN ('monthly', 'quarterly', 'annual'));
    END IF;
    
    -- Add constraint for payment_status values
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'check_payment_status_values') THEN
        ALTER TABLE organizations ADD CONSTRAINT check_payment_status_values CHECK (payment_status IN ('trial', 'paid', 'overdue', 'cancelled'));
    END IF;
END $$;

-- Step 5: Create a function to safely check if license tables exist
CREATE OR REPLACE FUNCTION license_tables_exist() RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name IN ('organization_licenses', 'license_usage_history', 'billing_events')
        AND table_schema = 'public'
    );
END;
$$ LANGUAGE plpgsql;

-- Step 6: Add indexes for performance on new license columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_organizations_payment_status') THEN
        CREATE INDEX idx_organizations_payment_status ON organizations(payment_status);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_organizations_converted_at') THEN
        CREATE INDEX idx_organizations_converted_at ON organizations(converted_at);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_organizations_billing_cycle') THEN
        CREATE INDEX idx_organizations_billing_cycle ON organizations(billing_cycle);
    END IF;
END $$;

-- Log migration completion
INSERT INTO audit_logs (organization_id, action, details, performed_by) 
VALUES (NULL, 'license_compatibility_migration', 
        '{"description": "Added license compatibility columns and constraints", "version": "006"}', 
        'system_migration');

COMMENT ON TABLE audit_logs IS 'Audit trail for administrative actions and system changes';