# Agent: Reporting & Analytics System (B2C Software Licensing)

## Project Context

- **Project Name**: Uppal CRM2
- **Business Model**: B2C Software Licensing (Direct to Consumer)
- **Architecture**: Two-tier multi-tenant CRM
- **Backend**: Node.js + Express.js (Port 3000)
- **Frontend**: React + Vite (Port 3002)
- **Database**: PostgreSQL with RLS

## 🎯 Agent Purpose

This agent handles **ALL analytics, reporting, dashboards, and business intelligence** for the B2C CRM. It manages revenue analytics, sales performance, customer metrics, and custom report generation.

## 🔴 CRITICAL: Simplified B2C Model

**NO trials system, NO complex licensing - Keep it simple!**

**Business Flow:**
```
Lead → Contact → Account → Transaction
```

**What These Mean:**
- **Lead**: Potential customer (prospect)
- **Contact**: Actual customer (person who bought)
- **Account**: Software license for ONE device (identified by MAC address)
- **Transaction**: Payment/purchase record

**One Account = One Device License = One MAC Address**

## 📊 Core Responsibilities

### 1. Revenue Analytics
- Total Revenue (all time)
- Revenue This Month
- Revenue by Product (Gold, Jio, Smart)
- Revenue by Payment Method (credit card, PayPal, etc.)
- Revenue by Source (website, phone, email)
- Average Transaction Value
- Revenue Growth (Month-over-Month, Year-over-Year)
- Monthly Recurring Revenue (MRR)

### 2. Customer Metrics
- Total Contacts (customers)
- New Contacts This Month
- Active Contacts (customers with active accounts)
- Customer Lifetime Value (CLV)
- Customer Acquisition by Source
- Customer Retention Rate

### 3. Account Metrics
- Total Accounts (software licenses)
- Active Accounts (currently active licenses)
- Accounts by Product (Gold vs Jio vs Smart)
- Accounts by Billing Cycle (monthly, quarterly, etc.)
- Upcoming Renewals (next 30 days)
- Renewal Rate (% of accounts that renew)
- Cancelled Accounts

### 4. Sales Performance
- Lead-to-Contact Conversion Rate
- Conversion Time (days from lead creation to conversion)
- Sales by Team Member
- Sales by Source (which lead sources convert best)
- Pipeline Value
- New Leads (today/week/month)

### 5. Transaction Analytics
- Total Transactions
- Transactions This Month
- Payment Method Breakdown
- Transaction Source Breakdown
- Failed/Refunded Transactions
- Average Order Value

### 6. Product Performance
- Product Popularity (which products sell most)
- Revenue by Product
- Accounts by Product
- Product Growth Trends

### 7. Team Performance
- User Activity Tracking
- Sales by Team Member
- Conversion Rates by Team Member
- Performance Leaderboard

### 8. Dashboard Widgets
- Real-time KPI cards
- Interactive charts and graphs
- Trend visualization
- Data filtering and drill-down

### 9. Custom Reports
- Report Builder
- Saved Reports
- Scheduled Reports (future)
- Report Templates

### 10. Export Functionality
- CSV Export (UTF-8, comma-separated)
- PDF Export (future)
- Excel Export (future)

## 📁 Database Schema (Simplified Model)

### Organizations Table
```sql
organizations
├── id (primary key)
├── name
├── created_at
└── deleted_at
```

### Users Table (Team Members)
```sql
users
├── id (primary key)
├── organization_id (foreign key)
├── name
├── email
├── role
└── created_at
```

### Leads Table (Prospects)
```sql
leads
├── id (primary key)
├── organization_id (foreign key)
├── name
├── email
├── phone
├── source (website, phone, email, referral, etc.)
├── status (new, contacted, qualified, converted, lost)
├── created_at
├── converted_at
└── deleted_at
```

### Contacts Table (Customers)
```sql
contacts
├── id (primary key)
├── organization_id (foreign key)
├── name
├── email
├── phone
├── status (active, inactive)
├── created_at
└── deleted_at
```

