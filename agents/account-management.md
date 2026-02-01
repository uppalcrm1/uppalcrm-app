# Agent: Account Management System (B2C Software Licensing)

## Project Context

- **Project Name**: Uppal CRM2
- **Business Model**: B2C Software Licensing (Direct to Consumer)
- **Architecture**: Two-tier multi-tenant CRM
- **Backend**: Node.js + Express.js (Port 3000)
- **Frontend**: React + Vite (Port 3002)
- **Database**: PostgreSQL with RLS

## ⚠️ CRITICAL TERMINOLOGY STANDARD ⚠️

**USER-FACING vs DATABASE TERMINOLOGY:**

🔴 **ALWAYS USE "PRODUCT" IN USER-FACING TEXT**
- ✅ User sees: "Product" (Gold, Jio, Smart)
- ✅ UI labels: "Product", "Product Name", "Select Product"
- ✅ Table headers: "Product", "Product Type"
- ✅ Form fields: "Product" dropdown
- ✅ Buttons: "Change Product", "Upgrade Product"

🟡 **KEEP "SOFTWARE_EDITIONS" IN DATABASE/CODE**
- ✅ Database table: `software_editions` (internal only, NEVER show to users)
- ✅ Foreign keys: `software_edition_id`
- ✅ Code variables: `edition`, `softwareEdition` (internal use only)
- ✅ API fields: Can be `software_edition` or `product` (either is fine)
- ⚠️ **IMPORTANT**: Add code comment: `// Display as 'Product' to users`

**EXAMPLES:**

❌ **WRONG** (User-facing):
```jsx
<TableHeader>Software Edition</TableHeader>
<FormLabel>Select Edition</FormLabel>
<Dropdown label="Edition Name" />
```

✅ **CORRECT** (User-facing):
```jsx
<TableHeader>Product</TableHeader>
<FormLabel>Select Product</FormLabel>
<Dropdown label="Product" />
```

✅ **CORRECT** (Database/Internal):
```javascript
// Database query (internal)
const account = await db.query(
  'SELECT software_edition_id FROM accounts WHERE id = ?',
  [accountId]
);

// API response field (internal - will map to "Product" in UI)
const response = {
  account_id: '123',
  software_edition: 'Gold', // Display as "Product" to users
  billing_cycle: 'monthly'
};
```

**MAPPING GUIDE:**

| Database/Code (Internal) | User-Facing Display | Notes |
|--------------------------|---------------------|-------|
| `software_editions` table | "Product" | Table name stays same |
| `software_edition_id` | "Product" dropdown | Foreign key stays same |
| `edition_name` field | "Product Name" | Display label changes |
| "Software Edition" label | "Product" label | UI text changes |
| "Edition: Gold" | "Product: Gold" | Display text changes |
| API: `software_edition` | UI: "Product" | API field can stay, just change UI |

**WHY THIS MATTERS:**
- Users understand "Product" better than "Software Edition"
- Keeps UI simple and clear
- Database schema can stay technical
- Easier for non-technical users

## Critical Business Understanding 🎯

**This is NOT a B2B CRM - It's B2C Software Licensing:**

- We sell software licenses to **individual customers**, NOT businesses
- One Contact (customer) → Multiple Accounts (licenses/devices)
- One Account = One Software License = One Device (MAC address)
- Focus: Individual device licensing, trials, renewals, transfers

**Revenue Model:**
- Subscription-based licensing (Monthly, Quarterly, Semi-Annual, Annual)
- 24-hour free trials (unlimited per customer per product)
- Device-specific activation (MAC address binding)
- Automated renewal tracking

## What Already Exists ✅

- ✅ Contacts table (individual customers)
- ✅ Accounts table (device/license records)
- ✅ Products catalog - software_editions table (Gold, Jio, Smart) - Display as "Product" to users
- ✅ Device registrations table (MAC addresses)
- ✅ Software licenses table (active licenses)
- ✅ Trials table (24-hour trial management)
- ✅ License transfers table (device transfer history)
- ✅ Transactions table (payment records)
- ✅ Authentication and multi-tenant security
- ✅ Contact management system
- ✅ **Server-side search with client-side debouncing** (Jan 30, 2026)

## Your Mission 🎯

As the Account Management Agent, you help users with:

### 1. Account Lifecycle Management
   - Creating new accounts (license + device binding)
   - Account activation after payment
   - Account renewal processing
   - Account expiration handling
   - Account cancellation and refunds

### 2. Product Management (Database: software_editions)
   - Managing product catalog (Gold, Jio, Smart) - Display as "Product" to users
   - Pricing by billing cycle
   - Feature set configuration
   - Product upgrades/downgrades

### 3. Device Registration & MAC Address Binding
   - Registering customer devices
   - Validating MAC addresses
   - Enforcing one device per account
   - Device replacement workflow

### 4. Billing Cycle Management
   - Monthly subscriptions
   - Quarterly subscriptions
   - Semi-annual subscriptions
   - Annual subscriptions
   - Pro-rated billing calculations

### 5. License Generation & Validation
   - Generating unique license keys
   - Activating licenses on devices
   - Validating license authenticity
   - License status tracking (active, trial, expired, cancelled)

### 6. Trial Management (24-hour trials)
   - Creating trial accounts
   - Unlimited trials per customer per product
   - Trial expiration tracking
   - Trial-to-paid conversion

### 7. License Transfer System
   - Free transfers between customer's own devices
   - Time loss calculations (proportional to remaining period)
   - Transfer history tracking
   - Transfer limit enforcement (if any)

### 8. Renewal Tracking & Alerts
   - 30-day advance renewal notices
   - 14-day renewal reminders
   - 7-day urgent reminders
   - 1-day final notices
   - Auto-renewal processing

### 9. Account Analytics
   - Active licenses count
   - Trial conversion rates
   - Renewal rates by product
   - Churn analysis
   - MRR (Monthly Recurring Revenue)
   - ARR (Annual Recurring Revenue)

---

## 🚨 FIRST TASK: Terminology Audit & Bug Analysis 🚨

**BEFORE implementing any new features, you MUST:**

### Step 1: Audit Current Terminology Usage

Search the entire codebase for these terms and categorize each instance:

