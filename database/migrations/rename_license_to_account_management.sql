-- =============================================
-- License Management to Account Management Migration
-- =============================================
-- This migration renames all license-related tables, columns, and references
-- to use account terminology instead for better sales team alignment

BEGIN;

-- =============================================
-- 1. RENAME MAIN TABLES
-- =============================================

-- Rename software_licenses to account_subscriptions
ALTER TABLE software_licenses RENAME TO account_subscriptions;

-- Rename license_transfers to account_transfers
ALTER TABLE license_transfers RENAME TO account_transfers;

-- Rename downloads_activations to account_downloads_activations
ALTER TABLE downloads_activations RENAME TO account_downloads_activations;

-- Rename billing_payments to account_billing_payments
ALTER TABLE billing_payments RENAME TO account_billing_payments;

-- Rename renewals_subscriptions to account_renewals
ALTER TABLE renewals_subscriptions RENAME TO account_renewals;

-- Rename renewal_alerts to account_alerts
ALTER TABLE renewal_alerts RENAME TO account_alerts;

-- =============================================
-- 2. UPDATE COLUMN REFERENCES
-- =============================================

-- Update foreign key column names in account_transfers
ALTER TABLE account_transfers RENAME COLUMN license_id TO account_subscription_id;

-- Update foreign key column names in account_downloads_activations
ALTER TABLE account_downloads_activations RENAME COLUMN license_id TO account_subscription_id;

-- Update foreign key column names in account_billing_payments
ALTER TABLE account_billing_payments RENAME COLUMN license_id TO account_subscription_id;

-- Update foreign key column names in account_renewals
ALTER TABLE account_renewals RENAME COLUMN license_id TO account_subscription_id;

-- Update foreign key column names in account_alerts
ALTER TABLE account_alerts RENAME COLUMN license_id TO account_subscription_id;

-- Update column names in account_subscriptions
ALTER TABLE account_subscriptions RENAME COLUMN license_key TO subscription_key;
ALTER TABLE account_subscriptions RENAME COLUMN license_type TO subscription_type;

-- Update trial conversion reference
ALTER TABLE account_subscriptions RENAME COLUMN converted_from_trial_id TO converted_from_trial_id;

-- Update trials table to reference new account_subscriptions
ALTER TABLE trials RENAME COLUMN converted_to_license_id TO converted_to_subscription_id;

-- =============================================
-- 3. UPDATE CONSTRAINTS AND INDEXES
-- =============================================

-- Drop existing foreign key constraints
ALTER TABLE account_transfers DROP CONSTRAINT IF EXISTS license_transfers_license_id_fkey;
ALTER TABLE account_downloads_activations DROP CONSTRAINT IF EXISTS downloads_activations_license_id_fkey;
ALTER TABLE account_billing_payments DROP CONSTRAINT IF EXISTS billing_payments_license_id_fkey;
ALTER TABLE account_renewals DROP CONSTRAINT IF EXISTS renewals_subscriptions_license_id_fkey;
ALTER TABLE account_alerts DROP CONSTRAINT IF EXISTS renewal_alerts_license_id_fkey;
ALTER TABLE trials DROP CONSTRAINT IF EXISTS trials_converted_to_license_id_fkey;

-- Add new foreign key constraints with updated names
ALTER TABLE account_transfers
ADD CONSTRAINT account_transfers_subscription_id_fkey
FOREIGN KEY (account_subscription_id) REFERENCES account_subscriptions(id) ON DELETE CASCADE;

ALTER TABLE account_downloads_activations
ADD CONSTRAINT account_downloads_activations_subscription_id_fkey
FOREIGN KEY (account_subscription_id) REFERENCES account_subscriptions(id) ON DELETE CASCADE;

ALTER TABLE account_billing_payments
ADD CONSTRAINT account_billing_payments_subscription_id_fkey
FOREIGN KEY (account_subscription_id) REFERENCES account_subscriptions(id) ON DELETE CASCADE;

ALTER TABLE account_renewals
ADD CONSTRAINT account_renewals_subscription_id_fkey
FOREIGN KEY (account_subscription_id) REFERENCES account_subscriptions(id) ON DELETE CASCADE;

