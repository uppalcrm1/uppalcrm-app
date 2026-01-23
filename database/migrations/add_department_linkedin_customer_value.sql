-- Add department, linkedin, and customer_value fields to contacts
ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS department VARCHAR(255),
ADD COLUMN IF NOT EXISTS linkedin VARCHAR(500),
ADD COLUMN IF NOT EXISTS customer_value DECIMAL(15,2);
