-- Migration: Add source column to transactions table
-- Tracks where the payment/lead came from (website, phone, referral, etc.)

-- Add source column
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS source VARCHAR(50);

-- Add index for filtering by source
CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);

-- Add comment
COMMENT ON COLUMN transactions.source IS 'Payment source: website, phone, email, referral, walk-in, partner, social_media, other';

-- Update existing transactions with default value if needed
UPDATE transactions
SET source = 'website'
WHERE source IS NULL;