**Search Terms:**
- "Software Edition"
- "Edition" (be careful - could be legitimate use in other contexts)
- "software_edition"
- "edition_name"
- "edition_id"
- "softwareEdition"

**Files to Check:**
- `frontend/src/pages/AccountsPage.jsx` or `Accounts.jsx`
- `frontend/src/pages/AccountDetailsPage.jsx` or `AccountDetails.jsx`
- `frontend/src/components/accounts/*.jsx`
- `frontend/src/services/api.js`
- `backend/routes/accounts.js`
- `backend/models/Account.js`
- `backend/controllers/accountController.js` (if exists)

**Categorize Each Instance:**

| File | Line | Current Text | Category | Recommended Change |
|------|------|--------------|----------|-------------------|
| Example.jsx | 45 | "Software Edition" | User-facing label | Change to "Product" |
| accounts.js | 120 | software_edition_id | Database query | Keep as-is, add comment |
| api.js | 78 | edition: data.edition | API field | Keep, map to "Product" in UI |

### Step 2: Identify Root Causes of Broken Features

**Required Columns for Accounts Page:**

Based on the specification, the Accounts page MUST display these columns:

| Column | What to Show | Why It's Valuable | Example |
|--------|--------------|-------------------|---------|
| Account Name | Account name from lead conversion | Account identification | "manjit living room tv" |
| MAC Address | MAC Address from lead conversion | Helps identify account info | "00:1A:79:12:32:43" |
| Device | Device Name from lead conversion | Device identification | "Mag" |
| Product | Product selected during lead conversion | Product type | "Gold" |
| Contact | Contact name via Account→Contact relationship | Basic identity | "manjit singh" |
| Accounts | Number of Accounts for this Contact | Shows total accounts per customer | "3" |
| Transactions | Number of Transactions for THIS account only | Shows payment history | "10" |
| Created Date | Date this account was created | Helps identify age of account | "Jan 22, 2024" |
| Next Renewal | Calculated: created_date + billing_term | Customer outreach timing | "July 22, 2025" |
| Actions | View/Edit/Delete buttons | Management | Icons ✓ |

**Current Issues to Investigate:**

1. **Account Name Column**
   - Check: Is `account_name` field being fetched from accounts table?
   - Check: Is this field being populated during lead conversion?
   - Check: Frontend mapping - is it using correct field name?
   - Expected: User-defined name like "manjit living room tv"

2. **MAC Address Column**
   - Check: Is `mac_address` field being fetched?
   - Check: Is this field being populated during lead conversion?
   - Check: Frontend display formatting (XX:XX:XX:XX:XX:XX)
   - Expected: "00:1A:79:12:32:43"

3. **Device Column**
   - Check: Is `device_name` being fetched from accounts or device_registrations?
   - Check: Is this field being populated during lead conversion?
   - Check: Frontend mapping and display
   - Expected: Device name like "Mag"

4. **Product Column is Blank**
   - Check: Is `software_edition_id` being fetched?
   - Check: Is the JOIN to `software_editions` table working?
   - Check: Are we returning product name in the API response?
   - Check: Is the frontend mapping the response correctly?
   - Expected: Display "Gold", "Jio", or "Smart" (Display as "Product" to users)

5. **Contact Column is Blank**
   - Check: Is `contact_id` being fetched?
   - Check: Is the JOIN to `contacts` table working?
   - Check: Are we returning contact name (first_name + last_name) in API response?
   - Check: Is the frontend mapping correctly?
   - Expected: "manjit singh" (first_name + " " + last_name)

6. **Accounts Column (Count)**
   - Check: Is there a COUNT of accounts for this contact?
   - Check: Is this being calculated in backend or frontend?
   - Implementation: `SELECT COUNT(*) FROM accounts WHERE contact_id = ?`
   - Expected: Number like "3" showing total accounts for this customer

7. **Transactions Column (Count)**
   - Check: Is there a COUNT of transactions for THIS specific account?
   - Check: NOT the total transactions for the contact, but for THIS account only
   - Implementation: `SELECT COUNT(*) FROM transactions WHERE account_id = ?`
   - Expected: Number like "10" showing transactions for this account

8. **Created Date Column**
   - Check: Is `created_at` field being fetched?
   - Check: Date formatting in frontend (MM/DD/YYYY or other format)
   - Check: Timezone handling (UTC vs local)
   - Expected: "Jan 22, 2024"

9. **Next Renewal Column is Blank**
   - Check: Is `created_at` being fetched?
   - Check: Is `billing_cycle` being fetched?
   - **CALCULATION REQUIRED**: created_date + billing_term
     - Example: Created Jan 01, 2025 + 6 months = Next Renewal July 01, 2025
     - Monthly: created_at + 1 month
     - Quarterly: created_at + 3 months
     - Semi-Annual: created_at + 6 months
     - Annual: created_at + 12 months
   - Check: Is this calculated in backend or frontend?
   - Check: Are we storing `expires_at` or calculating on-the-fly?
   - Expected: "July 22, 2025"

10. **Actions Column**
    - Check: Are View/Edit/Delete actions implemented?
    - Check: Icon/button display
    - Expected: Action icons or buttons

### Step 3: Create Implementation Plan

**For each issue, provide:**

1. **File Path** - Exact file to modify
2. **Current Code** - What's there now (with line numbers)
3. **Proposed Fix** - What to change it to
4. **Explanation** - Why this fixes the issue
5. **Test Case** - How to verify it works

**Example Format:**

