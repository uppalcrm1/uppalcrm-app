-- ============================================================================
-- ROLLBACK SCRIPT - Restore deleted foreign keys and tables
-- ============================================================================
-- Use this if cleanup fails or you need to undo changes
-- Execute this script to restore the software_licenses schema

BEGIN;

-- Step 1: Recreate license_transfers table
CREATE TABLE IF NOT EXISTS license_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    software_license_id UUID NOT NULL REFERENCES software_licenses(id) ON DELETE CASCADE,
    from_device_id UUID REFERENCES device_registrations(id),
    to_device_id UUID REFERENCES device_registrations(id),
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_license_transfers_org ON license_transfers(organization_id);
CREATE INDEX IF NOT EXISTS idx_license_transfers_license_id ON license_transfers(software_license_id);

-- Step 2: Recreate downloads_activations table
CREATE TABLE IF NOT EXISTS downloads_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    software_license_id UUID REFERENCES software_licenses(id) ON DELETE CASCADE,
    download_token VARCHAR(255) UNIQUE NOT NULL,
    download_date TIMESTAMP,
    activation_date TIMESTAMP,
    device_mac_address VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_downloads_activations_org ON downloads_activations(organization_id);
CREATE INDEX IF NOT EXISTS idx_downloads_activations_license_id ON downloads_activations(software_license_id);
CREATE INDEX IF NOT EXISTS idx_downloads_activations_token ON downloads_activations(download_token);

-- Step 3: Restore foreign key for trials table
ALTER TABLE trials
ADD CONSTRAINT fk_trials_converted_license
FOREIGN KEY (converted_license_id) REFERENCES software_licenses(id) ON DELETE SET NULL;

COMMIT;

-- Verify restoration
SELECT
  'Foreign keys restored' as status,
  COUNT(*) as count
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
AND table_name IN ('downloads_activations', 'license_transfers', 'trials');