### Products Table
```sql
products (software_editions in database - display as "Product" to users)
├── id (primary key)
├── organization_id (foreign key)
├── name (Gold, Jio, Smart)
├── monthly_price
├── quarterly_price
├── semi_annual_price
├── annual_price
├── description
└── created_at
```

### Accounts Table (Software Licenses)
```sql
accounts
├── id (primary key)
├── organization_id (foreign key)
├── contact_id (foreign key - who owns this license)
├── account_name (user-defined name like "manjit living room tv")
├── mac_address (device identifier - unique per account)
├── device_name (device type like "Mag", "Formuler", etc.)
├── product_id (foreign key to products - which product: Gold/Jio/Smart)
├── billing_cycle (monthly, quarterly, semi_annual, annual)
├── billing_term_months (1, 3, 6, 12)
├── created_at (when account was created)
├── next_renewal_date (calculated: created_at + billing_term_months)
├── status (active, cancelled)
└── deleted_at (soft delete)
```

**Key Points:**
- One account = one device = one MAC address
- Account name is user-defined (e.g., "living room tv", "bedroom device")
- next_renewal_date = created_at + billing_term_months
- NO trials table, NO complex licensing

### Transactions Table (Payments)
```sql
transactions
├── id (primary key)
├── organization_id (foreign key)
├── account_id (foreign key - which account this payment is for)
├── amount (payment amount)
├── payment_date (when payment was received)
├── payment_method (credit_card, paypal, bank_transfer, cash, etc.)
├── source (website, phone, email, in_person, etc.)
├── billing_cycle (monthly, quarterly, semi_annual, annual)
├── billing_term_months (1, 3, 6, 12)
├── status (completed, pending, refunded, voided)
├── deleted_at (soft delete)
└── is_void (boolean - voided transactions)
```

**Revenue Calculation:**
- Total Revenue = SUM(amount) WHERE deleted_at IS NULL AND is_void = FALSE
- Always exclude soft-deleted and voided transactions

## 🔢 Critical Revenue Calculations

### 1. Total Revenue (All Time)
```sql
SELECT SUM(amount) as total_revenue
FROM transactions
WHERE organization_id = ?
  AND deleted_at IS NULL
  AND is_void = FALSE
```

### 2. Revenue This Month
```sql
SELECT SUM(amount) as monthly_revenue
FROM transactions
WHERE organization_id = ?
  AND deleted_at IS NULL
  AND is_void = FALSE
  AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)
```

### 3. Revenue by Product
```sql
SELECT
  p.name as product_name,
  COUNT(t.id) as transaction_count,
  SUM(t.amount) as total_revenue
FROM transactions t
JOIN accounts a ON t.account_id = a.id
JOIN products p ON a.product_id = p.id
WHERE t.organization_id = ?
  AND t.deleted_at IS NULL
  AND t.is_void = FALSE
GROUP BY p.name
ORDER BY total_revenue DESC
```

### 4. Revenue by Payment Method
```sql
SELECT
  payment_method,
  COUNT(id) as transaction_count,
  SUM(amount) as total_revenue
FROM transactions
WHERE organization_id = ?
  AND deleted_at IS NULL
  AND is_void = FALSE
GROUP BY payment_method
ORDER BY total_revenue DESC
```

### 5. Monthly Revenue Trend (Last 12 Months)
```sql
SELECT
  DATE_TRUNC('month', payment_date) as month,
  SUM(amount) as revenue
FROM transactions
WHERE organization_id = ?
  AND deleted_at IS NULL
  AND is_void = FALSE
  AND payment_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', payment_date)
ORDER BY month ASC
```

### 6. Active Accounts Count
```sql
SELECT COUNT(*) as active_accounts
FROM accounts
WHERE organization_id = ?
  AND deleted_at IS NULL
  AND status = 'active'
```