```
ISSUE: Product Column is Blank
------------------------------
ROOT CAUSE: API response not including software_editions JOIN or frontend not mapping correctly

FILE: backend/routes/accounts.js

CURRENT CODE (Backend):
```javascript
const accounts = await db.query(`
  SELECT a.* FROM accounts a
  WHERE a.organization_id = $1
`, [orgId]);
```

PROPOSED FIX (Backend):
```javascript
const accounts = await db.query(`
  SELECT
    a.id,
    a.account_name,
    a.mac_address,
    a.device_name,
    a.contact_id,
    a.created_at,
    a.billing_cycle,
    se.name as product_name,  -- Display as "Product" to users (from software_editions table)
    CONCAT(c.first_name, ' ', c.last_name) as contact_name,
    (SELECT COUNT(*) FROM accounts WHERE contact_id = a.contact_id) as account_count,
    (SELECT COUNT(*) FROM transactions WHERE account_id = a.id) as transaction_count
  FROM accounts a
  LEFT JOIN software_editions se ON a.software_edition_id = se.id
  LEFT JOIN contacts c ON a.contact_id = c.id
  WHERE a.organization_id = $1
  ORDER BY a.created_at DESC
`, [orgId]);
```

FILE: frontend/src/pages/AccountsPage.jsx

CURRENT CODE (Frontend):
```jsx
<TableHeader>Software Edition</TableHeader>
...
<TableCell>{account.software_edition}</TableCell>
```

PROPOSED FIX (Frontend):
```jsx
<TableHeader>Product</TableHeader>  {/* Changed from "Software Edition" to "Product" */}
...
<TableCell>{account.product_name || 'N/A'}</TableCell>  {/* Maps to software_editions.name */}
```

TEST CASE:
1. Open Accounts page
2. Verify "Product" column header shows (not "Software Edition")
3. Verify product names (Gold, Jio, Smart) appear in rows
4. Verify no blank cells in Product column
5. Example row should show: "Gold" or "Jio" or "Smart"
```

---

**Another Example:**

```
ISSUE: Next Renewal Column is Blank
-------------------------------------
ROOT CAUSE: Not calculating expiry date based on created_at + billing_cycle

FILE: backend/routes/accounts.js

PROPOSED FIX (Backend - Add to SELECT):
```javascript
CASE
  WHEN a.billing_cycle = 'monthly' THEN a.created_at + INTERVAL '1 month'
  WHEN a.billing_cycle = 'quarterly' THEN a.created_at + INTERVAL '3 months'
  WHEN a.billing_cycle = 'semi_annual' THEN a.created_at + INTERVAL '6 months'
  WHEN a.billing_cycle = 'annual' THEN a.created_at + INTERVAL '12 months'
END as next_renewal_date
```

OR (Frontend - Calculate in JavaScript):
```javascript
const calculateNextRenewal = (createdDate, billingCycle) => {
  const created = new Date(createdDate);
  const renewal = new Date(created);

  switch(billingCycle) {
    case 'monthly':
      renewal.setMonth(renewal.getMonth() + 1);
      break;
    case 'quarterly':
      renewal.setMonth(renewal.getMonth() + 3);
      break;
    case 'semi_annual':
      renewal.setMonth(renewal.getMonth() + 6);
      break;
    case 'annual':
      renewal.setFullYear(renewal.getFullYear() + 1);
      break;
  }

  return renewal.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }); // Returns "July 22, 2025"
};
```

FILE: frontend/src/pages/AccountsPage.jsx
```jsx
<TableCell>
  {calculateNextRenewal(account.created_at, account.billing_cycle)}
</TableCell>
```

TEST CASE:
1. Create account on Jan 01, 2025 with 6-month billing cycle
2. Verify Next Renewal shows "July 01, 2025"
3. Create account on Jan 22, 2024 with monthly billing cycle
4. Verify Next Renewal shows "Feb 22, 2024"
```

### Step 4: Create Terminology Replacement Checklist

**Provide a checklist like this:**

- [ ] **AccountsPage.jsx**
  - [ ] Line 34: Change "Software Edition" header to "Product"
  - [ ] Line 89: Change "Edition" filter label to "Product"
  - [ ] Line 120: Add comment `// Display as "Product" to users`

- [ ] **AccountDetailsPage.jsx**
  - [ ] Line 45: Change "Software Edition:" to "Product:"
  - [ ] Line 67: Change "Upgrade Edition" button to "Upgrade Product"

- [ ] **CreateAccountForm.jsx**
  - [ ] Line 23: Change "Select Edition" to "Select Product"
  - [ ] Line 56: Keep `software_edition_id` (database field)

- [ ] **api.js**
  - [ ] Line 78: Keep `software_edition` field (API)
  - [ ] Add comment: `// Maps to "Product" in UI`

### Step 5: Risk Assessment

**Identify potential breaking changes:**

1. **API Backward Compatibility**
   - Are external systems using our API?
   - Should we support both `software_edition` AND `product` fields?
   - Migration plan for API consumers

2. **Database Changes**
   - Do we need to add any new columns?
   - Do we need to modify existing queries?
   - Will this affect existing data?

3. **Frontend Impact**
   - Will this break existing components?
   - Do we need to update prop names?
   - Will this affect routing or navigation?

4. **Testing Requirements**
   - What needs to be regression tested?
   - Do we need to update test fixtures?
   - What are the critical user flows to test?

---

## DELIVERABLE FORMAT

When the user activates this agent, provide:

1. **Audit Report**: List of all instances found (in table format)
2. **Root Cause Analysis**: For each of the 5 bugs (Product blank, Contact blank, undefinedd, Monthly Cost 0, Next Renewal blank)
3. **Implementation Plan**: Step-by-step fixes with code snippets
4. **Replacement Checklist**: File-by-file terminology changes
5. **Risk Assessment**: Potential issues and mitigation

**DO NOT IMPLEMENT AUTOMATICALLY** - Wait for user approval after presenting the plan.

---

## Backend Architecture

### Routes: `routes/accounts.js`

**Account CRUD:**
- `GET /api/accounts` - List accounts with pagination and filtering
- `GET /api/accounts/stats` - Get account statistics (MRR, ARR, active licenses)
- `GET /api/accounts/:id` - Get specific account details
- `POST /api/accounts` - Create new account (license + device)
- `PUT /api/accounts/:id` - Update account information
- `PUT /api/accounts/:id/status` - Update account status (activate, cancel, expire)
- `DELETE /api/accounts/:id` - Delete account (admin only)

**License Management:**
- `GET /api/accounts/:id/license` - Get account's active license
- `POST /api/accounts/:id/activate` - Activate license on device
- `GET /api/accounts/:id/validate` - Validate license status
- `POST /api/accounts/:id/renew` - Renew account subscription

**Device Management:**
- `GET /api/accounts/:id/device` - Get account's registered device
- `PUT /api/accounts/:id/device` - Update device information
- `POST /api/accounts/:id/transfer` - Transfer license to new device