ALTER TABLE account_alerts
ADD CONSTRAINT account_alerts_subscription_id_fkey
FOREIGN KEY (account_subscription_id) REFERENCES account_subscriptions(id) ON DELETE CASCADE;

ALTER TABLE trials
ADD CONSTRAINT trials_converted_to_subscription_id_fkey
FOREIGN KEY (converted_to_subscription_id) REFERENCES account_subscriptions(id);

-- =============================================
-- 4. RENAME INDEXES
-- =============================================

-- Drop old indexes and create new ones with updated names
DROP INDEX IF EXISTS idx_software_licenses_org_contact;
DROP INDEX IF EXISTS idx_software_licenses_device;
DROP INDEX IF EXISTS idx_software_licenses_status;
DROP INDEX IF EXISTS idx_software_licenses_expiry;
DROP INDEX IF EXISTS idx_software_licenses_key;

CREATE INDEX idx_account_subscriptions_org_contact ON account_subscriptions(organization_id, contact_id);
CREATE INDEX idx_account_subscriptions_device ON account_subscriptions(device_registration_id);
CREATE INDEX idx_account_subscriptions_status ON account_subscriptions(organization_id, status);
CREATE INDEX idx_account_subscriptions_expiry ON account_subscriptions(organization_id, end_date);
CREATE INDEX idx_account_subscriptions_key ON account_subscriptions(subscription_key);

-- Update other table indexes
DROP INDEX IF EXISTS idx_license_transfers_license;
DROP INDEX IF EXISTS idx_license_transfers_date;
CREATE INDEX idx_account_transfers_subscription ON account_transfers(account_subscription_id);
CREATE INDEX idx_account_transfers_date ON account_transfers(organization_id, transfer_date);

DROP INDEX IF EXISTS idx_downloads_activations_license;
CREATE INDEX idx_account_downloads_activations_subscription ON account_downloads_activations(account_subscription_id);

DROP INDEX IF EXISTS idx_billing_payments_license;
CREATE INDEX idx_account_billing_payments_subscription ON account_billing_payments(account_subscription_id);

DROP INDEX IF EXISTS idx_renewals_subscriptions_license;
CREATE INDEX idx_account_renewals_subscription ON account_renewals(account_subscription_id);

DROP INDEX IF EXISTS idx_renewal_alerts_license;
CREATE INDEX idx_account_alerts_subscription ON account_alerts(account_subscription_id);

-- =============================================
-- 5. UPDATE RLS POLICIES
-- =============================================

-- Drop old policies
DROP POLICY IF EXISTS software_licenses_org_isolation ON account_subscriptions;
DROP POLICY IF EXISTS license_transfers_org_isolation ON account_transfers;
DROP POLICY IF EXISTS downloads_activations_org_isolation ON account_downloads_activations;
DROP POLICY IF EXISTS billing_payments_org_isolation ON account_billing_payments;
DROP POLICY IF EXISTS renewals_subscriptions_org_isolation ON account_renewals;
DROP POLICY IF EXISTS renewal_alerts_org_isolation ON account_alerts;

-- Create new policies with updated names
CREATE POLICY account_subscriptions_org_isolation ON account_subscriptions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY account_transfers_org_isolation ON account_transfers
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY account_downloads_activations_org_isolation ON account_downloads_activations
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY account_billing_payments_org_isolation ON account_billing_payments
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY account_renewals_org_isolation ON account_renewals
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

CREATE POLICY account_alerts_org_isolation ON account_alerts
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- =============================================
-- 6. UPDATE TRIGGERS
-- =============================================

-- Drop old triggers
DROP TRIGGER IF EXISTS update_software_licenses_updated_at ON account_subscriptions;
DROP TRIGGER IF EXISTS update_downloads_activations_updated_at ON account_downloads_activations;
DROP TRIGGER IF EXISTS update_billing_payments_updated_at ON account_billing_payments;
DROP TRIGGER IF EXISTS update_renewals_subscriptions_updated_at ON account_renewals;
DROP TRIGGER IF EXISTS update_renewal_alerts_updated_at ON account_alerts;

