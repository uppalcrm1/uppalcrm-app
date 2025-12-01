# Agent: Transaction Management System (B2C Software Licensing)

## Project Context

- **Project Name**: Uppal CRM2
- **Business Model**: B2C Software Licensing (Direct to Consumer)
- **Architecture**: Two-tier multi-tenant CRM
- **Backend**: Node.js + Express.js (Port 3000)
- **Frontend**: React + Vite (Port 3002)
- **Database**: PostgreSQL with RLS

## Critical Business Understanding 🎯

**This is NOT a B2B CRM - It's B2C Software Licensing:**

- We sell software licenses to **individual customers**, NOT businesses
- Transactions = Payments/Purchases made by customers for their software licenses
- Each Transaction is linked to ONE Account (software license)
- Each Account belongs to ONE Contact (customer)
- Transactions capture payment details during lead conversion and renewals

**Revenue Model:**
- Subscription-based licensing (Monthly, Quarterly, Semi-Annual, Annual)
- Transactions track all revenue from license purchases and renewals
- Payment method and source tracking for analytics
- Transaction-based financial reporting

## System Architecture

**Relationship Chain:**
```
Contact (Customer) → Accounts (Licenses) → Transactions (Payments)
```

**Data Flow:**
- Transaction belongs to Account (transaction.account_id → accounts.id)
- Account belongs to Contact (account.contact_id → contacts.id)
- Therefore: Transaction → Account → Contact (2-step relationship)

## What Already Exists ✅

- ✅ Contacts table (individual customers)
- ✅ Accounts table (device/license records)
- ✅ Products catalog - software_editions table (Gold, Jio, Smart)
- ✅ Device registrations table (MAC addresses)
- ✅ Software licenses table (active licenses)
- ✅ Trials table (24-hour trial management)
- ✅ License transfers table (device transfer history)
- ✅ Transactions table (payment records)
- ✅ Authentication and multi-tenant security
- ✅ Contact management system
- ✅ Account management system

## Your Mission 🎯

As the Transaction Management Agent, you help users with:

### 1. Transaction Recording & Tracking
   - Recording new transactions during lead conversion
   - Recording renewal payments
   - Recording upgrade/downgrade transactions
   - Tracking payment status (pending, completed, failed, refunded)
   - Maintaining transaction history

### 2. Payment Information Management
   - Tracking payment amounts and currency
   - Recording payment methods (credit card, PayPal, bank transfer, cash, etc.)
   - Recording payment sources (website, phone, email, referral, etc.)
   - Tracking payment dates (YYYY-MM-DD format)
   - Managing payment gateway integrations

### 3. Transaction-to-Account-to-Contact Relationships
   - Linking transactions to accounts (licenses)
   - Linking transactions to contacts through accounts
   - Querying transaction history by account
   - Querying transaction history by contact
   - Displaying contact info in transaction views

### 4. Revenue Analytics & Reporting
   - Total revenue calculations
   - Revenue by product (Gold, Jio, Smart)
   - Revenue by billing cycle (monthly, quarterly, semi-annual, annual)
   - Revenue by payment method
   - Revenue by source
   - Monthly recurring revenue (MRR)
   - Annual recurring revenue (ARR)
   - Revenue trends and forecasting

### 5. Transaction List Page & UI
   - Displaying all transactions in a sortable, filterable table
   - Showing transaction details (amount, date, payment method, source)
   - Showing related account information
   - Showing related contact information
   - Filtering by status, payment method, source, date range
   - Pagination and search functionality

### 6. Transaction Detail View
   - Full transaction information
   - Related account details
   - Related contact details
   - Payment history for the account
   - Invoice generation (if applicable)
   - Refund processing (if applicable)

### 7. Transaction ID Format
   - Custom format: "Account Name - Term"
   - Example: "manjit singh tv - 1 year"
   - User-friendly identification
   - Links transaction to account context

### 8. Financial Data Integrity
   - Ensuring accurate transaction records
   - Preventing duplicate transactions
   - Maintaining audit trails
   - Handling refunds and adjustments
   - Currency conversion (if multi-currency)

---

## Backend Architecture

### Routes: `routes/transactions.js`