**Trial Management:**
- `POST /api/accounts/trials` - Create 24-hour trial account
- `GET /api/accounts/trials/:id` - Get trial account details
- `POST /api/accounts/trials/:id/convert` - Convert trial to paid account

**Billing & Renewals:**
- `GET /api/accounts/:id/billing` - Get billing information
- `PUT /api/accounts/:id/billing` - Update billing cycle
- `GET /api/accounts/:id/renewal-date` - Calculate next renewal date
- `GET /api/accounts/expiring` - Get accounts expiring soon

**Products (Database: software_editions - Display as "Product" to users):**
- `GET /api/accounts/editions` - Get available products with pricing
- `GET /api/accounts/editions/:id` - Get product details
- `POST /api/accounts/:id/upgrade` - Upgrade to higher product tier
- `POST /api/accounts/:id/downgrade` - Downgrade to lower product tier

**Transfer Management:**
- `GET /api/accounts/:id/transfers` - Get transfer history
- `POST /api/accounts/:id/transfers` - Initiate device transfer
- `GET /api/accounts/:id/transfers/calculate-loss` - Calculate time loss

**Analytics:**
- `GET /api/accounts/analytics/mrr` - Monthly Recurring Revenue
- `GET /api/accounts/analytics/arr` - Annual Recurring Revenue
- `GET /api/accounts/analytics/churn` - Churn rate analysis
- `GET /api/accounts/analytics/trials` - Trial conversion metrics

### ⚠️ CRITICAL: Route File Identification (Jan 30, 2026)

**Active Route File:** `routes/accounts-simple.js` (NOT `routes/accounts.js`)

- Line 76 in `server.js`: `const accountRoutes = require('./routes/accounts-simple');`
- When implementing account features, always use `accounts-simple.js`
- The `accounts.js` file exists but is NOT being used as the active route
- This is the active endpoint being called by the frontend

### Search Implementation in Accounts (Jan 30, 2026)

**Frontend** (`frontend/src/pages/AccountsPage.jsx`):
```javascript
import { useDebouncedValue } from '../hooks/useDebouncedValue';

// Add debounced search hook (300ms delay)
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebouncedValue(searchTerm, 300);

// Use debouncedSearch in query parameters
const fetchAccounts = useCallback(async (page = 1) => {
  const response = await accountsAPI.getAccounts({
    search: debouncedSearch,
    page,
    limit: 20,
    t: Date.now() // Cache-busting timestamp
  });
  // ...
}, [debouncedSearch]);
```

**Backend** (`routes/accounts-simple.js` lines 82-95):
```javascript
// Extract search parameter from query
const { search, status, limit, offset } = req.query;

// Add ILIKE filtering for case-insensitive search
if (search && search.trim()) {
  query += ` AND (
    a.account_name ILIKE $${params.length + 1} OR
    a.mac_address ILIKE $${params.length + 1} OR
    c.first_name ILIKE $${params.length + 1} OR
    c.last_name ILIKE $${params.length + 1} OR
    c.email ILIKE $${params.length + 1} OR
    c.company ILIKE $${params.length + 1} OR
    a.edition ILIKE $${params.length + 1}
  )`;
  params.push(`%${search}%`);
}
```

**Search Fields:**
- Account name
- MAC address (device identifier)
- Contact first name
- Contact last name
- Contact email
- Contact company
- Product edition name

**Key Features:**
- **300ms debounce delay** - Prevents excessive API calls while typing
- **Case-insensitive matching** - Uses PostgreSQL `ILIKE` operator
- **Multi-field search** - Searches across 7 different fields
- **Cache-busting** - Includes timestamp parameter to bypass HTTP caching

### Model: `models/Account.js`

The Account model should provide methods for:
- `findByOrganization()` - Query accounts with filters
- `findByContact()` - Get all accounts for a customer
- `findById()` - Get single account
- `create()` - Create new account (license + device binding)
- `update()` - Update account
- `delete()` - Remove account
- `getStats()` - Get organization statistics (MRR, ARR, active count)
- `activate()` - Activate account after payment
- `cancel()` - Cancel account subscription
- `renew()` - Renew account for next billing cycle
- `checkExpiration()` - Check if account expired
- `calculateRenewalDate()` - Calculate next renewal date
- `validateLicense()` - Validate license authenticity
- `registerDevice()` - Bind account to device MAC address
- `transferToDevice()` - Transfer license to new device (with time loss)
- `createTrial()` - Create 24-hour trial
- `convertTrial()` - Convert trial to paid account
- `upgrade()` - Upgrade to higher product tier
- `downgrade()` - Downgrade to lower product tier
- `getTransferHistory()` - Get device transfer history
- `calculateTimeLoss()` - Calculate time loss on transfer
- `getExpiringAccounts()` - Get accounts expiring soon
- `sendRenewalAlert()` - Send renewal notification

---

## Frontend Architecture

### Pages

**AccountsPage.jsx** (`frontend/src/pages/AccountsPage.jsx`)
- Main accounts list view
- Filtering by status (active, trial, expired, cancelled)
- Filtering by product (Gold, Jio, Smart) - Display as "Product" to users
- Filtering by billing cycle
- Search functionality (customer name, device, license key)
- Pagination
- View account details
- Renewal date indicators
- Expiry warnings (color-coded)

**AccountDetailsPage.jsx** (`frontend/src/pages/AccountDetailsPage.jsx`)
- Full account information
- Customer details (linked to contact)
- Product and features - Display as "Product" to users (Database: software_edition)
- Device information (MAC address, OS, last seen)
- License key display
- Billing cycle and pricing
- Renewal date countdown
- Payment history
- Transfer history
- Actions: Renew, Cancel, Transfer, Upgrade/Downgrade

**TrialsPage.jsx** (`frontend/src/pages/TrialsPage.jsx`)
- Active trials dashboard
- Trial expiration countdowns
- Trial-to-paid conversion workflow
- Trial usage statistics

**RenewalsPage.jsx** (`frontend/src/pages/RenewalsPage.jsx`)
- Upcoming renewals calendar
- Overdue accounts
- Renewal reminders sent
- Quick renewal actions

### Components

**AccountCard.jsx** (`frontend/src/components/accounts/AccountCard.jsx`)
- Compact account display
- Status badge (active, trial, expired)
- Product badge (Gold, Jio, Smart) - Display as "Product" to users
- Expiry countdown
- Quick actions (renew, view details)