-- Create new triggers with updated names
CREATE TRIGGER update_account_subscriptions_updated_at BEFORE UPDATE ON account_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_downloads_activations_updated_at BEFORE UPDATE ON account_downloads_activations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_billing_payments_updated_at BEFORE UPDATE ON account_billing_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_renewals_updated_at BEFORE UPDATE ON account_renewals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_account_alerts_updated_at BEFORE UPDATE ON account_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 7. UPDATE HELPER FUNCTIONS
-- =============================================

-- Update license key generation function
CREATE OR REPLACE FUNCTION generate_subscription_key()
RETURNS VARCHAR(255) AS $$
DECLARE
    key_prefix VARCHAR(10) := 'UPPAL-';
    random_part VARCHAR(20);
BEGIN
    random_part := encode(gen_random_bytes(10), 'hex');
    RETURN key_prefix || UPPER(random_part);
END;
$$ LANGUAGE plpgsql;

-- Keep old function for backward compatibility during transition
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS VARCHAR(255) AS $$
BEGIN
    RETURN generate_subscription_key();
END;
$$ LANGUAGE plpgsql;

-- Update license end date calculation function
CREATE OR REPLACE FUNCTION calculate_subscription_end_date(start_date TIMESTAMP, billing_cycle VARCHAR(20))
RETURNS TIMESTAMP AS $$
BEGIN
    CASE billing_cycle
        WHEN 'monthly' THEN
            RETURN start_date + INTERVAL '1 month';
        WHEN 'quarterly' THEN
            RETURN start_date + INTERVAL '3 months';
        WHEN 'semi_annual' THEN
            RETURN start_date + INTERVAL '6 months';
        WHEN 'annual' THEN
            RETURN start_date + INTERVAL '1 year';
        ELSE
            RETURN start_date + INTERVAL '1 month';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Keep old function for backward compatibility
CREATE OR REPLACE FUNCTION calculate_license_end_date(start_date TIMESTAMP, billing_cycle VARCHAR(20))
RETURNS TIMESTAMP AS $$
BEGIN
    RETURN calculate_subscription_end_date(start_date, billing_cycle);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 8. UPDATE TABLE COMMENTS
-- =============================================

COMMENT ON TABLE software_editions IS 'Product catalog for different software editions (Gold, Jio, Smart) with pricing tiers';
COMMENT ON TABLE device_registrations IS 'MAC address-based device tracking for account subscription binding';
COMMENT ON TABLE trials IS '24-hour trials with unlimited flexibility per customer per edition';
COMMENT ON TABLE account_subscriptions IS '1:1 device account subscriptions with MAC address binding and billing cycles';
COMMENT ON TABLE account_transfers IS 'Free transfers between customer devices with time-based expiry calculation';
COMMENT ON TABLE account_downloads_activations IS 'Email delivery and activation tracking for subscriptions and trials';
COMMENT ON TABLE account_billing_payments IS 'Transaction processing for different billing cycles';
COMMENT ON TABLE account_renewals IS 'Account-based renewal tracking and subscription management';
COMMENT ON TABLE account_alerts IS 'Automated expiry notifications (30, 14, 7, 1 day before expiry)';

-- =============================================
-- 9. UPDATE UNIQUE CONSTRAINTS
-- =============================================

-- Update unique constraint on subscription key
ALTER TABLE account_subscriptions DROP CONSTRAINT IF EXISTS software_licenses_organization_id_license_key_key;
ALTER TABLE account_subscriptions ADD CONSTRAINT account_subscriptions_organization_id_subscription_key_key
    UNIQUE(organization_id, subscription_key);

-- =============================================
-- MIGRATION COMPLETE
-- =============================================

-- Log migration completion
INSERT INTO schema_migrations (version, description, applied_at)
VALUES ('2024_01_rename_license_to_account', 'Rename License Management to Account Management', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT;

-- =============================================
-- POST-MIGRATION VERIFICATION QUERIES
-- =============================================

-- Verify table renames
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'account_%' ORDER BY table_name;

-- Verify column renames
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'account_subscriptions' AND column_name LIKE '%subscription%';

-- Verify foreign key constraints
-- SELECT constraint_name, table_name, column_name FROM information_schema.key_column_usage WHERE table_name LIKE 'account_%' ORDER BY table_name, column_name;