# MAC Search Feature - Devtest Deployment Guide

## ✅ Files Ready for Deployment

### Backend ✅
- ✅ `backend/services/macAddressSearchService.js` - Core search service
- ✅ `backend/routes/macSearch.js` - API endpoints
- ✅ `backend/config/billingPortals.js` - Portal configuration
- ✅ `server.js` - UPDATED with MAC routes
- ✅ `backend/migrations/002-mac-search-tables.sql` - Database schema
- ✅ `backend/scripts/setup-mac-search-devtest.js` - Setup automation

### Frontend ✅
- ✅ `frontend/src/pages/MacAddressSearch.jsx` - User search UI
- ✅ `frontend/src/components/admin/MacSearchSettings.jsx` - Admin settings
- ✅ `frontend/src/components/FeatureGate.jsx` - Feature flag component
- ✅ `frontend/src/App.jsx` - UPDATED with routes
- ✅ `frontend/src/components/DashboardLayout.jsx` - UPDATED with nav links

---

## 🚀 Deployment Steps

### Step 1: Install Dependencies (if needed)

```bash
cd backend
npm install playwright
npx playwright install chromium

cd ../frontend
npm install
```

### Step 2: Set Environment Variables

Add to `.env`:
```env
ENCRYPTION_KEY=your-secure-random-encryption-key-here-generate-with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate a strong key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Run Database Migration

```bash
# Using the migration file directly (choose one):

# Option A: Using psql
psql -d your_database -f backend/migrations/002-mac-search-tables.sql

# Option B: Using Supabase UI
# 1. Go to SQL Editor
# 2. Create new query
# 3. Copy contents of backend/migrations/002-mac-search-tables.sql
# 4. Run query
```

### Step 4: Enable Feature for Devtest Organization

Run the automated setup script:

```bash
node backend/scripts/setup-mac-search-devtest.js
```

This script will:
- ✅ Find the devtest organization
- ✅ Enable `mac_search_enabled = true`
- ✅ Verify configuration

**Or manually enable via SQL:**

```sql
-- Find your devtest org ID first
SELECT id, name FROM organizations WHERE name ILIKE '%devtest%';

-- Enable the feature
UPDATE organizations
SET mac_search_enabled = true
WHERE name ILIKE '%devtest%';

-- Verify
SELECT id, name, mac_search_enabled
FROM organizations
WHERE mac_search_enabled = true;
```

### Step 5: Verify Backend Changes

Check that server.js includes MAC search routes:

```bash
grep -n "macSearch\|mac-search" server.js
```

Should show:
```
67:const macSearchRoutes = require('./routes/macSearch')
...
322:app.use('/api/mac-search', rateLimiters.general, macSearchRoutes)
```

### Step 6: Verify Frontend Changes

Check that App.jsx and DashboardLayout.jsx have updates:

```bash
grep -n "MacAddressSearch\|MacSearchSettings\|FeatureGate\|MAC Search" frontend/src/App.jsx
grep -n "mac_search_enabled\|MAC Search" frontend/src/components/DashboardLayout.jsx
```

### Step 7: Deploy to Devtest

```bash
# Build frontend
cd frontend
npm run build

# Back to root
cd ..