### 7. Upcoming Renewals (Next 30 Days)
```sql
SELECT COUNT(*) as upcoming_renewals
FROM accounts
WHERE organization_id = ?
  AND deleted_at IS NULL
  AND status = 'active'
  AND next_renewal_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
```

### 8. Lead Conversion Rate
```sql
SELECT
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE status = 'converted') as converted_leads,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'converted')::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as conversion_rate_pct
FROM leads
WHERE organization_id = ?
  AND deleted_at IS NULL
```

### 9. Average Transaction Value
```sql
SELECT
  ROUND(AVG(amount), 2) as avg_transaction_value
FROM transactions
WHERE organization_id = ?
  AND deleted_at IS NULL
  AND is_void = FALSE
```

### 10. Customer Lifetime Value (CLV)
```sql
SELECT
  c.id,
  c.name,
  COUNT(DISTINCT a.id) as total_accounts,
  COUNT(t.id) as total_transactions,
  COALESCE(SUM(t.amount), 0) as lifetime_value
FROM contacts c
LEFT JOIN accounts a ON c.id = a.contact_id AND a.deleted_at IS NULL
LEFT JOIN transactions t ON a.id = t.account_id AND t.deleted_at IS NULL AND t.is_void = FALSE
WHERE c.organization_id = ?
  AND c.deleted_at IS NULL
GROUP BY c.id, c.name
ORDER BY lifetime_value DESC
```

## 📈 Dashboard Requirements

### Main Dashboard (Must Have)

#### KPI Cards (Top Row)
1. **Total Revenue** - All-time revenue sum
2. **Revenue This Month** - Current month revenue
3. **Total Customers** - Count of contacts
4. **Active Accounts** - Count of active licenses
5. **New Customers This Month** - Contacts created this month
6. **Upcoming Renewals** - Renewals in next 30 days

#### Charts (Below KPIs)
1. **Revenue Trend (Last 12 Months)** - Line chart showing monthly revenue
2. **Revenue by Product** - Pie chart (Gold vs Jio vs Smart)
3. **New Customers per Month** - Bar chart
4. **Payment Methods Breakdown** - Pie chart

### Sales Dashboard

**Metrics:**
- New Leads Today/This Week/This Month
- Lead Conversion Rate
- Pipeline Value (total potential value of active leads)
- Sales by Team Member
- Upcoming Renewals (next 7/30/60 days)
- Recent Transactions (last 10)

**Charts:**
- Lead Conversion Funnel
- Sales Performance by User
- Lead Sources Breakdown

### Customer Analytics Dashboard

**Metrics:**
- Total Customers
- Active Customers (with active accounts)
- Inactive Customers
- Customer Acquisition by Source
- Average Accounts per Customer
- Customer Retention Rate

**Charts:**
- New Customers Trend (monthly)
- Customer Lifetime Value Distribution
- Customers by Acquisition Source

### Account Analytics Dashboard

**Metrics:**
- Total Accounts
- Active Accounts
- Cancelled Accounts
- Accounts by Product
- Accounts by Billing Cycle
- Average Account Value

**Charts:**
- Account Growth Trend
- Product Distribution
- Billing Cycle Preferences
- Renewal Forecast

## 📋 Report Types

### 1. Revenue Report

**Filters:**
- Date Range (custom, last 7 days, last 30 days, last 90 days, last year)
- Product (all, Gold, Jio, Smart)
- Payment Method (all, credit card, PayPal, etc.)
- Source (all, website, phone, email, etc.)

**Columns:**
- Transaction Date
- Customer Name
- Product
- Amount
- Payment Method
- Source
- Status

**Summary:**
- Total Revenue
- Transaction Count
- Average Transaction Value
- Revenue by Product
- Revenue by Payment Method

**Export:** CSV

### 2. Customer Report

**Filters:**
- Date Range (customer creation date)
- Status (all, active, inactive)
- Source (all sources)

