-- Migration: Create Transactions Table
-- Tracks payment transactions for accounts created from lead conversions

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- Relationships
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,

    -- Payment Details
    payment_method VARCHAR(50) DEFAULT 'Credit Card',
    term VARCHAR(50), -- Monthly, Quarterly, Semi-Annual, Annual
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',

    -- Transaction Info
    status VARCHAR(50) DEFAULT 'completed', -- completed, pending, failed, refunded
    transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_reference VARCHAR(255), -- Payment gateway reference
    notes TEXT,

    -- Tracking
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_organization ON transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_contact ON transactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_transactions_product ON transactions(product_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_payment_method ON transactions(payment_method);

-- Enable Row Level Security
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for transactions
DROP POLICY IF EXISTS transactions_isolation_policy ON transactions;
CREATE POLICY transactions_isolation_policy ON transactions
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id', true)::UUID);

-- Trigger to update updated_at timestamp
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE transactions IS 'Payment transactions for accounts and contacts';
COMMENT ON COLUMN transactions.payment_method IS 'Payment method: Credit Card, Debit Card, Bank Transfer, Cash, Check, PayPal, Stripe, Other';
COMMENT ON COLUMN transactions.term IS 'Payment term: Monthly, Quarterly, Semi-Annual, Annual';
COMMENT ON COLUMN transactions.status IS 'Transaction status: completed, pending, failed, refunded';
COMMENT ON COLUMN transactions.transaction_reference IS 'External payment gateway reference ID';