**LicenseKeyDisplay.jsx** (`frontend/src/components/accounts/LicenseKeyDisplay.jsx`)
- Secure license key display
- Copy to clipboard
- QR code generation
- Download license file

**DeviceInfo.jsx** (`frontend/src/components/accounts/DeviceInfo.jsx`)
- Device details display
- MAC address
- OS information
- Last active timestamp
- Transfer device button

**RenewalAlert.jsx** (`frontend/src/components/accounts/RenewalAlert.jsx`)
- Color-coded alerts (green > 30 days, yellow 7-30 days, red < 7 days)
- Days remaining display
- Quick renew button

**BillingCycleSelector.jsx** (`frontend/src/components/accounts/BillingCycleSelector.jsx`)
- Monthly, Quarterly, Semi-Annual, Annual options
- Price display for each option
- Savings percentage for longer cycles

### API Service: `frontend/src/services/api.js`

Account-related API methods:
```javascript
export const accountsAPI = {
  // CRUD
  getAccounts: (params) => api.get('/accounts', { params }),
  getAccountStats: () => api.get('/accounts/stats'),
  getAccount: (id) => api.get(`/accounts/${id}`),
  createAccount: (data) => api.post('/accounts', data),
  updateAccount: (id, data) => api.put(`/accounts/${id}`, data),
  updateAccountStatus: (id, status) => api.put(`/accounts/${id}/status`, { status }),
  deleteAccount: (id) => api.delete(`/accounts/${id}`),

  // License Management
  getAccountLicense: (id) => api.get(`/accounts/${id}/license`),
  activateLicense: (id, deviceData) => api.post(`/accounts/${id}/activate`, deviceData),
  validateLicense: (id) => api.get(`/accounts/${id}/validate`),
  renewAccount: (id, billingData) => api.post(`/accounts/${id}/renew`, billingData),

  // Device Management
  getAccountDevice: (id) => api.get(`/accounts/${id}/device`),
  updateDevice: (id, deviceData) => api.put(`/accounts/${id}/device`, deviceData),
  transferDevice: (id, newDeviceData) => api.post(`/accounts/${id}/transfer`, newDeviceData),

  // Trial Management
  createTrial: (data) => api.post('/accounts/trials', data),
  getTrial: (id) => api.get(`/accounts/trials/${id}`),
  convertTrial: (id, paymentData) => api.post(`/accounts/trials/${id}/convert`, paymentData),

  // Billing
  getBillingInfo: (id) => api.get(`/accounts/${id}/billing`),
  updateBillingCycle: (id, cycle) => api.put(`/accounts/${id}/billing`, { cycle }),
  getRenewalDate: (id) => api.get(`/accounts/${id}/renewal-date`),
  getExpiringAccounts: (days) => api.get('/accounts/expiring', { params: { days } }),

  // Products (Display as "Product" to users - Database: software_editions)
  getEditions: () => api.get('/accounts/editions'), // Internal - maps to "Products" in UI
  getEdition: (id) => api.get(`/accounts/editions/${id}`), // Internal - maps to "Product" in UI
  upgradeAccount: (id, editionId) => api.post(`/accounts/${id}/upgrade`, { editionId }),
  downgradeAccount: (id, editionId) => api.post(`/accounts/${id}/downgrade`, { editionId }),

  // Transfers
  getTransferHistory: (id) => api.get(`/accounts/${id}/transfers`),
  calculateTransferLoss: (id, newDeviceData) =>
    api.get(`/accounts/${id}/transfers/calculate-loss`, { params: newDeviceData }),

  // Analytics
  getMRR: () => api.get('/accounts/analytics/mrr'),
  getARR: () => api.get('/accounts/analytics/arr'),
  getChurnRate: () => api.get('/accounts/analytics/churn'),
  getTrialMetrics: () => api.get('/accounts/analytics/trials'),
}
```

---

## Database Schema

### accounts table
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- License Information (Display software_edition as "Product" to users)
  software_edition_id UUID NOT NULL REFERENCES software_editions(id), -- Display as "Product" in UI
  license_key VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) DEFAULT 'trial' CHECK (status IN ('active', 'trial', 'expired', 'cancelled', 'suspended')),

  -- Device Binding
  device_id UUID REFERENCES device_registrations(id),
  mac_address VARCHAR(17) NOT NULL,

  -- Billing Information
  billing_cycle VARCHAR(50) NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',

  -- Dates
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,

  -- Trial Management
  is_trial BOOLEAN DEFAULT false,
  trial_started_at TIMESTAMP WITH TIME ZONE,
  trial_expires_at TIMESTAMP WITH TIME ZONE,
  converted_from_trial_at TIMESTAMP WITH TIME ZONE,

  -- Renewal Tracking
  auto_renew BOOLEAN DEFAULT true,
  renewal_alert_sent BOOLEAN DEFAULT false,
  renewal_alert_sent_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_trial CHECK (
    (is_trial = true AND trial_expires_at IS NOT NULL) OR
    (is_trial = false)
  )
);

-- Indexes for performance
CREATE INDEX idx_accounts_organization ON accounts(organization_id);
CREATE INDEX idx_accounts_contact ON accounts(contact_id);
CREATE INDEX idx_accounts_status ON accounts(status);
CREATE INDEX idx_accounts_expires_at ON accounts(expires_at);
CREATE INDEX idx_accounts_mac_address ON accounts(mac_address);
CREATE INDEX idx_accounts_license_key ON accounts(license_key);
```

### software_editions table
**⚠️ IMPORTANT: Always display as "Product" to users, NEVER as "Software Edition" or "Edition"**

```sql
-- INTERNAL TABLE NAME: software_editions
-- USER-FACING LABEL: "Product" (Gold, Jio, Smart)
CREATE TABLE software_editions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Product Details (Display as "Product" to users)
  name VARCHAR(100) NOT NULL, -- 'Gold', 'Jio', 'Smart' - Display as "Product Name"
  display_name VARCHAR(255) NOT NULL, -- Display as "Product"
  description TEXT, -- Display as "Product Description"

  -- Pricing by Billing Cycle
  price_monthly DECIMAL(10,2) NOT NULL,
  price_quarterly DECIMAL(10,2),
  price_semi_annual DECIMAL(10,2),
  price_annual DECIMAL(10,2),

  -- Features (JSONB for flexibility)
  features JSONB, -- e.g., {"max_users": 10, "storage_gb": 100, "api_calls": 10000}

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_trial_available BOOLEAN DEFAULT true,
  trial_duration_hours INTEGER DEFAULT 24,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### device_registrations table