**Columns:**
- Customer Name
- Email
- Phone
- Total Accounts
- Active Accounts
- Lifetime Value
- First Purchase Date
- Last Purchase Date
- Source

**Summary:**
- Total Customers
- Active Customers
- Total Lifetime Value
- Average Lifetime Value
- Customers by Source

**Export:** CSV

### 3. Account Report

**Filters:**
- Date Range (account creation date)
- Product (all products)
- Status (all, active, cancelled)
- Billing Cycle (all cycles)

**Columns:**
- Account Name
- Customer Name
- MAC Address
- Product
- Billing Cycle
- Created Date
- Next Renewal Date
- Status

**Summary:**
- Total Accounts
- Active Accounts
- Accounts by Product
- Accounts by Billing Cycle
- Upcoming Renewals

**Export:** CSV

### 4. Transaction Report

**Filters:**
- Date Range (transaction date)
- Product (all products)
- Payment Method (all methods)
- Status (all, completed, pending, refunded)

**Columns:**
- Transaction Date
- Customer Name
- Account Name
- Product
- Amount
- Payment Method
- Source
- Status

**Summary:**
- Total Transactions
- Total Revenue
- Average Transaction Value
- Transactions by Status
- Revenue by Product
- Revenue by Payment Method

**Export:** CSV

### 5. Sales Performance Report

**Filters:**
- Date Range
- Team Member (all users)
- Source (all sources)

**Columns:**
- Team Member
- Total Leads
- Converted Leads
- Conversion Rate
- Total Sales
- Total Revenue
- Average Deal Size

**Summary:**
- Team Total Leads
- Team Conversion Rate
- Top Performer
- Total Team Revenue

**Export:** CSV

### 6. Lead Conversion Report

**Filters:**
- Date Range
- Source (all sources)
- Status (all statuses)

**Columns:**
- Lead Name
- Source
- Created Date
- Status
- Converted Date
- Days to Conversion
- Assigned User

**Summary:**
- Total Leads
- Converted Leads
- Conversion Rate
- Average Days to Conversion
- Conversion by Source

**Export:** CSV

## 📤 Export Functionality

### CSV Export

**Requirements:**
- UTF-8 encoding with BOM for Excel compatibility
- Comma-separated values
- Header row with column names
- Date format: YYYY-MM-DD
- Numbers without formatting symbols (no $ or ,)
- Proper escaping of commas and quotes in data

**Implementation:**
```javascript
// Backend: exportService.js
function exportToCSV(data, columns, filename) {
  const BOM = '\uFEFF'; // Byte Order Mark for UTF-8
  const header = columns.join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col] || '';
      // Escape commas and quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  const csv = BOM + header + '\n' + rows.join('\n');
  return csv;
}
```

### PDF Export (Future Enhancement)

**Requirements:**
- Branded header with company logo
- Report title and date range
- Formatted tables with proper alignment
- Page numbers
- Summary section at the end
- Generated timestamp

## 📊 Data Visualization

### Chart Libraries

**Primary:** Recharts (already available in React project)
- Line charts for trends
- Bar charts for comparisons
- Pie charts for breakdowns
- Area charts for cumulative data

**Chart Types:**

1. **Line Chart** - Revenue trend over time
2. **Bar Chart** - New customers per month
3. **Pie Chart** - Revenue by product, payment methods
4. **Area Chart** - Cumulative revenue growth
5. **Stacked Bar Chart** - Product performance over time

**Color Scheme:**
- Primary: #3b82f6 (blue)
- Success: #10b981 (green)
- Warning: #f59e0b (orange)
- Danger: #ef4444 (red)
- Info: #6366f1 (indigo)

### Chart Examples

**Revenue Trend Line Chart:**
```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

<LineChart data={monthlyRevenue} width={800} height={400}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="month" />
  <YAxis />
  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
  <Legend />
  <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
</LineChart>
```

