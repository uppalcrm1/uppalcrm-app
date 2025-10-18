# Uppal CRM Architecture Documentation

## System Overview

Uppal CRM is a **two-tier multi-tenant SaaS application** with complete separation between:
1. **Super Admin Platform** - For managing the CRM business
2. **Organization CRM** - For each business managing their customers

---

## Critical Architecture Decision: Two Separate Systems

### 🏢 Tier 1: Super Admin Platform (SaaS Management)

**Purpose:** Manage Uppal CRM as a SaaS business

**Who uses it:** Platform administrators (Uppal CRM owners)

**Access:** `/super-admin/*` routes only

**Features:**
- Monitor trial signups and conversions
- Manage organizations (businesses subscribing to the CRM)
- Track platform revenue ($15/user/month subscriptions)
- View platform analytics and usage metrics
- Provision and manage organization accounts

**Navigation:**
- Dashboard (`/super-admin/dashboard`)
- Trial Signups (`/super-admin/signups`)
- Organizations (`/super-admin/organizations`)
- Accounts (`/super-admin/accounts`) - Platform billing management
- Analytics (`/super-admin/analytics`)

**Key Pages:**
- `frontend/src/pages/SuperAdminDashboard.jsx`
- `frontend/src/pages/SuperAdminSignups.jsx`
- `frontend/src/pages/SuperAdminOrganizations.jsx`
- `frontend/src/pages/AccountManagement.jsx` - Platform accounts ($15/user/month)
- `frontend/src/pages/SuperAdminAnalytics.jsx`

---

### 🏪 Tier 2: Organization CRM (Customer Management)

**Purpose:** Each business manages THEIR customers who buy software licenses

**Who uses it:** Organization admins and team members

**Access:** Root routes (`/*`) - NOT super-admin routes

**Features:**
- Manage leads (potential customers)
- Track contacts (their customers)
- Manage accounts (customer software licenses per device)
- Record billing & payments (from their customers)
- Team management
- View their own CRM subscription status
- Integrations, imports, field customization

**Navigation:**
1. Dashboard (`/dashboard`) - Overview of their customer data
2. Leads (`/leads`) - Their potential customers
3. Contacts (`/contacts`) - Their customers
4. **Accounts (`/accounts`)** - Their customers' software licenses ⚠️ NOT platform accounts
5. **Billing (`/billing`)** - Payments from their customers
6. Team (`/team`) - Their team members
7. Subscription (`/subscription`) - THEIR subscription to Uppal CRM
8. Integrations (`/integrations`) - Connect their tools
9. Import (`/import`) - Import their data
10. Field Configuration (`/field-configuration`) - Customize their CRM
11. Settings (`/settings`) - Their organization settings

**Key Pages:**
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Leads.jsx`
- `frontend/src/pages/ContactsPage.jsx`
- `frontend/src/pages/AccountsPage.jsx` - Customer software licenses ⚠️ NOT platform
- `frontend/src/pages/BillingPage.jsx` - Customer payments
- `frontend/src/pages/TeamPage.jsx`
- `frontend/src/pages/SubscriptionPage.jsx`
- Other organization management pages

---

## ⚠️ CRITICAL: "Accounts" Has Two Different Meanings

### ❌ Common Confusion Point

The word "Accounts" is used in BOTH tiers but means completely different things:

| Context | Route | Component | Meaning | Shows |
|---------|-------|-----------|---------|-------|
| **Super Admin** | `/super-admin/accounts` | `AccountManagement.jsx` | Platform billing | Organizations' CRM subscriptions ($15/user/month) |
| **Organization** | `/accounts` | `AccountsPage.jsx` | Customer licenses | Software licenses for end customers (Gold/Smart/Jio) |

### ✅ How to Remember

**Super Admin "Accounts"** = WHO IS PAYING US (organizations subscribing to Uppal CRM)

**Organization "Accounts"** = WHO IS PAYING THEM (their customers buying software licenses)

---

## Security Boundaries

### Route Protection
```javascript
// Super Admin Routes - RESTRICTED
/super-admin/*  → Only accessible to super admin users
                → Manages the platform business
                → NOT accessible to organization users

// Organization Routes - PER-TENANT
/*              → Accessible to organization admins/users
                → Manages their customer data
                → Isolated per organization (multi-tenant)
                → NOT accessible to other organizations
```

### Data Isolation

**Super Admin Level:**
- Can see ALL organizations
- Can see platform-wide analytics
- Can manage trials and conversions
- CANNOT see individual organization's customer data (privacy)

**Organization Level:**
- Can ONLY see their own data
- Row-level security (RLS) enforces isolation
- Cannot see other organizations' data
- Cannot see platform management features

---

## Database Architecture

### Multi-Tenant Structure
```sql
organizations
├── id (tenant identifier)
├── name
├── subscription_plan
└── billing details

-- All organization data includes organization_id for isolation
leads           → organization_id (RLS)
contacts        → organization_id (RLS)
accounts        → organization_id (RLS) [Customer software licenses]
payments        → organization_id (RLS) [Customer payments]
users           → organization_id (RLS) [Team members]
```

---

## File Structure
```
frontend/src/
├── components/
│   ├── SuperAdminLayout.jsx      [Super admin navigation]
│   └── DashboardLayout.jsx       [Organization navigation]
│
├── pages/
│   ├── AccountManagement.jsx     [⚠️ Super Admin: Platform billing]
│   ├── SuperAdminDashboard.jsx   [Platform overview]
│   ├── SuperAdminSignups.jsx     [Trial management]
│   ├── SuperAdminOrganizations.jsx [Org management]
│   ├── SuperAdminAnalytics.jsx   [Platform analytics]
│   │
│   └── [Organization pages]      [Customer management pages]
│       ├── Dashboard.jsx
│       ├── Leads.jsx
│       ├── ContactsPage.jsx
│       ├── AccountsPage.jsx      [⚠️ Organization: Customer licenses]
│       ├── BillingPage.jsx       [Customer payment history]
│       ├── TeamPage.jsx
│       ├── SubscriptionPage.jsx
│       └── ...other pages
```

---

## Routing Configuration

### App.jsx Route Structure
```javascript
<Routes>
  {/* Super Admin Routes - Platform Management */}
  <Route path="/super-admin/login" element={<SuperAdminLogin />} />
  <Route path="/super-admin" element={<SuperAdminLayout />}>
    <Route path="dashboard" element={<SuperAdminDashboard />} />
    <Route path="signups" element={<SuperAdminSignups />} />
    <Route path="organizations" element={<SuperAdminOrganizations />} />
    <Route path="analytics" element={<SuperAdminAnalytics />} />
    <Route path="accounts" element={<AccountManagement />} /> {/* Platform billing */}
  </Route>

  {/* Organization Routes - Customer Management */}
  <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="leads" element={<Leads />} />
    <Route path="contacts" element={<ContactsPage />} />
    <Route path="accounts" element={<AccountsPage />} /> {/* Customer licenses */}
    <Route path="billing" element={<BillingPage />} />
    <Route path="team" element={<TeamPage />} />
    <Route path="subscription" element={<SubscriptionPage />} />
    <Route path="integrations" element={<IntegrationsPage />} />
    <Route path="import" element={<ImportPage />} />
    <Route path="field-configuration" element={<FieldConfigurationPage />} />
    <Route path="settings" element={<SettingsPage />} />
  </Route>