```sql
CREATE TABLE device_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Device Information
  device_name VARCHAR(255),
  mac_address VARCHAR(17) UNIQUE NOT NULL,

  -- System Information
  os_name VARCHAR(100),
  os_version VARCHAR(100),
  os_arch VARCHAR(50),
  device_type VARCHAR(100), -- 'Desktop', 'Laptop', 'Server'

  -- Hardware Information (JSONB)
  hardware_info JSONB, -- CPU, RAM, Disk, etc.

  -- Network Information
  ip_address VARCHAR(45),
  hostname VARCHAR(255),

  -- Activity Tracking
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activation_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_registrations_mac ON device_registrations(mac_address);
CREATE INDEX idx_device_registrations_contact ON device_registrations(contact_id);
```

### accounts table
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- License Association
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  software_edition_id UUID NOT NULL REFERENCES software_editions(id),
  device_id UUID REFERENCES device_registrations(id),

  -- License Key
  license_key VARCHAR(255) UNIQUE NOT NULL,
  activation_key VARCHAR(255), -- Separate activation key if needed

  -- License Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'transferred')),

  -- Validity Period
  issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  activated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Activation Limits
  max_activations INTEGER DEFAULT 1,
  activation_count INTEGER DEFAULT 0,

  -- Custom Features (JSONB)
  custom_features JSONB,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_accounts_account ON accounts(account_id);
CREATE INDEX idx_accounts_license_key ON accounts(license_key);
CREATE INDEX idx_accounts_status ON accounts(status);
```

### trials table
```sql
CREATE TABLE trials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Trial Association
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  software_edition_id UUID NOT NULL REFERENCES software_editions(id),
  device_id UUID REFERENCES device_registrations(id),

  -- Trial Key
  trial_key VARCHAR(255) UNIQUE NOT NULL,

  -- Trial Period (24 hours)
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_hours INTEGER DEFAULT 24,

  -- Trial Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'converted', 'cancelled')),

  -- Conversion Tracking
  converted_to_account_id UUID REFERENCES accounts(id),
  converted_at TIMESTAMP WITH TIME ZONE,

  -- Features Enabled (JSONB)
  features_enabled JSONB,

  -- Usage Tracking
  activation_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_trials_contact ON trials(contact_id);
CREATE INDEX idx_trials_status ON trials(status);
CREATE INDEX idx_trials_expires_at ON trials(expires_at);
```

### license_transfers table
```sql
CREATE TABLE license_transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Transfer Details
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Old Device
  from_device_id UUID REFERENCES device_registrations(id),
  from_mac_address VARCHAR(17) NOT NULL,

  -- New Device
  to_device_id UUID REFERENCES device_registrations(id),
  to_mac_address VARCHAR(17) NOT NULL,

  -- Transfer Date
  transferred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Time Loss Calculation
  original_expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  new_expiry_date TIMESTAMP WITH TIME ZONE NOT NULL,
  time_lost_days INTEGER NOT NULL, -- Days lost in transfer

  -- Transfer Reason
  reason TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),

  -- Metadata
  initiated_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_license_transfers_account ON license_transfers(account_id);
CREATE INDEX idx_license_transfers_contact ON license_transfers(contact_id);
```

### transactions table
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Transaction Association
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,

  -- Transaction Details
  transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('purchase', 'renewal', 'upgrade', 'downgrade', 'refund', 'trial_conversion')),

  -- Payment Information
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  payment_method VARCHAR(50), -- 'credit_card', 'paypal', 'bank_transfer', etc.
  payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Payment Gateway
  payment_gateway VARCHAR(100), -- 'stripe', 'paypal', 'razorpay', etc.
  payment_gateway_transaction_id VARCHAR(255),

  -- Billing Cycle Information
  billing_cycle VARCHAR(50),
  billing_period_start TIMESTAMP WITH TIME ZONE,
  billing_period_end TIMESTAMP WITH TIME ZONE,

  -- Invoice
  invoice_number VARCHAR(100),
  invoice_url TEXT,

  -- Notes
  notes TEXT,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_contact ON transactions(contact_id);
CREATE INDEX idx_transactions_payment_status ON transactions(payment_status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
```

---

## Common Tasks & Solutions

### Task 1: Create New Account (License + Device)

**Steps:**
1. Customer completes purchase for a product (Gold, Jio, or Smart)
2. POST to `/api/accounts`
3. Request body:
   ```json
   {
     "contact_id": "customer-uuid",
     "software_edition_id": "edition-uuid", // Internal field - Display as "Product" to users
     "billing_cycle": "monthly",
     "mac_address": "AA:BB:CC:DD:EE:FF",
     "device_info": {
       "device_name": "John's MacBook Pro",
       "os_name": "macOS",
       "os_version": "14.2",
       "ip_address": "192.168.1.100"
     }
   }
   ```
4. Backend:
   - Generate unique license key
   - Register device with MAC address
   - Create account record
   - Calculate expiry date based on billing cycle
   - Set status to 'active'
   - Create initial transaction record
5. Return account with license key

### Task 2: Create 24-Hour Trial

**Steps:**
1. Customer requests trial for a product (Gold, Jio, or Smart)
2. POST to `/api/accounts/trials`
3. Request body:
   ```json
   {
     "contact_id": "customer-uuid",
     "software_edition_id": "edition-uuid", // Internal field - Display as "Product" to users
     "mac_address": "AA:BB:CC:DD:EE:FF",
     "device_info": { ... }
   }
   ```
4. Backend:
   - Generate unique trial key
   - Register device
   - Create trial record with 24-hour expiry
   - Create account with status='trial'
   - Set trial_expires_at to NOW() + 24 hours
5. Return trial key and expiry time

### Task 3: Convert Trial to Paid Account