**Revenue by Product Pie Chart:**
```jsx
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b'];

<PieChart width={400} height={400}>
  <Pie
    data={productRevenue}
    dataKey="revenue"
    nameKey="product"
    cx="50%"
    cy="50%"
    outerRadius={120}
    label
  >
    {productRevenue.map((entry, index) => (
      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
    ))}
  </Pie>
  <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
  <Legend />
</PieChart>
```

## ⚡ Performance Optimization

### Query Optimization

**Database Indexes (CRITICAL):**
```sql
-- Add these indexes for fast reporting queries
CREATE INDEX idx_transactions_org_payment_date ON transactions(organization_id, payment_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_org_account ON transactions(organization_id, account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_org_status ON accounts(organization_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_accounts_org_renewal ON accounts(organization_id, next_renewal_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_contacts_org_created ON contacts(organization_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_leads_org_status ON leads(organization_id, status) WHERE deleted_at IS NULL;
```

**Query Best Practices:**
1. Always filter by `organization_id` first (multi-tenant isolation)
2. Always filter by `deleted_at IS NULL` (exclude soft-deleted)
3. Always filter by `is_void = FALSE` for transactions
4. Use date ranges to limit data scanned
5. Use COUNT(*) FILTER instead of subqueries
6. Avoid SELECT * - only fetch needed columns
7. Use proper JOINs instead of multiple queries

### Caching Strategy

**Cache Durations:**
- Dashboard KPIs: 5 minutes (frequently changing)
- Reports: 15 minutes (less frequent changes)
- Current day data: No cache (real-time)
- Historical data (> 30 days): 1 hour (rarely changes)

**Implementation:**
```javascript
// Simple in-memory cache with TTL
const cache = new Map();

function getCacheKey(userId, reportType, filters) {
  return `${userId}:${reportType}:${JSON.stringify(filters)}`;
}

function getFromCache(key, ttlSeconds) {
  const cached = cache.get(key);
  if (!cached) return null;

  const now = Date.now();
  if (now - cached.timestamp > ttlSeconds * 1000) {
    cache.delete(key);
    return null;
  }

  return cached.data;
}

function setCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
}
```

### Pagination

**For Large Reports:**
```javascript
// API endpoint with pagination
app.get('/api/reports/transactions', async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;

  const result = await db.query(`
    SELECT * FROM transactions
    WHERE organization_id = $1
      AND deleted_at IS NULL
    ORDER BY payment_date DESC
    LIMIT $2 OFFSET $3
  `, [orgId, limit, offset]);

  const total = await db.query(`
    SELECT COUNT(*) FROM transactions
    WHERE organization_id = $1 AND deleted_at IS NULL
  `, [orgId]);

  res.json({
    data: result.rows,
    pagination: {
      page,
      limit,
      total: total.rows[0].count,
      pages: Math.ceil(total.rows[0].count / limit)
    }
  });
});
```

## 🗂️ File Structure

### Backend Files

```
backend/
├── controllers/
│   └── reportingController.js       # Main reporting controller
├── services/
│   ├── analyticsService.js          # Analytics calculations
│   ├── exportService.js             # CSV/PDF export logic
│   └── cacheService.js              # Caching utilities
├── routes/
│   └── reportingRoutes.js           # API routes
└── utils/
    └── dateHelpers.js               # Date range utilities
```

### Frontend Files

```
frontend/src/
├── pages/
│   ├── DashboardPage.jsx            # Main dashboard
│   ├── ReportsPage.jsx              # Reports hub
│   └── AnalyticsPage.jsx            # Advanced analytics
├── components/
│   ├── dashboard/
│   │   ├── KPICard.jsx              # KPI metric card
│   │   ├── RevenueChart.jsx         # Revenue line chart
│   │   ├── ProductChart.jsx         # Product pie chart
│   │   └── CustomerChart.jsx        # Customer bar chart
│   ├── reports/
│   │   ├── RevenueReport.jsx        # Revenue report component
│   │   ├── CustomerReport.jsx       # Customer report component
│   │   ├── AccountReport.jsx        # Account report component
│   │   ├── TransactionReport.jsx    # Transaction report component
│   │   └── ReportFilters.jsx        # Filter component
│   ├── charts/
│   │   ├── LineChart.jsx            # Reusable line chart
│   │   ├── BarChart.jsx             # Reusable bar chart
│   │   ├── PieChart.jsx             # Reusable pie chart
│   │   └── AreaChart.jsx            # Reusable area chart
│   └── exports/
│       └── ExportButton.jsx         # Export to CSV button
└── services/
    └── reportingService.js          # API calls
```

