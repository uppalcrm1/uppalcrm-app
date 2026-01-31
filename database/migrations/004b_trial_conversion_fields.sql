-- Add trial conversion tracking fields to organizations table
-- This migration adds fields for tracking trial-to-paid conversions

-- Add conversion tracking fields
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS billing_notes TEXT;

-- Update existing payment_status to be more explicit
-- The payment_status field already exists from trial management, we just need to ensure consistency

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_converted_at ON organizations(converted_at);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_plan ON organizations(subscription_plan);

-- Create audit_logs table for tracking conversions
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB,
    performed_by VARCHAR(255),
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON audit_logs(performed_at);

-- Update organizations that are already paid to have converted_at
-- Only if the field was just created (this is safe to run multiple times)
UPDATE organizations 
SET converted_at = updated_at 
WHERE payment_status = 'active' 
  AND trial_status = 'converted' 
  AND converted_at IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN organizations.converted_at IS 'Timestamp when trial was converted to paid subscription';
COMMENT ON COLUMN organizations.billing_notes IS 'Notes about billing, payment method, or special terms';
COMMENT ON TABLE audit_logs IS 'Audit trail for administrative actions on organizations';