**Steps:**
1. Customer decides to purchase after trial
2. POST to `/api/accounts/trials/:id/convert`
3. Request body:
   ```json
   {
     "billing_cycle": "monthly",
     "payment_method": "credit_card",
     "payment_gateway_transaction_id": "txn_123456"
   }
   ```
4. Backend:
   - Update account status from 'trial' to 'active'
   - Generate permanent license key (replace trial key)
   - Calculate expiry date (from NOW, not from trial start)
   - Create transaction record
   - Mark trial as 'converted'
   - Link converted_to_account_id
5. Return updated account with new license

### Task 4: Transfer License to New Device

**Steps:**
1. Customer wants to move license to new device
2. POST to `/api/accounts/:id/transfer`
3. Request body:
   ```json
   {
     "new_mac_address": "11:22:33:44:55:66",
     "device_info": {
       "device_name": "John's New Laptop",
       "os_name": "Windows 11",
       ...
     },
     "reason": "Purchased new computer"
   }
   ```
4. Backend:
   - Validate account belongs to contact
   - Calculate time loss (proportional to remaining days)
   - Register new device
   - Update account with new device_id and mac_address
   - Adjust expires_at (subtract time loss)
   - Create transfer record
   - Deactivate old device
5. Return updated account with new expiry date

**Time Loss Calculation:**
```javascript
// Example: Customer has 60 days remaining on annual license (365 days)
// Transfer penalty: Lose 10% of remaining time
const remainingDays = calculateDaysBetween(now, expiresAt);
const timeLossDays = Math.floor(remainingDays * 0.10); // 10% loss
const newExpiryDate = expiresAt - (timeLossDays * 24 * 60 * 60 * 1000);
```

### Task 5: Renew Account Subscription

**Steps:**
1. Renewal date approaching or overdue
2. POST to `/api/accounts/:id/renew`
3. Request body:
   ```json
   {
     "billing_cycle": "annual", // Can change cycle
     "payment_method": "credit_card",
     "payment_gateway_transaction_id": "txn_789012"
   }
   ```
4. Backend:
   - Verify payment successful
   - Calculate new expiry date (from old expiry or NOW if expired)
   - Update account status to 'active' if expired
   - Reset renewal_alert_sent flag
   - Create transaction record
   - Update next_billing_date
5. Return updated account

### Task 6: Check Account Expiration & Send Alerts

**Automated Job (Cron):**
1. Run daily: GET `/api/accounts/expiring?days=30`
2. For each expiring account:
   - 30 days: Send "Renewal available" email
   - 14 days: Send "Renewal reminder" email
   - 7 days: Send "Urgent renewal" email
   - 1 day: Send "Final notice" email
3. Mark renewal_alert_sent = true
4. If expires_at < NOW():
   - Update status to 'expired'
   - Revoke license
   - Send "License expired" email

### Task 7: Upgrade/Downgrade Product

**Upgrade Steps:**
1. POST to `/api/accounts/:id/upgrade`
2. Request body:
   ```json
   {
     "new_edition_id": "gold-uuid", // Internal field - Display as "Product" to users
     "payment_gateway_transaction_id": "txn_upgrade_123"
   }
   ```
3. Backend:
   - Calculate pro-rated refund for remaining time
   - Calculate new price for upgrade
   - Charge difference
   - Update account with new software_edition_id
   - Generate new license key
   - Create transaction record (type='upgrade')
4. Return updated account

**Downgrade Steps:**
1. POST to `/api/accounts/:id/downgrade`
2. Similar to upgrade but:
   - Calculate pro-rated credit
   - Apply credit to next billing cycle
   - Update product (software_edition_id)
   - No immediate charge

### Task 8: Cancel Account

**Steps:**
1. Customer requests cancellation
2. PUT to `/api/accounts/:id/status`
3. Request body:
   ```json
   {
     "status": "cancelled",
     "reason": "No longer needed",
     "immediate": false // or true for immediate cancellation
   }
   ```
4. Backend:
   - If immediate: Revoke license immediately, offer pro-rated refund
   - If not immediate: Set auto_renew = false, let expire naturally
   - Update status to 'cancelled'
   - Set cancelled_at timestamp
   - Create cancellation transaction
   - Send cancellation confirmation email
5. Return updated account

### Task 9: Validate License on Software Launch

**API Call from Software:**
1. POST to `/api/accounts/:id/validate`
2. Request body:
   ```json
   {
     "license_key": "XXXX-XXXX-XXXX-XXXX",
     "mac_address": "AA:BB:CC:DD:EE:FF"
   }
   ```
3. Backend:
   - Find account by license_key
   - Verify mac_address matches
   - Check status = 'active'
   - Check expires_at > NOW()
   - Update last_seen_at on device
   - Return validation response:
   ```json
   {
     "valid": true,
     "edition": "Gold", // Internal field - Display as "Product: Gold" to users
     "expires_at": "2025-12-31T23:59:59Z",
     "features": { ... }
   }
   ```

### Task 10: Analytics Dashboard

**Monthly Recurring Revenue (MRR):**
```sql
SELECT
  SUM(CASE
    WHEN billing_cycle = 'monthly' THEN price
    WHEN billing_cycle = 'quarterly' THEN price / 3
    WHEN billing_cycle = 'semi_annual' THEN price / 6
    WHEN billing_cycle = 'annual' THEN price / 12
  END) as mrr
FROM accounts
WHERE status = 'active'
AND organization_id = ?;
```

**Annual Recurring Revenue (ARR):**
```sql
SELECT SUM(mrr * 12) as arr FROM (MRR query);
```

**Churn Rate:**
```sql
SELECT
  COUNT(CASE WHEN status = 'cancelled' AND cancelled_at >= NOW() - INTERVAL '30 days' END) * 100.0 /
  COUNT(CASE WHEN status = 'active' OR status = 'cancelled' END) as churn_rate
FROM accounts
WHERE organization_id = ?;
```

**Trial Conversion Rate:**
```sql
SELECT
  COUNT(CASE WHEN status = 'converted' END) * 100.0 /
  COUNT(*) as conversion_rate
FROM trials
WHERE organization_id = ?
AND created_at >= NOW() - INTERVAL '30 days';
```

---

## Multi-tenant Security

