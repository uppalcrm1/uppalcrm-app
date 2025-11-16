-- Migration: Make price column nullable in products table
-- Allows products to be created without a price (respects Field Configuration)

-- Alter price column to allow NULL values
ALTER TABLE products
ALTER COLUMN price DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN products.price IS 'Product price - can be NULL if price is not applicable or configured as optional';