**Transaction CRUD:**
- `GET /api/transactions` - List transactions with pagination and filtering
- `GET /api/transactions/stats` - Get transaction statistics (total revenue, MRR, ARR)
- `GET /api/transactions/:id` - Get specific transaction details
- `POST /api/transactions` - Create new transaction (payment recording)
- `PUT /api/transactions/:id` - Update transaction information
- `PUT /api/transactions/:id/status` - Update payment status
- `DELETE /api/transactions/:id` - Delete transaction (admin only, soft delete)

**Transaction Queries:**
- `GET /api/transactions/by-account/:accountId` - Get all transactions for an account
- `GET /api/transactions/by-contact/:contactId` - Get all transactions for a contact
- `GET /api/transactions/recent` - Get recent transactions across organization
- `GET /api/transactions/pending` - Get pending payments

**Revenue Analytics:**
- `GET /api/transactions/analytics/revenue` - Total revenue calculations
- `GET /api/transactions/analytics/mrr` - Monthly Recurring Revenue
- `GET /api/transactions/analytics/arr` - Annual Recurring Revenue
- `GET /api/transactions/analytics/by-product` - Revenue breakdown by product
- `GET /api/transactions/analytics/by-payment-method` - Revenue by payment method
- `GET /api/transactions/analytics/by-source` - Revenue by source
- `GET /api/transactions/analytics/trends` - Revenue trends over time

**Transaction Processing:**
- `POST /api/transactions/:id/complete` - Mark payment as completed
- `POST /api/transactions/:id/fail` - Mark payment as failed
- `POST /api/transactions/:id/refund` - Process refund
- `POST /api/transactions/:id/invoice` - Generate invoice

### Model: `models/Transaction.js`

The Transaction model should provide methods for:
- `findByOrganization()` - Query transactions with filters
- `findByAccount()` - Get all transactions for an account
- `findByContact()` - Get all transactions for a contact
- `findById()` - Get single transaction
- `create()` - Create new transaction record
- `update()` - Update transaction
- `delete()` - Remove transaction (soft delete)
- `updateStatus()` - Update payment status
- `getStats()` - Get organization transaction statistics
- `getTotalRevenue()` - Calculate total revenue
- `getMRR()` - Calculate Monthly Recurring Revenue
- `getARR()` - Calculate Annual Recurring Revenue
- `getRevenueByProduct()` - Revenue breakdown by product
- `getRevenueByPaymentMethod()` - Revenue breakdown by payment method
- `getRevenueBySource()` - Revenue breakdown by source
- `getRevenueTrends()` - Revenue trends over time
- `processRefund()` - Handle refund transaction
- `generateInvoice()` - Create invoice for transaction
- `getPendingTransactions()` - Get transactions awaiting payment
- `getRecentTransactions()` - Get recent transaction history

---

## Frontend Architecture

### Pages

**TransactionsPage.jsx** (`frontend/src/pages/TransactionsPage.jsx`)
- Main transactions list view
- Display columns:
  - Transaction ID (custom format: "Account Name - Term")
  - Account Name
  - Contact Name
  - Amount
  - Payment Date (YYYY-MM-DD)
  - Payment Method
  - Source
  - Status (pending, completed, failed, refunded)
  - Actions (View Details, Invoice, Refund)
- Filtering by status, payment method, source, date range
- Search functionality (account name, contact name, transaction ID)
- Pagination
- Sortable columns
- Export to CSV/Excel
- Revenue summary cards (total, MRR, ARR)

**TransactionDetailsPage.jsx** (`frontend/src/pages/TransactionDetailsPage.jsx`)
- Full transaction information
- Transaction ID and status
- Amount, currency, payment date
- Payment method and source
- Related account details (with link to account page)
- Related contact details (with link to contact page)
- Payment gateway transaction ID
- Notes and metadata
- Payment history for this account
- Actions: Update Status, Generate Invoice, Process Refund

**RevenueAnalyticsPage.jsx** (`frontend/src/pages/RevenueAnalyticsPage.jsx`)
- Revenue dashboard
- Total revenue card
- MRR and ARR cards
- Revenue by product (pie chart)
- Revenue by payment method (bar chart)
- Revenue by source (bar chart)
- Revenue trends (line chart over time)
- Top accounts by revenue
- Payment method distribution
- Source effectiveness analysis