</Routes>
```

---

## Data Flow Examples

### Example 1: Super Admin Views Platform Accounts
```
User: Super Admin
Route: /super-admin/accounts
Component: AccountManagement.jsx
Data Shown: All organizations and their CRM subscriptions
- Tech Startup Inc: 5 users × $15 = $75/month
- Marketing Agency: 10 users × $15 = $150/month
- Sales Corp: 3 users × $15 = $45/month
Total Platform Revenue: $270/month
```

### Example 2: Organization Views Customer Accounts
```
User: Tech Startup Inc (an organization using Uppal CRM)
Route: /accounts
Component: AccountsPage.jsx
Data Shown: Their customers' software licenses
- John Doe: Gold Edition, MacBook Pro, Active ($99/month)
- Jane Smith: Smart Edition, Windows PC, Expiring Soon ($79/month)
- Bob Wilson: Jio Edition, iPad Pro, Expired ($49/month)
Their Revenue from Customers: $227/month
```

---

## Business Model

### Revenue Stream 1: Platform Subscription (Super Admin manages)
- Organizations pay Uppal CRM **$15/user/month**
- Super Admin tracks this in `/super-admin/accounts`
- Manages organization billing and user limits

### Revenue Stream 2: Customer Licenses (Organizations manage)
- End customers pay organizations for software licenses
- Organizations track this in `/accounts`
- Organizations record payments in `/billing`
- Pricing varies: Gold ($99), Smart ($79), Jio ($49), etc.

---

## Common Development Mistakes to Avoid

### ❌ WRONG: Mixing Platform and Customer Data
```javascript
// DON'T: Show platform billing on organization routes
<Route path="accounts" element={<AccountManagement />} /> // WRONG!
```

### ✅ CORRECT: Proper Separation
```javascript
// Super Admin: Platform billing
<Route path="/super-admin/accounts" element={<AccountManagement />} />

// Organization: Customer licenses
<Route path="accounts" element={<AccountsPage />} />
```

### ❌ WRONG: Using Same Component Name for Different Purposes
```javascript
// DON'T: Use "Accounts" generically
const Accounts = () => { ... } // Ambiguous!
```

### ✅ CORRECT: Clear Naming
```javascript
// Super Admin
const AccountManagement = () => { /* Platform billing */ }

// Organization
const AccountsPage = () => { /* Customer licenses */ }
```

---

## Testing Guidelines

### Super Admin Testing
1. Login to `/super-admin/login`
2. Navigate to Accounts
3. Verify shows organization subscriptions ($15/user/month)
4. Verify can update organization user limits
5. Verify platform revenue calculations

### Organization Testing
1. Login to `/login` as organization user
2. Navigate to Accounts
3. Verify shows customer software licenses
4. Verify can record customer payments
5. Verify software edition badges (Gold/Smart/Jio)

---

## Future Considerations

### Potential Renaming (if confusion persists)
- **Super Admin:** `/super-admin/subscriptions` instead of `/super-admin/accounts`
- **Organization:** Keep `/accounts` for customer licenses

### Additional Features
- **Super Admin:** Revenue forecasting, churn analytics
- **Organization:** License renewal reminders, payment automation

---

## Version History

- **v1.0** (2024-10-18): Initial architecture documentation
  - Separated platform billing from customer licenses
  - Moved AccountManagement to super-admin routes only
  - Added comprehensive two-tier system documentation

---

## Questions?

If you're confused about whether something belongs to:
- **Super Admin:** Ask "Is this about managing the CRM platform business?"
- **Organization:** Ask "Is this about managing customer data?"

Still confused? Check the route prefix:
- `/super-admin/*` = Platform management
- `/*` = Customer management
