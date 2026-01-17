-- Add updated_at column to phone_calls table for recording callback updates
ALTER TABLE phone_calls ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create index on updated_at for performance
CREATE INDEX idx_phone_calls_updated ON phone_calls(updated_at DESC);