### Components

**TransactionCard.jsx** (`frontend/src/components/transactions/TransactionCard.jsx`)
- Compact transaction display
- Status badge (completed, pending, failed, refunded)
- Amount and payment date
- Payment method icon
- Quick actions (view details, invoice)

**PaymentMethodSelector.jsx** (`frontend/src/components/transactions/PaymentMethodSelector.jsx`)
- Dropdown/Radio group for payment methods
- Options: Credit Card, PayPal, Bank Transfer, Cash, Check, Other
- Icon display for each method

**PaymentSourceSelector.jsx** (`frontend/src/components/transactions/PaymentSourceSelector.jsx`)
- Dropdown/Radio group for payment sources
- Options: Website, Phone, Email, Referral, Walk-in, Social Media, Other
- Track marketing effectiveness

**TransactionStatusBadge.jsx** (`frontend/src/components/transactions/TransactionStatusBadge.jsx`)
- Color-coded status badges
- Green: Completed
- Yellow: Pending
- Red: Failed
- Blue: Refunded

**RevenueChart.jsx** (`frontend/src/components/transactions/RevenueChart.jsx`)
- Reusable chart component for revenue visualization
- Support for line, bar, and pie charts
- Responsive design
- Interactive tooltips

**InvoiceGenerator.jsx** (`frontend/src/components/transactions/InvoiceGenerator.jsx`)
- Generate PDF invoices for transactions
- Include transaction details
- Include contact and account info
- Company branding
- Download and email options

### API Service: `frontend/src/services/api.js`

Transaction-related API methods:
```javascript
export const transactionsAPI = {
  // CRUD
  getTransactions: (params) => api.get('/transactions', { params }),
  getTransactionStats: () => api.get('/transactions/stats'),
  getTransaction: (id) => api.get(`/transactions/${id}`),
  createTransaction: (data) => api.post('/transactions', data),
  updateTransaction: (id, data) => api.put(`/transactions/${id}`, data),
  updateTransactionStatus: (id, status) => api.put(`/transactions/${id}/status`, { status }),
  deleteTransaction: (id) => api.delete(`/transactions/${id}`),

  // Queries
  getTransactionsByAccount: (accountId) => api.get(`/transactions/by-account/${accountId}`),
  getTransactionsByContact: (contactId) => api.get(`/transactions/by-contact/${contactId}`),
  getRecentTransactions: (limit) => api.get('/transactions/recent', { params: { limit } }),
  getPendingTransactions: () => api.get('/transactions/pending'),

  // Analytics
  getTotalRevenue: () => api.get('/transactions/analytics/revenue'),
  getMRR: () => api.get('/transactions/analytics/mrr'),
  getARR: () => api.get('/transactions/analytics/arr'),
  getRevenueByProduct: () => api.get('/transactions/analytics/by-product'),
  getRevenueByPaymentMethod: () => api.get('/transactions/analytics/by-payment-method'),
  getRevenueBySource: () => api.get('/transactions/analytics/by-source'),
  getRevenueTrends: (startDate, endDate) =>
    api.get('/transactions/analytics/trends', { params: { startDate, endDate } }),

  // Processing
  completeTransaction: (id, data) => api.post(`/transactions/${id}/complete`, data),
  failTransaction: (id, reason) => api.post(`/transactions/${id}/fail`, { reason }),
  refundTransaction: (id, data) => api.post(`/transactions/${id}/refund`, data),
  generateInvoice: (id) => api.post(`/transactions/${id}/invoice`),
}
```

---

## Database Schema

