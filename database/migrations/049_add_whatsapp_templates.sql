-- Migration 049: Add whatsapp_templates table
-- Stores WhatsApp approved message templates with Twilio Content SIDs

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_name VARCHAR(100) NOT NULL,
  template_sid VARCHAR(100) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  body_preview TEXT,
  category VARCHAR(50) DEFAULT 'marketing',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast lookups by organization and active status
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_org_active
  ON whatsapp_templates(organization_id, is_active);

-- Seed the existing renewal template for each active organization
INSERT INTO whatsapp_templates (
  organization_id, template_name, template_sid, display_name,
  body_preview, category, is_active, sort_order
)
SELECT
  id,
  'renewal_customer',
  'HX8d87e8a5e3ae0d1f9991ad782242c17e',
  'Renewal Reminder',
  'Dear Customer, This is Uppal Solutions reaching out to inform about your upcoming account renewal. Let us know if you have any questions.',
  'marketing',
  true,
  1
FROM organizations
ON CONFLICT DO NOTHING;
