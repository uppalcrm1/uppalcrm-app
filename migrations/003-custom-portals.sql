-- Custom Portals Table
-- Allows organizations to add their own billing portals beyond the default ones

CREATE TABLE IF NOT EXISTS custom_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT unique_org_portal_name UNIQUE(organization_id, name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_custom_portals_org_id ON custom_portals(organization_id);
CREATE INDEX IF NOT EXISTS idx_custom_portals_is_active ON custom_portals(is_active);
