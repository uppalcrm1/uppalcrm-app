-- Migration: Add currency configuration for CAD/USD support
-- Exchange rate: 1 USD = 1.25 CAD (100 USD = 125 CAD)

-- =====================================================
-- 1. CREATE SYSTEM CONFIGURATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, config_key)
);

-- Enable Row Level Security
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_config_isolation_policy ON system_config
  FOR ALL TO PUBLIC
  USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Create index for fast lookups
CREATE INDEX idx_system_config_org_key ON system_config(organization_id, config_key);

-- Trigger for updated_at
CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. INSERT DEFAULT EXCHANGE RATE (1 USD = 1.25 CAD)
-- =====================================================

INSERT INTO system_config (organization_id, config_key, config_value, description)
SELECT
  id as organization_id,
  'exchange_rate_usd_to_cad',
  '1.25',
  'Exchange rate: 1 USD = 1.25 CAD (100 USD = 125 CAD)'
FROM organizations
ON CONFLICT (organization_id, config_key) DO NOTHING;

-- =====================================================
-- 3. SET DEFAULT REPORTING CURRENCY TO CAD
-- =====================================================

INSERT INTO system_config (organization_id, config_key, config_value, description)
SELECT
  id as organization_id,
  'default_reporting_currency',
  'CAD',
  'Default currency for revenue reports and analytics'
FROM organizations
ON CONFLICT (organization_id, config_key) DO NOTHING;

-- =====================================================
-- 4. UPDATE TRANSACTIONS TABLE
-- =====================================================

-- Set default currency to CAD
ALTER TABLE transactions
  ALTER COLUMN currency SET DEFAULT 'CAD';

-- Add check constraint to only allow CAD or USD
ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_currency_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_currency_check
  CHECK (currency IN ('CAD', 'USD'));

-- =====================================================
-- 5. COMMENTS
-- =====================================================

COMMENT ON TABLE system_config IS 'Organization-level configuration settings';
COMMENT ON COLUMN system_config.config_key IS 'Configuration key (e.g., exchange_rate_usd_to_cad)';
COMMENT ON COLUMN system_config.config_value IS 'Configuration value stored as text';

COMMENT ON COLUMN transactions.currency IS 'Transaction currency: CAD or USD only';

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================

-- Verify configuration was inserted
-- SELECT * FROM system_config WHERE config_key IN ('exchange_rate_usd_to_cad', 'default_reporting_currency');