### Database Migrations

```
database/migrations/
└── 021_add_reporting_indexes.sql   # Performance indexes
```

## 🎨 UI/UX Design Principles

### 1. Simple First
- Start with basic metrics
- Add complexity only when needed
- Clear, understandable visualizations
- No jargon or technical terms

### 2. Accurate Data
- All numbers must be 100% correct
- Double-check calculations
- Clear data sources
- Transparent methodology

### 3. Fast Loading
- Reports load in < 3 seconds
- Use caching effectively
- Implement pagination for large datasets
- Show loading states

### 4. Visual Clarity
- Use charts to make data easy to understand
- Color-coded for quick insights
- Consistent design language
- Responsive layouts

### 5. Exportable
- Every report can export to CSV
- One-click export
- Proper formatting
- Filename includes date/time

### 6. Filtered & Secure
- Always exclude soft-deleted records
- Always exclude voided transactions
- Multi-tenant isolation (organization_id)
- Role-based access control

### 7. Mobile-Friendly
- Responsive dashboard
- Touch-friendly charts
- Simplified mobile view
- Key metrics always visible

## 🔐 Security & Data Isolation

### Multi-Tenant Isolation

**CRITICAL:** Every query MUST filter by organization_id

```javascript
// ❌ WRONG - Security vulnerability
const revenue = await db.query(`
  SELECT SUM(amount) FROM transactions
  WHERE deleted_at IS NULL
`);

// ✅ CORRECT - Properly isolated
const revenue = await db.query(`
  SELECT SUM(amount) FROM transactions
  WHERE organization_id = $1
    AND deleted_at IS NULL
    AND is_void = FALSE
`, [req.user.organization_id]);
```

### Role-Based Access

**Permissions:**
- **Admin**: Can view all reports, export all data
- **Manager**: Can view team reports, export limited data
- **User**: Can view own performance only

**Implementation:**
```javascript
function checkReportPermission(user, reportType) {
  const permissions = {
    'revenue': ['admin'],
    'sales': ['admin', 'manager'],
    'personal': ['admin', 'manager', 'user']
  };

  return permissions[reportType].includes(user.role);
}
```

## 📝 Common User Questions & Queries

### Revenue Questions
1. "How much revenue did we make this month?"
2. "What's our total revenue?"
3. "Which product generates the most revenue?"
4. "How does this month compare to last month?"
5. "What's our revenue growth rate?"

### Customer Questions
1. "How many customers do we have?"
2. "How many new customers this month?"
3. "Which customers have the highest lifetime value?"
4. "What's our customer retention rate?"
5. "Where do most customers come from?"

### Sales Questions
1. "What's our lead conversion rate?"
2. "Who's our top salesperson?"
3. "How long does it take to convert a lead?"
4. "Which lead sources convert best?"
5. "What's in our sales pipeline?"

### Account Questions
1. "How many active accounts do we have?"
2. "Which product is most popular?"
3. "How many accounts are renewing soon?"
4. "What's our renewal rate?"
5. "How many customers have multiple accounts?"

### Transaction Questions
1. "Which payment method is most popular?"
2. "How many transactions this month?"
3. "What's the average transaction value?"
4. "How many refunds did we process?"
5. "Show me recent transactions"

## 🚀 Implementation Priority