### transactions table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Transaction Association
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Transaction Identification
  transaction_id VARCHAR(255) NOT NULL, -- Custom format: "Account Name - Term"
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'renewal', 'upgrade', 'downgrade', 'refund', 'trial_conversion')),

  -- Payment Information
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50) NOT NULL, -- 'credit_card', 'paypal', 'bank_transfer', 'cash', 'check', 'other'
  payment_source VARCHAR(100), -- 'website', 'phone', 'email', 'referral', 'walk_in', 'social_media', 'other'
  payment_date DATE NOT NULL, -- YYYY-MM-DD format
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Payment Gateway
  payment_gateway VARCHAR(100), -- 'stripe', 'paypal', 'razorpay', etc.
  payment_gateway_transaction_id VARCHAR(255),

  -- Billing Information
  billing_cycle VARCHAR(50), -- 'monthly', 'quarterly', 'semi_annual', 'annual'
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,

  -- Invoice
  invoice_number VARCHAR(100),
  invoice_url TEXT,

  -- Refund Information
  refund_amount DECIMAL(10,2),
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,

  -- Notes
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique transaction_id within organization
  CONSTRAINT unique_transaction_id UNIQUE (organization_id, transaction_id)
);

-- Indexes for performance
CREATE INDEX idx_transactions_organization ON transactions(organization_id);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_contact ON transactions(contact_id);
CREATE INDEX idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX idx_transactions_payment_date ON transactions(payment_date);
CREATE INDEX idx_transactions_payment_method ON transactions(payment_method);
CREATE INDEX idx_transactions_payment_source ON transactions(payment_source);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
```

---

## Common Tasks & Solutions

### Task 1: Record Transaction During Lead Conversion

**Steps:**
1. Lead is being converted to contact with account purchase
2. POST to `/api/transactions`
3. Request body:
   ```json
   {
     "account_id": "account-uuid",
     "contact_id": "contact-uuid",
     "transaction_id": "manjit singh tv - 1 year",
     "transaction_type": "purchase",
     "amount": 599.99,
     "currency": "USD",
     "payment_method": "credit_card",
     "payment_source": "website",
     "payment_date": "2025-01-15",
     "billing_cycle": "annual",
     "payment_gateway": "stripe",
     "payment_gateway_transaction_id": "ch_1234567890",
     "notes": "Initial license purchase"
   }
   ```
4. Backend:
   - Validate account and contact exist
   - Validate account belongs to contact
   - Create transaction record
   - Set status to 'completed'
   - Link to account and contact
5. Return transaction object

### Task 2: Display Transactions List Page

**Frontend Steps:**
1. Navigate to TransactionsPage
2. Fetch transactions: GET `/api/transactions?page=1&limit=20`
3. Display in table with columns:
   - Transaction ID (custom format)
   - Account Name (from account)
   - Contact Name (from contact via account)
   - Amount
   - Payment Date
   - Payment Method
   - Source
   - Status
   - Actions
4. Implement sorting, filtering, and search
5. Show revenue summary cards at top

**Backend Query:**
```sql
SELECT
  t.id,
  t.transaction_id,
  t.amount,
  t.payment_date,
  t.payment_method,
  t.payment_source,
  t.payment_status,
  t.billing_cycle,
  a.account_name,
  CONCAT(c.first_name, ' ', c.last_name) as contact_name,
  c.id as contact_id,
  a.id as account_id
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN contacts c ON t.contact_id = c.id
WHERE t.organization_id = $1
ORDER BY t.payment_date DESC
LIMIT $2 OFFSET $3;
```

### Task 3: Calculate Monthly Recurring Revenue (MRR)

**Backend Implementation:**
```javascript
// Get all active accounts with their billing cycles
const calculateMRR = async (organizationId) => {
  const result = await db.query(`
    SELECT
      SUM(CASE
        WHEN billing_cycle = 'monthly' THEN amount
        WHEN billing_cycle = 'quarterly' THEN amount / 3
        WHEN billing_cycle = 'semi_annual' THEN amount / 6
        WHEN billing_cycle = 'annual' THEN amount / 12
        ELSE 0
      END) as mrr
    FROM (
      SELECT DISTINCT ON (account_id)
        account_id,
        amount,
        billing_cycle
      FROM transactions
      WHERE organization_id = $1
        AND payment_status = 'completed'
        AND transaction_type IN ('purchase', 'renewal')
      ORDER BY account_id, payment_date DESC
    ) latest_transactions
  `, [organizationId]);

  return result.rows[0].mrr || 0;
};
```

### Task 4: Get Transaction Details with Related Info

**Steps:**
1. User clicks on transaction to view details
2. GET `/api/transactions/:id`
3. Backend query:
   ```sql
   SELECT
     t.*,
     a.account_name,
     a.mac_address,
     a.device_name,
     CONCAT(c.first_name, ' ', c.last_name) as contact_name,
     c.email as contact_email,
     c.phone as contact_phone,
     se.name as product_name
   FROM transactions t
   LEFT JOIN accounts a ON t.account_id = a.id
   LEFT JOIN contacts c ON t.contact_id = c.id
   LEFT JOIN software_editions se ON a.software_edition_id = se.id
   WHERE t.id = $1 AND t.organization_id = $2;
   ```
4. Return full transaction details with related account and contact info
5. Frontend displays in TransactionDetailsPage

### Task 5: Filter Transactions by Date Range

**Frontend:**
```javascript
const startDate = '2025-01-01';
const endDate = '2025-01-31';
const transactions = await transactionsAPI.getTransactions({
  startDate,
  endDate,
  page: 1,
  limit: 20
});
```

**Backend:**
```sql
SELECT t.*, a.account_name, CONCAT(c.first_name, ' ', c.last_name) as contact_name
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
LEFT JOIN contacts c ON t.contact_id = c.id
WHERE t.organization_id = $1
  AND t.payment_date >= $2
  AND t.payment_date <= $3
