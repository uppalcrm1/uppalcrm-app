-- Add password reset token fields to users table
-- This enables password reset functionality

ALTER TABLE users
ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token_hash) WHERE reset_token_hash IS NOT NULL;

COMMIT;
