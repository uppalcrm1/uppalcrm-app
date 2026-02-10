# MAC Address Search - Complete Deployment & Testing Guide

## Overview
This guide covers the complete MAC Address Search functionality implementation, including all fixes for the Playwright browser installation issue and Supabase-to-PostgreSQL migration.

---

## Deployment Status

### ✅ All Changes Deployed to `devtest` Branch

#### Phase 1: UI Redesign (2026-02-08)
- ✅ Redesigned MAC Search Settings page with clear portal sections
- ✅ Separate "Configured Portals" and "Unconfigured Portals" views
- ✅ Edit credentials inline with "Change Credentials" button

#### Phase 2: Backend Fixes (2026-02-08)
- ✅ Migrated from Supabase to PostgreSQL for all MAC search endpoints
- ✅ Added missing `custom_portals` database table
- ✅ Fixed password decryption with proper IV handling
- ✅ Simplified response handling (removed streaming)

#### Phase 3: Frontend API Integration (2026-02-08)
- ✅ Fixed MacAddressSearch.jsx to use configured `api` client
- ✅ Ensured proper authorization headers in all requests

#### Phase 4: Playwright Browser Installation (2026-02-08)
- ✅ Added startup script to ensure Playwright installation
- ✅ Added postinstall script for npm package installations
- ✅ Added build script explicit installation
- ✅ Added detailed logging for troubleshooting

---

## Pre-Deployment Checklist

### Environment Configuration
- [ ] `.env` file contains `ENCRYPTION_KEY` (added automatically)
- [ ] `DATABASE_URL` points to PostgreSQL database
- [ ] `JWT_SECRET` is configured
- [ ] `NODE_ENV` is set to correct environment

### Database Setup
- [ ] Run migrations to create MAC search tables:
  ```bash
  npm run migrate:run
  ```
- [ ] Verify tables exist:
  - `custom_portals`
  - `billing_portal_credentials`
  - `mac_search_history`
  - `mac_search_results`

### Configuration
- [ ] Update `backend/config/billingPortals.js` with correct portal URLs
- [ ] Verify portal `loginPath` and `usersListPath` are correct
- [ ] Verify table column selectors match actual portal layout

---

## Deployment Steps

### Step 1: Pull Latest Code
```bash
git fetch origin
git checkout devtest
git pull origin devtest
```

### Step 2: Install Dependencies
```bash
npm install --force
```

### Step 3: Run Migrations
```bash
npm run migrate:run
```

### Step 4: Deploy to Render (For Production)

#### Option A: Using GitHub Integration
1. Push to `devtest` branch (already done)
2. Render auto-detects and deploys
3. Monitors deployment progress

#### Option B: Manual Deploy via Render Dashboard
1. Go to Render Dashboard → devtest service
2. Click **Manual Deploy**
3. Select latest commit from `devtest` branch
4. Click **Deploy**

#### Option C: Clear Build Cache (If Playwright Still Missing)
1. Go to Render Dashboard → devtest service
2. Click **Settings** → **Build & Deploy**
3. Click **Clear Build Cache**
4. Click **Manual Deploy**

### Step 5: Verify Deployment
- [ ] Check Render build logs for "Playwright installation complete"
- [ ] Verify server starts without errors
- [ ] Check server logs in Render dashboard

---

## Testing Checklist

### Pre-Test Setup
1. **Login** to the CRM application
2. Go to **Admin Settings** → **MAC Address Search Settings**
3. **Enable** the "Enable MAC Search Feature" toggle

### Test 1: Portal Configuration
- [ ] "Configured Portals" section visible
- [ ] "Unconfigured Portals" section shows Ditto portal
- [ ] Can see "Ditto Billing Portal" with:
  - [ ] Portal name
  - [ ] Portal URL
  - [ ] "Pending" status badge

### Test 2: Add Credentials
1. Scroll to "Unconfigured Portals" section
2. Enter valid Ditto portal credentials:
   - [ ] Username field filled
   - [ ] Password field filled (with eye toggle)
3. Click **Save Credentials**
4. Verify success message appears
5. Portal should move to "Configured Portals" section

### Test 3: MAC Address Search
1. Go to **MAC Address Search** page
2. Enter test MAC address: `00:1A:79:B2:5A:58`
3. Click **Search**
4. Expected outcomes:
   - [ ] Loading spinner shows while searching
   - [ ] Results display (either found or "0 results")
   - [ ] No "Executable doesn't exist" error
   - [ ] Search history updated

### Test 4: Search Results
If MAC is found in portal:
- [ ] Account name displays
- [ ] MAC address displays
- [ ] Status displays
- [ ] Expiry date displays
- [ ] Export CSV button available

### Test 5: Search History
1. Click **History** tab
2. Verify recent searches appear:
   - [ ] MAC address shown
   - [ ] Result count shown
   - [ ] Search date/time shown

---

## Troubleshooting

### Issue: "Executable doesn't exist" Error

**Symptoms:**
- Playwright chromium not found
- Error message: `browserType.launch: Executable doesn't exist`

**Solutions (in order):**