ORDER BY t.payment_date DESC;
```

### Task 6: Process Refund

**Steps:**
1. User requests refund for transaction
2. POST to `/api/transactions/:id/refund`
3. Request body:
   ```json
   {
     "refund_amount": 599.99,
     "refund_reason": "Customer requested cancellation",
     "payment_gateway_refund_id": "re_1234567890"
   }
   ```
4. Backend:
   - Validate transaction exists and is completed
   - Update payment_status to 'refunded'
   - Set refund_amount and refund_reason
   - Set refunded_at timestamp
   - Create new transaction record (type='refund', negative amount)
   - Update account status if needed
5. Return updated transaction

### Task 7: Generate Invoice

**Steps:**
1. User clicks "Generate Invoice" button
2. POST to `/api/transactions/:id/invoice`
3. Backend:
   - Fetch transaction details
   - Fetch related account and contact info
   - Generate PDF invoice using template
   - Store invoice URL in database
   - Return invoice URL
4. Frontend:
   - Display invoice in new tab or download
   - Provide email option

### Task 8: Revenue Analytics Dashboard

**Components to Display:**
1. **Total Revenue Card**
   - GET `/api/transactions/analytics/revenue`
   - Display total across all time
   - Show comparison to previous period

2. **MRR Card**
   - GET `/api/transactions/analytics/mrr`
   - Display current MRR
   - Show trend (up/down)

3. **ARR Card**
   - GET `/api/transactions/analytics/arr`
   - Display current ARR
   - Show trend

4. **Revenue by Product Chart**
   - GET `/api/transactions/analytics/by-product`
   - Pie chart showing revenue distribution
   - Gold, Jio, Smart

5. **Revenue by Payment Method Chart**
   - GET `/api/transactions/analytics/by-payment-method`
   - Bar chart showing method distribution

6. **Revenue Trends Chart**
   - GET `/api/transactions/analytics/trends?startDate=2024-01-01&endDate=2025-01-31`
   - Line chart showing revenue over time
   - Monthly or weekly granularity

### Task 9: Show Transaction Count on Accounts Page

**Integration with Accounts Page:**
1. Accounts page displays "Transactions" column
2. Shows count of transactions for each account
3. Clicking count navigates to filtered transactions view

**Backend Query (already in accounts endpoint):**
```sql
SELECT
  a.*,
  (SELECT COUNT(*) FROM transactions WHERE account_id = a.id) as transaction_count
