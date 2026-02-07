# MAC Search Feature - Quick Implementation Guide

## 🎯 3 Core Features to Implement

1. **Admin Settings** - Configure portal credentials
2. **User Search UI** - Search for MAC addresses
3. **Feature Flag** - Enable/disable per organization

---

## 📦 Step 1: Add Files to Your Project

### Backend Files (3 files)

**1. `backend/services/macAddressSearchService.js`**
   - Core service for searching portals
   - Status: ✅ Ready to copy

**2. `backend/routes/macSearch.js`**
   - API endpoints for search
   - Status: ✅ Ready to copy

**3. `backend/config/billingPortals.js`**
   - Portal configuration
   - Status: ✅ Copy from example, customize

### Frontend Files (2 files)

**4. `frontend/src/pages/MacAddressSearch.jsx`**
   - User-facing search UI
   - Status: ✅ Ready to copy

**5. `frontend/src/components/admin/MacSearchSettings.jsx`**
   - Admin settings panel
   - Status: ✅ Ready to copy

---

## 🗄️ Step 2: Database Setup

Run this SQL once:

```sql
-- Create tables for MAC search feature
CREATE TABLE IF NOT EXISTS billing_portal_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  portal_id VARCHAR(100) NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(organization_id, portal_id)
);

CREATE TABLE IF NOT EXISTS mac_search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mac_address VARCHAR(17) NOT NULL,
  results JSONB NOT NULL,
  total_found INTEGER DEFAULT 0,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mac_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id VARCHAR(36) NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mac_address VARCHAR(17) NOT NULL,
  results JSONB NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add feature flag to organizations table
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS mac_search_enabled BOOLEAN DEFAULT FALSE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mac_search_history_org_id ON mac_search_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_portal_credentials_org_id ON billing_portal_credentials(organization_id);
```

**Where to run:**
- Supabase: SQL Editor → Create new query → Run
- pgAdmin: Query Tool → Paste → Execute (F5)
- Command line: `psql -U postgres -d database_name -f migration.sql`

---

## ⚙️ Step 3: Backend Configuration

### 3a. Portal Configuration

Create `backend/config/billingPortals.js`:

```javascript
module.exports = {
  portals: [
    {
      id: 'ditto-billing-1',
      name: 'Ditto Billing Portal',
      url: 'https://billing.dittotvv.cc',
      loginPath: '/login',
      usersListPath: '/dealer/users',
      enabled: true,
      searchType: 'table',
      tableConfig: {
        rowSelector: 'tr, [role="row"]',
        macColumn: 1,
        nameColumn: 2,
        statusColumn: 4,
        expiryColumn: 5,
      },
      timeout: 30000,
    },
    // Add more portals as needed
  ],
}
```

### 3b. Add to server.js

Add these lines to `backend/server.js`:

```javascript
// Add near top with other requires
const macSearchRoutes = require('./routes/macSearch')
const MacAddressSearchService = require('./services/macAddressSearchService')

// Add before other routes (after auth middleware)
app.use('/api/mac-search', macSearchRoutes)

// Make service available globally if needed
global.MacAddressSearchService = MacAddressSearchService
```

### 3c. Environment Variables

Add to `.env`:

```env
ENCRYPTION_KEY=your-secret-encryption-key-here-use-strong-random-string
```

---

## 🎨 Step 4: Frontend Integration

### 4a. Add Routes

In your router configuration (e.g., `frontend/src/App.jsx` or `frontend/src/routes.jsx`):

```javascript
import MacAddressSearch from './pages/MacAddressSearch'
import MacSearchSettings from './components/admin/MacSearchSettings'

// Add to your routes array
{
  path: '/mac-search',
  element: <MacAddressSearch />,
  requiredRole: 'user',
},
{
  path: '/admin/mac-search-settings',
  element: <MacSearchSettings organizationId={currentOrgId} />,
  requiredRole: 'admin',
}
```

### 4b. Add Navigation Links

Add to your navigation menu:

```javascript
// For regular users
<NavLink to="/mac-search">
  <Search size={18} />
  MAC Address Search
</NavLink>

// For admins only (hide if not admin)
{userRole === 'admin' && (
  <NavLink to="/admin/mac-search-settings">
    <Settings size={18} />
    MAC Search Settings
  </NavLink>
)}
```

### 4c. Install Dependencies

```bash
cd frontend
npm install playwright axios lucide-react
```

---

## 🚀 Step 5: Enable/Disable Feature for Organizations

### Method A: SQL (Simplest)