1. **Check Render Build Logs**
   - Go to Render Dashboard → devtest service → Logs
   - Look for "Installing Playwright" message
   - If not present, clear build cache and redeploy

2. **Verify Postinstall Script**
   - Check `package.json` has postinstall script
   - Check build script includes playwright install

3. **Clear Build Cache**
   - Render Dashboard → Settings → Build & Deploy
   - Click **Clear Build Cache**
   - Click **Manual Deploy**

4. **Force Fresh Build**
   - Make a minor code change to `package.json`
   - Commit and push to trigger rebuild
   - Or use manual deploy button

### Issue: "No credentials configured" Error

**Symptoms:**
- Search runs but returns error for portal

**Solutions:**

1. **Verify Credentials Saved**
   - Go to MAC Search Settings
   - Check if portal shows "Active" badge in Configured Portals section

2. **Check Database**
   - Verify `billing_portal_credentials` table has entry
   - Check `organization_id` and `portal_id` match

3. **Re-save Credentials**
   - Click "Change Credentials" on configured portal
   - Re-enter username and password
   - Click Update Credentials

### Issue: "Search failed" Error

**Symptoms:**
- Generic search failure message
- Unclear root cause

**Solutions:**

1. **Check Server Logs**
   - Render Dashboard → Logs
   - Look for 🔍 and 📍 log messages from MAC search
   - Check for navigation or login errors

2. **Verify Portal Configuration**
   - Check `backend/config/billingPortals.js`
   - Verify URL is correct and accessible
   - Verify loginPath and usersListPath are correct

3. **Test Portal Manually**
   - Visit portal URL in browser
   - Verify login page loads
   - Verify users list page exists after login

### Issue: "0 results" When MAC Should Be Found

**Symptoms:**
- Search completes successfully
- But returns 0 results despite MAC existing in portal

**Solutions:**

1. **Check Table Configuration**
   - Verify `tableConfig` in `billingPortals.js`
   - Check `rowSelector` matches actual table structure
   - Verify column indices are correct:
     - `nameColumn` - account name column
     - `statusColumn` - status column
     - `expiryColumn` - expiry date column

2. **Check Search Input Selector**
   - Verify portal has searchable input field
   - Check input selector in code matches actual element

3. **Verify MAC Format**
   - MAC must be in format: `XX:XX:XX:XX:XX:XX` or `XX-XX-XX-XX-XX-XX`
   - Check if portal search is case-sensitive

---

## Server Log Indicators

### Success Indicators
```
🔍 Starting search in Ditto Billing Portal...
📍 Navigating to: https://billing.dittotvv.cc/login
📍 Navigating to users list: https://billing.dittotvv.cc/dealer/users
🔐 Logging in with username: sky711
✅ Login successful
🔎 Searching for MAC: 00:1A:79:B2:5A:58
📊 Found 100 rows in table
✨ Found matching MAC in row!
📈 Search complete: Found 1 matching MAC addresses
```

### Error Indicators
```
❌ Error searching portal Ditto Billing Portal: timeout
⚠️  No search input found on page
browserType.launch: Executable doesn't exist
```

---

## Render Deployment Notes

### Build Process
1. **npm install --force** - Installs all dependencies
2. **npx playwright install chromium --with-deps** - Installs browsers
3. **node scripts/ensure-playwright.js** - Startup check at runtime
4. **node scripts/production-super-admin-setup.js** - User setup
5. **node server.js** - Starts application

### Files Changed for Deployment
- `package.json` - Build and start scripts
- `scripts/ensure-playwright.js` - Startup browser check
- `routes/macSearch.js` - PostgreSQL conversion
- `services/macAddressSearchService.js` - PostgreSQL + logging
- `backend/migrations/002-mac-search-tables.sql` - Database tables
- `frontend/src/pages/MacAddressSearch.jsx` - API client fix

---

## Performance Considerations

### Search Timeout
- Default: 30 seconds per portal
- Configurable in `billingPortals.js` → `timeout` field
- Increase if portal loads slowly

### Parallel Searches
- Multiple portals searched in parallel
- Total time ≈ slowest portal response time
- Not sequential, so scales well

### Browser Resource Usage
- One browser instance per search
- Cleaned up immediately after completion
- Should not cause memory leaks

---

## FAQ

**Q: How do I add a new billing portal?**
A: Go to MAC Search Settings → Add Custom Portal → Enter name and URL → Save

**Q: Can I use both built-in and custom portals?**
A: Yes, they appear together in the search results

**Q: Are credentials encrypted?**
A: Yes, using AES-256-CBC encryption with IV

**Q: How long does a search take?**
A: 20-60 seconds per portal depending on page load time and table size

**Q: Can I search multiple portals at once?**
A: Yes, all configured portals are searched in parallel automatically

**Q: What happens if a portal is down?**
A: That portal's result will show an error, others continue searching

---

## Contact & Support

For issues or questions about MAC Address Search deployment:
1. Check server logs in Render dashboard
2. Review troubleshooting section above
3. Check GitHub commits for recent changes
4. Verify all environment variables are set correctly

---

**Last Updated:** 2026-02-08
**Status:** All fixes deployed to devtest branch
**Next Steps:** Deploy to production after testing
