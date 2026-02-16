-- Migration: 043 - Add timezone columns to users and organizations
--
-- User timezone = display-only: how each user sees timestamps in the UI.
-- Org timezone  = "business timezone": used for workflow rules, cron scheduling,
--                 date calculations, and reports. Represents the timezone the
--                 business operates in.

-- Add timezone column to users table (idempotent)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

CREATE INDEX IF NOT EXISTS idx_users_timezone ON users(timezone);

-- Add timezone column to organizations table (idempotent)
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
