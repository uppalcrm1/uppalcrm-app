-- Migration 021: Custom Reports and Dashboards Tables
-- Creates tables for user-generated reports and dashboards with RLS

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SAVED REPORTS TABLE
-- ============================================

CREATE TABLE saved_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Report metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Report configuration (stored as JSONB for flexibility)
  -- Structure:
  -- {
  --   "dataSource": "leads|contacts|accounts|transactions",
  --   "fields": ["field1", "field2"],
  --   "filters": [
  --     {"field": "status", "operator": "equals", "value": "active"}
  --   ],
  --   "groupBy": ["field1"],
  --   "orderBy": [{"field": "created_at", "direction": "desc"}],
  --   "limit": 100,
  --   "chartType": "table|line|bar|pie|area"
  -- }
  config JSONB NOT NULL,

  -- Access and usage tracking
  is_favorite BOOLEAN DEFAULT false,
  last_run_at TIMESTAMP WITH TIME ZONE,
  run_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT saved_reports_org_user_name UNIQUE(organization_id, user_id, name),
  CONSTRAINT saved_reports_valid_config CHECK (
    config ? 'dataSource' AND
    config ? 'fields' AND
    jsonb_typeof(config->'fields') = 'array'
  )
);

-- Indexes for performance
CREATE INDEX idx_saved_reports_user ON saved_reports(user_id, organization_id);
CREATE INDEX idx_saved_reports_org ON saved_reports(organization_id);
CREATE INDEX idx_saved_reports_favorite ON saved_reports(user_id, organization_id) WHERE is_favorite = true;
CREATE INDEX idx_saved_reports_updated ON saved_reports(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own reports
CREATE POLICY saved_reports_isolation ON saved_reports
  FOR ALL
  USING (
    organization_id::text = current_setting('app.current_organization_id', true)
    AND user_id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
    AND user_id::text = current_setting('app.current_user_id', true)
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_saved_reports_updated_at
  BEFORE UPDATE ON saved_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_reports_updated_at();

-- ============================================
-- SAVED DASHBOARDS TABLE
-- ============================================

CREATE TABLE saved_dashboards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Dashboard metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,

  -- Layout configuration (stored as JSONB)
  -- Structure:
  -- {
  --   "widgets": [
  --     {
  --       "id": "widget-1",
  --       "type": "kpi|chart|report|recent_items",
  --       "title": "Revenue This Month",
  --       "config": {...},
  --       "position": {"x": 0, "y": 0, "w": 6, "h": 4}
  --     }
  --   ]
  -- }
  layout JSONB NOT NULL,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT saved_dashboards_org_user_name UNIQUE(organization_id, user_id, name),
  CONSTRAINT saved_dashboards_valid_layout CHECK (
    layout ? 'widgets' AND
    jsonb_typeof(layout->'widgets') = 'array'
  )
);

-- Indexes for performance
CREATE INDEX idx_saved_dashboards_user ON saved_dashboards(user_id, organization_id);
CREATE INDEX idx_saved_dashboards_org ON saved_dashboards(organization_id);
CREATE INDEX idx_saved_dashboards_default ON saved_dashboards(user_id, organization_id) WHERE is_default = true;
CREATE INDEX idx_saved_dashboards_updated ON saved_dashboards(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE saved_dashboards ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access their own dashboards
CREATE POLICY saved_dashboards_isolation ON saved_dashboards
  FOR ALL
  USING (
    organization_id::text = current_setting('app.current_organization_id', true)
    AND user_id::text = current_setting('app.current_user_id', true)
  )
  WITH CHECK (
    organization_id::text = current_setting('app.current_organization_id', true)
    AND user_id::text = current_setting('app.current_user_id', true)
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_dashboards_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_saved_dashboards_updated_at
  BEFORE UPDATE ON saved_dashboards
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_dashboards_updated_at();

-- Trigger to ensure only one default dashboard per user
CREATE OR REPLACE FUNCTION ensure_single_default_dashboard()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    -- Unset any existing default dashboard for this user
    UPDATE saved_dashboards
    SET is_default = false
    WHERE user_id = NEW.user_id
      AND organization_id = NEW.organization_id
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_default_dashboard
  BEFORE INSERT OR UPDATE ON saved_dashboards
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_dashboard();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant necessary permissions to application users
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_reports TO PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_dashboards TO PUBLIC;

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE saved_reports IS 'User-created custom reports with dynamic field selection and filtering';
COMMENT ON COLUMN saved_reports.config IS 'JSONB configuration containing dataSource, fields, filters, groupBy, orderBy, limit, and chartType';
COMMENT ON COLUMN saved_reports.is_favorite IS 'Flag to mark favorite reports for quick access';
COMMENT ON COLUMN saved_reports.run_count IS 'Number of times this report has been executed';

COMMENT ON TABLE saved_dashboards IS 'User-created custom dashboards with drag-and-drop widget layouts';
COMMENT ON COLUMN saved_dashboards.layout IS 'JSONB configuration containing widget array with positions and configurations';
COMMENT ON COLUMN saved_dashboards.is_default IS 'Flag to mark the default dashboard shown on login (one per user)';