### Phase 1: Essential Dashboard (Week 1)
- [ ] KPI cards (6 core metrics)
- [ ] Revenue trend chart (12 months)
- [ ] Revenue by product pie chart
- [ ] Basic caching (5-minute TTL)
- [ ] Performance indexes

### Phase 2: Core Reports (Week 2)
- [ ] Revenue report with filters
- [ ] Customer report
- [ ] Transaction report
- [ ] CSV export functionality
- [ ] Report pagination

### Phase 3: Advanced Analytics (Week 3)
- [ ] Sales dashboard
- [ ] Lead conversion funnel
- [ ] Customer lifetime value
- [ ] Team performance metrics
- [ ] Advanced filters

### Phase 4: Enhancements (Week 4)
- [ ] Custom report builder
- [ ] Saved reports
- [ ] PDF export
- [ ] Scheduled reports
- [ ] Email delivery

## 🐛 Common Pitfalls to Avoid

### 1. Including Deleted Records
❌ WRONG:
```sql
SELECT SUM(amount) FROM transactions
```

✅ CORRECT:
```sql
SELECT SUM(amount) FROM transactions
WHERE deleted_at IS NULL AND is_void = FALSE
```

### 2. Forgetting Multi-Tenant Isolation
❌ WRONG:
```sql
SELECT * FROM accounts WHERE status = 'active'
```

✅ CORRECT:
```sql
SELECT * FROM accounts
WHERE organization_id = $1 AND status = 'active' AND deleted_at IS NULL
```

### 3. Not Using Indexes
❌ WRONG:
```sql
SELECT * FROM transactions
WHERE DATE_TRUNC('month', payment_date) = '2024-01-01'
```

✅ CORRECT (with index on payment_date):
```sql
SELECT * FROM transactions
WHERE organization_id = $1
  AND payment_date >= '2024-01-01'
  AND payment_date < '2024-02-01'
  AND deleted_at IS NULL
```

### 4. Slow Queries Without Limits
❌ WRONG:
```sql
SELECT * FROM transactions ORDER BY payment_date DESC
```

✅ CORRECT:
```sql
SELECT * FROM transactions
WHERE organization_id = $1 AND deleted_at IS NULL
ORDER BY payment_date DESC
LIMIT 100 OFFSET 0
```

### 5. Not Handling Null Values
❌ WRONG:
```sql
SELECT AVG(amount) FROM transactions
```

✅ CORRECT:
```sql
SELECT COALESCE(ROUND(AVG(amount), 2), 0) as avg_amount
FROM transactions
WHERE organization_id = $1 AND deleted_at IS NULL AND is_void = FALSE
```

## 📚 API Endpoints Reference

### Dashboard Endpoints

```javascript
// Get dashboard KPIs
GET /api/reporting/dashboard/kpis

// Get revenue trend (12 months)
GET /api/reporting/dashboard/revenue-trend?months=12

// Get revenue by product
GET /api/reporting/dashboard/revenue-by-product

// Get new customers trend
GET /api/reporting/dashboard/new-customers?months=6
```

### Report Endpoints

```javascript
// Revenue report
GET /api/reporting/reports/revenue?startDate=2024-01-01&endDate=2024-12-31&product=all

// Customer report
GET /api/reporting/reports/customers?status=active&page=1&limit=100

// Account report
GET /api/reporting/reports/accounts?product=Gold&status=active

// Transaction report
GET /api/reporting/reports/transactions?startDate=2024-01-01&endDate=2024-12-31

// Sales performance report
GET /api/reporting/reports/sales-performance?userId=123
```

### Export Endpoints

```javascript
// Export report to CSV
POST /api/reporting/export/csv
Body: {
  reportType: 'revenue',
  filters: { startDate: '2024-01-01', endDate: '2024-12-31' }
}
```

## ✅ Testing Checklist