```sql
-- Enable for one organization
UPDATE organizations
SET mac_search_enabled = true
WHERE id = 'your-org-uuid-here';

-- Enable for multiple organizations
UPDATE organizations
SET mac_search_enabled = true
WHERE name IN ('Company A', 'Company B');

-- Disable for organization
UPDATE organizations
SET mac_search_enabled = false
WHERE id = 'your-org-uuid-here';

-- Check status
SELECT id, name, mac_search_enabled FROM organizations;
```

### Method B: Quick Script (Easiest if running frequently)

Create `backend/scripts/toggle-mac-feature.js`:

```javascript
#!/usr/bin/env node
/**
 * Toggle MAC search feature for organizations
 * Usage: node scripts/toggle-mac-feature.js <org-id> true|false
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function toggle(orgId, enabled) {
  const { error } = await supabase
    .from('organizations')
    .update({ mac_search_enabled: enabled })
    .eq('id', orgId)

  if (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }

  console.log(`✅ MAC search ${enabled ? 'ENABLED' : 'DISABLED'} for org: ${orgId}`)
}

const orgId = process.argv[2]
const enabled = process.argv[3]?.toLowerCase() === 'true'

if (!orgId || enabled === undefined) {
  console.log('Usage: node toggle-mac-feature.js <org-id> true|false')
  process.exit(1)
}

toggle(orgId, enabled)
```

**Usage:**
```bash
node backend/scripts/toggle-mac-feature.js 550e8400-e29b-41d4-a716-446655440000 true
```

---

## ✅ Step 6: Testing

### 6a. Test Admin Settings Page

1. Go to `/admin/mac-search-settings`
2. Click toggle to **Enable MAC Search Feature**
3. See portal cards appear
4. Enter credentials for Ditto Billing:
   - Username: `sky711`
   - Password: `Toronto2025@`
5. Click **Save Credentials**
6. Should see badge change to ✅ **Configured**

### 6b. Test User Search Page

1. Go to `/mac-search`
2. Enter MAC address: `00:1A:79:B2:5A:58`
3. Click **Search**
4. Should see results:
   - ✅ Portal Name: Ditto Billing Portal
   - Account Name: manjit
   - MAC Address: 00:1A:79:B2:5A:58
   - Status: Active
   - Expiry Date: 2026-03-06

### 6c. Test Feature Flag

1. Disable feature via SQL: `UPDATE organizations SET mac_search_enabled = false WHERE id = '...'`
2. Refresh page, should see error: "MAC search feature is not enabled"
3. Enable feature via SQL: `UPDATE organizations SET mac_search_enabled = true WHERE id = '...'`
4. Should work again

---

## 🎯 User Journey

### For Organization Admin
```
1. Login to CRM
2. Go to Settings → MAC Search Settings
3. Toggle ON → Enable MAC Search Feature
4. Enter portal credentials (username/password)
5. Click Save Credentials
6. Portal shows ✅ Configured
```

### For Regular Users
```
1. Login to CRM
2. Go to MAC Address Search
3. Enter MAC address (e.g., 00:1A:79:B2:5A:58)
4. Click Search
5. See results with:
   - Portal Name
   - Account Name
   - Status
   - Expiry Date
6. Download as CSV if needed
```

---

## 📋 Checklist

- [ ] Copy `macAddressSearchService.js` to backend/services/
- [ ] Copy `macSearch.js` to backend/routes/
- [ ] Create `billingPortals.js` in backend/config/
- [ ] Run SQL migration to create tables
- [ ] Add routes to backend server.js
- [ ] Add ENCRYPTION_KEY to .env
- [ ] Copy MacAddressSearch.jsx to frontend/src/pages/
- [ ] Copy MacSearchSettings.jsx to frontend/src/components/admin/
- [ ] Add routes to frontend router
- [ ] Add navigation links
- [ ] Install dependencies: `npm install playwright`
- [ ] Run tests on admin and user pages
- [ ] Use SQL to enable feature for test organization
- [ ] Verify search works end-to-end

---

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| **"MAC search feature not enabled"** | Run SQL: `UPDATE organizations SET mac_search_enabled = true WHERE id = '...'` |
| **Credentials won't save** | Check ENCRYPTION_KEY in .env is set |
| **Search times out** | Check portal URL is accessible, increase timeout in billingPortals.js |
| **Playwright errors** | Run: `npx playwright install chromium` |
| **Table not found error** | Ensure SQL migration was run successfully |

---

## 🎓 How It Works (Quick Version)

```
User enters MAC address on search page
    ↓
Frontend sends to /api/mac-search/search
    ↓
Backend fetches encrypted credentials from database
    ↓
Playwright logs into each portal automatically
    ↓
Searches for MAC in user tables
    ↓
Extracts: Account Name, Status, Expiry Date
    ↓
Returns results to frontend
    ↓
User sees all matches across all portals
```

---

That's it! 3 features, straightforward implementation. 🚀