# Deploy to devtest (using your deployment tool)
# Example for Render:
git add .
git commit -m "feat: Add MAC address search feature for devtest"
git push
```

---

## 🧪 Testing Checklist

After deployment to devtest:

### Test 1: Feature Flag Visibility ✅
- [ ] Login to devtest with regular user account
- [ ] Verify NO "MAC Search" link visible in navigation (feature disabled for other orgs)
- [ ] Verify NO "MAC Search Settings" in admin menu

### Test 2: Admin Panel Setup ✅
- [ ] Login as admin user in devtest org
- [ ] Go to Settings → Admin dropdown
- [ ] Click "MAC Search Settings"
- [ ] Verify toggle shows "Enable MAC Search Feature"
- [ ] Toggle to ON
- [ ] See success message: "MAC search enabled successfully"

### Test 3: Configure Portal Credentials ✅
- [ ] Portal card appears: "Ditto Billing Portal"
- [ ] Shows status: ⚠️ Not Configured
- [ ] Enter credentials:
  - Username: `sky711`
  - Password: `Toronto2025@`
- [ ] Click "Save Credentials"
- [ ] See success message: "Credentials saved successfully"
- [ ] Status badge changes to: ✅ Configured

### Test 4: User Search Interface ✅
- [ ] Login as devtest user
- [ ] See "MAC Search" in main navigation
- [ ] Click MAC Search
- [ ] See search form with placeholder: "00:1A:79:B2:5A:58"
- [ ] Enter MAC: `00:1A:79:B2:5A:58`
- [ ] Click Search
- [ ] Wait 5-30 seconds for results
- [ ] Verify results show:
  - ✅ Portal Name: Ditto Billing Portal
  - Account Name: manjit
  - MAC Address: 00:1A:79:B2:5A:58
  - Status: Active
  - Expiry Date: 2026-03-06

### Test 5: CSV Export ✅
- [ ] After search results appear
- [ ] Click "Export CSV" button
- [ ] Download completes
- [ ] File contains all results with proper headers

### Test 6: Search History ✅
- [ ] In MAC Search page, click "History" tab
- [ ] Verify previous search appears with:
  - MAC address
  - "1 found" badge
  - Timestamp of search

### Test 7: Feature Flag Disable ✅
- [ ] Admin disables feature via SQL:
  ```sql
  UPDATE organizations SET mac_search_enabled = false WHERE name ILIKE '%devtest%';
  ```
- [ ] Refresh page
- [ ] Verify:
  - ❌ MAC Search link disappears from navigation
  - ❌ MAC Search Settings not in admin menu
  - ❌ Direct URL access shows error page: "Feature Not Available"

### Test 8: Feature Flag Re-Enable ✅
- [ ] Admin re-enables feature via SQL:
  ```sql
  UPDATE organizations SET mac_search_enabled = true WHERE name ILIKE '%devtest%';
  ```
- [ ] Refresh page
- [ ] Verify feature is available again

---

## 🔧 Troubleshooting

| Issue | Solution |
|-------|----------|
| **"API /api/mac-search/search not found"** | Verify server.js includes MAC routes, restart server |
| **"Feature not available for organization"** | Check org has `mac_search_enabled = true`, refresh browser |
| **"Credentials won't save"** | Check ENCRYPTION_KEY is set in .env, restart server |
| **Search times out** | Check Ditto portal URL is accessible, increase timeout in billingPortals.js |
| **Password decryption error** | Verify ENCRYPTION_KEY is the same one used for encryption |
| **Playwright errors** | Run: `npx playwright install chromium` |
| **Navigation link not showing** | Clear browser cache, verify organization feature flag |

---

## 📊 Database Verification

Check that tables were created:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('billing_portal_credentials', 'mac_search_history', 'mac_search_results')
ORDER BY table_name;

-- Check mac_search_enabled column exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'organizations' AND column_name = 'mac_search_enabled';

-- Check devtest org has feature enabled
SELECT id, name, mac_search_enabled FROM organizations
WHERE name ILIKE '%devtest%';
```

Expected output:
```
                 table_name
─────────────────────────────────
 billing_portal_credentials
 mac_search_history
 mac_search_results

 column_name
──────────────────────────
 mac_search_enabled

 id                   | name    | mac_search_enabled
──────────────────────┼─────────┼───────────────────
 [devtest-uuid]       | devtest | true
```

---

## 🎯 What Users Will See

### Users WITHOUT Feature Enabled
- ❌ No "MAC Search" link in navigation
- ❌ No "MAC Search Settings" in admin
- ❌ Can't access /mac-search or /admin/mac-search-settings
- 👍 No confusion, no support calls

### Users WITH Feature Enabled (Devtest)
- ✅ "MAC Search" link in main navigation
- ✅ "MAC Search Settings" in admin menu
- ✅ Can configure portal credentials
- ✅ Can search for MAC addresses across portals
- ✅ See results with expiry dates
- ✅ Export results as CSV

---

## 📝 Deployment Checklist Summary

- [ ] ENCRYPTION_KEY added to .env
- [ ] Database migration run (tables created)
- [ ] Server.js verified to include MAC routes
- [ ] App.jsx verified for MAC routes
- [ ] DashboardLayout.jsx verified for nav links
- [ ] Feature enabled for devtest org
- [ ] Test all scenarios from Testing Checklist
- [ ] Devtest users can see MAC Search in UI
- [ ] Admin can configure credentials
- [ ] Search returns results
- [ ] CSV export works
- [ ] Feature can be toggled on/off via SQL

---

## 🚀 After Deployment

1. **Devtest users can immediately use MAC search**
2. **Other organizations see nothing** (feature is invisible)
3. **To enable for other orgs:** Run SQL command
4. **To disable:** Run SQL command

---

## 📞 Support

If issues occur during deployment:

1. Check Troubleshooting section above
2. Verify all files exist in correct locations
3. Check server logs for errors
4. Verify ENCRYPTION_KEY is set
5. Run setup script again: `node backend/scripts/setup-mac-search-devtest.js`

---

**Deployment Date:** 2026-02-06
**Target Environment:** Devtest
**Status:** Ready for Deployment ✅