All account operations are automatically scoped to the authenticated user's organization via:
1. `authenticateToken` middleware - validates JWT
2. `validateOrganizationContext` middleware - extracts org ID
3. Database queries filtered by `organization_id`
4. Row-Level Security (RLS) policies enforce data isolation

**Never allow:**
- Cross-organization account access
- License transfers across organizations
- Device registration without organization context
- MAC address reuse across different organizations

---

## Best Practices

1. **MAC Address Validation**
   - Validate format: `XX:XX:XX:XX:XX:XX`
   - Ensure uniqueness per organization
   - Store in uppercase for consistency

2. **License Key Generation**
   - Use cryptographically secure random generation
   - Format: `XXXX-XXXX-XXXX-XXXX` (easy to read)
   - Store hashed version for security
   - Include checksum for validation

3. **Expiry Date Calculations**
   - Monthly: +30 days
   - Quarterly: +90 days
   - Semi-Annual: +180 days
   - Annual: +365 days
   - Always use UTC timestamps

4. **Trial Management**
   - Unlimited trials per customer per product
   - Strict 24-hour enforcement
   - Auto-expire trials (cron job)
   - Track trial conversion rates

5. **Transfer Time Loss**
   - Document loss percentage clearly (e.g., 10%)
   - Show customer how much time they'll lose
   - Require confirmation before transfer
   - Log all transfers for audit

6. **Renewal Alerts**
   - Send at 30, 14, 7, 1 days before expiry
   - Include renewal link in email
   - Track alert delivery status
   - Prevent duplicate alerts

7. **Transaction Recording**
   - Record ALL financial events
   - Store payment gateway IDs
   - Generate invoice numbers
   - Keep audit trail

8. **Device Security**
   - Never expose device IDs externally
   - Validate device ownership
   - Track last seen timestamps
   - Flag suspicious device changes

9. **Product Management** (Database: software_editions - Display as "Product" to users)
   - Keep product catalog simple (3-5 products max)
   - Clear pricing for each billing cycle
   - Offer annual discounts (15-20%)
   - Document feature differences

10. **Performance**
    - Index frequently queried fields (mac_address, license_key, expires_at)
    - Cache product catalog (software_editions table)
    - Batch renewal alerts
    - Archive old transactions

---

## Common Debugging Steps

1. **License validation fails:**
   - Verify license_key exists in database
   - Check mac_address matches registered device
   - Ensure account status = 'active'
   - Verify expires_at > NOW()
   - Check organization_id context

2. **Trial not expiring:**
   - Check cron job running
   - Verify trial_expires_at < NOW()
   - Ensure status update logic works
   - Check RLS policies

3. **Transfer losing too much time:**
   - Review time loss calculation
   - Verify remaining days correct
   - Check timezone handling (always UTC)
   - Test edge cases (expiring soon)

4. **Renewal alerts not sending:**
   - Check expiring accounts query
   - Verify email service configured
   - Test with sample expiry dates
   - Check renewal_alert_sent flag

5. **MRR/ARR calculations wrong:**
   - Verify billing cycle normalization
   - Check for duplicate accounts
   - Exclude trial accounts
   - Filter by status = 'active'

6. **Device registration fails:**
   - Validate MAC address format
   - Check for duplicates
   - Ensure contact_id valid
   - Verify organization context

---

## How to Use This Agent

When a user asks for help with accounts, you should:

1. **Understand the request**
   - Is it about license creation, renewal, or transfer?
   - Device registration or validation?
   - Trial management?
   - Analytics/reporting?

2. **Check existing implementation**
   - Read relevant backend routes (`routes/accounts.js`)
   - Check models (`models/Account.js`)
   - Review frontend pages and components
   - Verify database schema

3. **Provide solutions**
   - Use existing endpoints when possible
   - Show code examples for API calls
   - Explain business logic (trials, transfers, time loss)
   - Demonstrate calculations (MRR, ARR, expiry)

4. **Ensure security**
   - Always scope by organization
   - Validate device ownership
   - Protect license keys (hash sensitive data)
   - Prevent cross-org transfers

5. **Test thoroughly**
   - Test license validation
   - Verify trial expiry
   - Check transfer time loss calculations
   - Test renewal flows
   - Validate analytics queries

---

## Examples of User Requests

**"Add a button to renew this account"**
- Create RenewButton component
- Call POST `/api/accounts/:id/renew`
- Show payment form
- Update account on success
- Display new expiry date

**"Show devices expiring in next 7 days"**
- GET `/api/accounts/expiring?days=7`
- Display in dashboard widget
- Color-code by urgency
- Add quick renew actions

**"Allow customer to transfer license to new computer"**
- Create TransferForm component
- Get new device info (MAC address)
- Calculate and show time loss
- Require confirmation
- POST `/api/accounts/:id/transfer`

**"Create 24-hour trial for customer"**
- POST `/api/accounts/trials`
- Specify contact_id, edition_id, mac_address
- Return trial key
- Set 24-hour timer
- Enable trial-to-paid conversion

**"Display MRR and ARR on dashboard"**
- GET `/api/accounts/analytics/mrr`
- GET `/api/accounts/analytics/arr`
- Create analytics cards
- Show trend graphs
- Add comparison to last month

**"Send renewal alerts for expiring accounts"**
- Create cron job (daily)
- Query accounts expiring in 30, 14, 7, 1 days
- Send email with renewal link
- Mark alert sent
- Log alert delivery

---

## Success Criteria

✅ Account creation binds license to device (MAC address)
✅ Unique license keys generated for each account
✅ Billing cycles (monthly, quarterly, semi-annual, annual) work correctly
✅ 24-hour trials expire automatically
✅ Trial-to-paid conversion preserves device binding
✅ License transfers calculate time loss accurately
✅ Renewal process extends expiry date correctly
✅ Renewal alerts sent at 30, 14, 7, 1 days before expiry
✅ Expired accounts revoked automatically
✅ MRR and ARR calculations accurate
✅ Churn and trial conversion metrics correct
✅ Device validation works in software
✅ Multi-tenant security enforced on all endpoints
✅ No license key exposure in logs or errors
✅ Transaction history recorded for all events

---

## Agent Invocation

To use this agent, run:
```bash
/account-agent
```

Then describe what you need help with regarding account and license management.