### Dashboard Testing
- [ ] All 6 KPI cards display correct values
- [ ] Revenue trend chart shows 12 months of data
- [ ] Charts update when filters change
- [ ] Dashboard loads in < 3 seconds
- [ ] Mobile responsive layout works

### Report Testing
- [ ] Filters work correctly (date range, product, status)
- [ ] Pagination works (next/prev/goto page)
- [ ] Sorting works on all columns
- [ ] CSV export downloads with correct data
- [ ] Reports exclude deleted and voided records

### Performance Testing
- [ ] Queries execute in < 2 seconds
- [ ] Caching reduces database load
- [ ] Large datasets paginate correctly
- [ ] Indexes are being used (check EXPLAIN)
- [ ] No N+1 query problems

### Security Testing
- [ ] Multi-tenant isolation works (users only see their org data)
- [ ] Role-based access control enforced
- [ ] SQL injection prevention works
- [ ] Export file size limits enforced
- [ ] Rate limiting prevents abuse

## 🎯 Success Metrics

### For This Agent
- Dashboard loads in < 3 seconds
- All calculations are 100% accurate
- Reports generate in < 5 seconds
- CSV exports complete in < 10 seconds
- Zero data leakage between organizations
- 100% test coverage on critical calculations

### For Users
- Users can answer business questions instantly
- Executives have real-time visibility into revenue
- Sales team can track their performance
- Managers can identify trends and opportunities
- Data exports are clean and usable

## 🔄 Integration with Other Agents

### Account Agent
- Provides account data for account reports
- Renewal forecast data
- Product distribution metrics

### Contact Agent
- Provides customer data for customer reports
- Customer lifetime value calculations
- Customer acquisition metrics

### Transaction Agent
- Provides transaction data for revenue reports
- Payment method analytics
- Transaction trends

### Leads Agent
- Provides lead data for sales reports
- Conversion funnel metrics
- Lead source effectiveness

### Interactions Agent
- Provides activity data for team performance
- User productivity metrics
- Follow-up effectiveness

## 🎓 Learning Resources

### SQL Optimization
- Use EXPLAIN to understand query plans
- Index on frequently filtered columns
- Avoid SELECT * in production
- Use aggregate functions instead of application-level calculations

### Chart Best Practices
- Keep it simple - one message per chart
- Use appropriate chart types (line for trends, pie for breakdowns)
- Label axes clearly
- Use color to highlight important data

### Report Design
- Start with the question you're trying to answer
- Show the most important data first
- Provide context (comparisons, trends)
- Enable drill-down for details

---

## Quick Start Guide

### For New Developers

1. **Read this entire document** - Understand the simplified B2C model
2. **Check the database schema** - Know the tables and relationships
3. **Review existing queries** - Learn the patterns
4. **Test with real data** - Verify calculations are correct
5. **Add indexes** - Optimize for performance
6. **Implement caching** - Reduce database load

### Common Tasks

**Add a new KPI card:**
1. Write SQL query in analyticsService.js
2. Add endpoint in reportingController.js
3. Create KPICard component in frontend
4. Add to DashboardPage.jsx

**Create a new report:**
1. Design query with proper filters
2. Add API endpoint with pagination
3. Create report component with filters
4. Add CSV export functionality

**Add a new chart:**
1. Prepare data in correct format
2. Choose appropriate chart type
3. Create reusable chart component
4. Add to dashboard or report

---

## Remember

✅ **Always** filter by organization_id (multi-tenant)
✅ **Always** exclude deleted records (deleted_at IS NULL)
✅ **Always** exclude voided transactions (is_void = FALSE)
✅ **Always** use indexes for performance
✅ **Always** cache frequently accessed data
✅ **Always** validate calculations are 100% accurate

❌ **Never** expose data from other organizations
❌ **Never** run queries without organization_id filter
❌ **Never** forget to handle null values
❌ **Never** return all records without pagination
❌ **Never** skip testing with real data

---

**Agent Status:** Ready to implement comprehensive reporting and analytics for the B2C CRM! 🚀
