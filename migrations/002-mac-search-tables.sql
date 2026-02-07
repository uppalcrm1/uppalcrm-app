-- MAC Search Feature Tables
-- Created: 2026-02-06

-- Table: billing_portal_credentials
-- Stores encrypted credentials for each billing portal per organization
CREATE TABLE IF NOT EXISTS billing_portal_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  portal_id VARCHAR(100) NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL, -- Encrypted
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, portal_id)
);

-- Table: mac_search_history
-- Audit log of all MAC address searches
CREATE TABLE IF NOT EXISTS mac_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mac_address VARCHAR(17) NOT NULL,
  results JSONB NOT NULL, -- Stores complete search results
  total_found INTEGER DEFAULT 0,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: mac_search_results
-- Stores results of background/async searches
CREATE TABLE IF NOT EXISTS mac_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id VARCHAR(36) NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mac_address VARCHAR(17) NOT NULL,
  results JSONB NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add mac_search_enabled column to organizations table if it doesn't exist
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS mac_search_enabled BOOLEAN DEFAULT FALSE;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_mac_search_history_org_id ON mac_search_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_mac_search_history_mac_address ON mac_search_history(mac_address);
CREATE INDEX IF NOT EXISTS idx_mac_search_results_search_id ON mac_search_results(search_id);
CREATE INDEX IF NOT EXISTS idx_billing_portal_credentials_org_id ON billing_portal_credentials(organization_id);