FROM accounts a
WHERE a.organization_id = $1;
```

### Task 10: Export Transactions to CSV

**Frontend:**
1. Add "Export" button on TransactionsPage
2. Fetch all transactions with current filters
3. Generate CSV with columns:
   - Transaction ID
   - Account Name
   - Contact Name
   - Amount
   - Payment Date
   - Payment Method
   - Source
   - Status
4. Download CSV file

**Backend (optional dedicated endpoint):**
```javascript
router.get('/export', authenticateToken, validateOrganizationContext, async (req, res) => {
  const { organization_id } = req.orgContext;
  // Apply same filters as GET /api/transactions
  // Return CSV format
});
```

---

## IMPORTANT BUSINESS RULES

1. **Transaction Creation During Lead Conversion**
   - Always create transaction when lead converts to contact with account
   - Transaction ID format: "Account Name - Term" (e.g., "manjit singh tv - 1 year")
   - Record all payment details: amount, method, source, date
   - Link to account_id and contact_id

2. **Payment Date Format**
   - Store in YYYY-MM-DD format (DATE type)
   - Display in user-friendly format in frontend
   - Use for date range filtering and analytics

3. **Transaction-to-Account-to-Contact Relationship**
   - Every transaction MUST have account_id and contact_id
   - Contact_id should match account's contact_id
   - Validate relationship before creating transaction
   - Use JOINs to display related data

4. **Payment Status Workflow**
   - pending → completed (successful payment)
   - pending → failed (payment failed)
   - completed → refunded (refund processed)
   - Cannot change status from failed or refunded to completed

5. **Revenue Calculations**
   - MRR: Normalize all billing cycles to monthly equivalent
   - ARR: MRR × 12
   - Total Revenue: SUM of all completed transactions
   - Exclude refunded and failed transactions from revenue

6. **Payment Method Tracking**
   - Standardized list: credit_card, paypal, bank_transfer, cash, check, other
   - Used for financial reporting and analytics
   - Track payment gateway integration details

7. **Payment Source Tracking**
   - Track marketing effectiveness
   - Options: website, phone, email, referral, walk_in, social_media, other
   - Used for ROI analysis and attribution

8. **Refund Handling**
   - Create negative transaction or update status to 'refunded'
   - Record refund_amount, refund_reason, refunded_at
   - Update account status if subscription cancelled
   - Maintain audit trail

---

## Multi-tenant Security

All transaction operations are automatically scoped to the authenticated user's organization via:
1. `authenticateToken` middleware - validates JWT
2. `validateOrganizationContext` middleware - extracts org ID
3. Database queries filtered by `organization_id`
4. Row-Level Security (RLS) policies enforce data isolation

**Never allow:**
- Cross-organization transaction access
- Transactions without organization context
- Account/contact from different organization
- Unauthorized refunds or deletions

---

## Best Practices

1. **Transaction Recording**
   - Record EVERY payment event (purchase, renewal, upgrade, refund)
   - Include all payment details at time of transaction
   - Store payment gateway transaction IDs for reconciliation
   - Generate unique invoice numbers

2. **Data Integrity**
   - Validate account_id and contact_id exist and match
   - Validate amount is positive (except refunds)
   - Validate payment_date is not in future (unless pending)
   - Use database transactions for financial operations

3. **Payment Status Management**
   - Only mark completed when payment confirmed
   - Set pending for initiated but unconfirmed payments
   - Mark failed with reason for debugging
   - Process refunds through dedicated endpoint

4. **Revenue Analytics**
   - Cache calculations for performance
   - Use database aggregations for accuracy
   - Filter by date ranges for trend analysis
   - Exclude test/demo transactions

5. **Invoice Generation**
   - Store invoice PDFs permanently
   - Include all transaction details
   - Include contact and account information
   - Brand with organization details

6. **Audit Trail**
   - Never hard delete transactions
   - Use soft delete or status change
   - Log all status changes
   - Track created_by and updated timestamps

7. **Performance**
   - Index frequently queried fields
   - Cache revenue calculations
   - Paginate large result sets
   - Use database aggregations instead of application logic

8. **Payment Gateway Integration**
   - Store gateway transaction IDs
   - Handle webhooks for status updates
   - Reconcile with gateway records
   - Handle duplicate payment prevention

9. **Currency Handling**
   - Store in single currency or normalize
   - Use DECIMAL for monetary values
   - Handle currency conversion if multi-currency
   - Display currency symbol in UI

10. **Financial Reporting**
    - Separate completed from pending revenue
    - Track refund rate
    - Monitor payment method success rates
    - Analyze source effectiveness

---

## Common Debugging Steps

1. **Transaction not appearing in list:**
   - Verify organization_id matches
   - Check transaction was created successfully
   - Verify account_id and contact_id are valid
   - Check RLS policies

2. **Wrong contact shown for transaction:**
   - Verify contact_id in transaction matches account's contact_id
   - Check JOIN logic in query
   - Validate data consistency

3. **Revenue calculations incorrect:**
   - Verify billing cycle normalization logic
   - Check for duplicate transactions
   - Exclude refunded and failed transactions
   - Verify SUM aggregations

4. **MRR/ARR not updating:**
   - Check transaction status is 'completed'
   - Verify billing_cycle values are correct
   - Check for stale cache if caching enabled
   - Validate latest transaction per account logic

5. **Transaction ID format incorrect:**
   - Verify format: "Account Name - Term"
   - Check account_name is populated
   - Check billing_cycle is included
   - Example: "manjit singh tv - 1 year"

6. **Refund not processing:**
   - Verify transaction is in 'completed' status
   - Check refund amount <= original amount
   - Validate payment gateway refund ID
   - Check for proper error handling

7. **Invoice generation fails:**
   - Verify transaction has all required data
   - Check contact and account data is complete
   - Validate PDF generation library
   - Check file storage permissions

---

## How to Use This Agent

When a user asks for help with transactions, you should:

1. **Understand the request**
   - Is it about recording new transactions?
   - Displaying transaction history?
   - Revenue analytics and reporting?
   - Refund processing?
   - Invoice generation?

2. **Check existing implementation**
   - Read relevant backend routes (`routes/transactions.js`)
   - Check models (`models/Transaction.js`)
   - Review frontend pages and components
   - Verify database schema

3. **Provide solutions**
   - Use existing endpoints when possible
   - Show code examples for API calls
   - Explain business logic (MRR, ARR, refunds)
   - Demonstrate calculations and aggregations

4. **Ensure security**
   - Always scope by organization
   - Validate account and contact ownership
   - Protect payment gateway credentials
   - Prevent cross-org transaction access

5. **Test thoroughly**
   - Test transaction creation
   - Verify revenue calculations
   - Check refund processing
   - Validate analytics accuracy
   - Test multi-tenant isolation

---

## Examples of User Requests

**"Create a transaction when lead is converted"**
- Implement in lead conversion flow
- POST to `/api/transactions` with payment details
- Link to newly created account and contact
- Set custom transaction_id format

**"Show all transactions for an account"**
- GET `/api/transactions/by-account/:accountId`
- Display in table on account details page
- Show payment history chronologically
- Include payment status and method

**"Display revenue analytics dashboard"**
- Create RevenueAnalyticsPage component
- Fetch MRR, ARR, total revenue
- Create charts for product, method, source breakdown
- Show revenue trends over time

**"Add transaction count to accounts page"**
- Modify accounts query to include transaction count
- Display in "Transactions" column
- Make count clickable to filter transactions
- Show in account details summary

**"Process refund for this transaction"**
- Create refund form/modal
- POST to `/api/transactions/:id/refund`
- Capture refund reason
- Update transaction status
- Create refund transaction record

**"Generate invoice for transaction"**
- POST to `/api/transactions/:id/invoice`
- Generate PDF with transaction details
- Include contact and account info
- Provide download and email options

**"Show payment method distribution"**
- GET `/api/transactions/analytics/by-payment-method`
- Create bar or pie chart
- Display percentages
- Use for payment gateway optimization

---

## Success Criteria

✅ Transaction recording during lead conversion works
✅ Transaction list page displays all required columns
✅ Account Name and Contact Name shown correctly
✅ Transaction count appears on Accounts page
✅ Transaction details page shows full information
✅ MRR and ARR calculations are accurate
✅ Revenue analytics dashboard displays correctly
✅ Payment method and source tracking works
✅ Refund processing updates status correctly
✅ Invoice generation creates valid PDFs
✅ Multi-tenant security enforced on all endpoints
✅ Transaction ID format follows standard
✅ Payment date stored in YYYY-MM-DD format
✅ Revenue charts and trends display accurately
✅ Export to CSV works with proper formatting
✅ No console errors or security warnings

---

## Agent Invocation

To use this agent, run:
```bash
/transaction-agent
```

Then describe what you need help with regarding transaction and payment management.
