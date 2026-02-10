# MAC Address Search - Troubleshooting Guide

## Problem Summary

You have **2 issues**:

1. ❌ **Only searching 1 portal** (should be 2)
2. ❌ **Login failing on Ditto portal** - "Login form not found"

---

# ISSUE 1: Only 1 Portal Configured

## The Problem

Your `config/billingPortals.js` file only has **Ditto portal** configured.

```javascript
module.exports = {
  portals: [
    {
      id: 'ditto-billing-1',
      name: 'Ditto Billing Portal',
      // ...
    },
    // ❌ MISSING: Second portal!
  ],
}
```

## The Solution

### Step 1: Get Information About Your Second Portal

You need to provide:

```
PORTAL 2 INFORMATION NEEDED:
├─ Portal URL: https://your-second-portal.com
├─ Login path: /login (or /signin)
├─ Device/MAC list path: /devices (or /users, /products, etc.)
├─ Login credentials: username and password
└─ Table structure: which columns contain:
    ├─ MAC address column number (0, 1, 2...?)
    ├─ Account name column number
    ├─ Status column number
    └─ Expiry date column number
```

### Step 2: Example - How to Find Portal Details

**Navigate to the portal manually:**

1. Go to: `https://your-second-portal.com`
2. Look at the login form:
   - What are the field names? (username, email, user_id?)
   - Are there input fields, buttons?
   - What's the button text? (Login, Sign In, Continue?)

3. After login, find where MACs are displayed:
   - Is it a table with rows?
   - What columns are shown? (MAC | Device Name | Status | Expiry Date | ...)
   - Which column number contains the MAC? (0=first, 1=second, etc.)

### Step 3: Update the Config File

Open `config/billingPortals.js` and uncomment/fill in the second portal:

```javascript
module.exports = {
  portals: [
    // First portal (Ditto)
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
        macColumn: 1,      // Column 1 has MAC
        nameColumn: 2,     // Column 2 has account name
        statusColumn: 4,   // Column 4 has status
        expiryColumn: 5,   // Column 5 has expiry
      },
      timeout: 30000,
    },

    // ✅ ADD YOUR SECOND PORTAL HERE
    {
      id: 'second-portal-id',
      name: 'Your Second Portal Name',
      url: 'https://billing.yourportal.com',  // ← Change this
      loginPath: '/login',                      // ← May need to change
      usersListPath: '/devices',                // ← May need to change
      enabled: true,
      searchType: 'table',
      tableConfig: {
        rowSelector: 'tr, [role="row"]',
        macColumn: 1,      // ← Adjust based on your table
        nameColumn: 2,     // ← Adjust
        statusColumn: 4,   // ← Adjust
        expiryColumn: 5,   // ← Adjust
      },
      timeout: 30000,
    },
  ],
}
```

### Step 4: How to Find Column Numbers

In your browser, when logged into the portal:

```
Looking at the device table:

  COL 0    | COL 1          | COL 2        | COL 3 | COL 4
┌─────────┬────────────────┬──────────────┬───────┬────────┐
│ ID      │ MAC ADDRESS    │ Device Name  │ Type  │ Status │
├─────────┼────────────────┼──────────────┼───────┼────────┤
│ 123     │ 00:1A:79:B2... │ Device ABC   │ Phone │ Active │
└─────────┴────────────────┴──────────────┴───────┴────────┘

macColumn: 1        ← MAC is in column 1
nameColumn: 2       ← Device name in column 2
statusColumn: 4     ← Status in column 4
```

Count from left to right starting at 0!

### Step 5: Deploy and Test

```bash
# After updating config/billingPortals.js:
git add config/billingPortals.js
git commit -m "config: Add second billing portal"
git push origin devtest

# Then trigger deployment on Render
```

After deployment, you should see **2 portals** in search results!

---

# ISSUE 2: Login Form Not Found on Ditto Portal

## The Problem

The system can't find the login form on Ditto portal:

```
❌ Login failed: Login form not found on page
```

This means the automated selectors can't locate:
- Username input field
- Password input field
- Login button

## Why This Happens

1. **Portal page structure is different** than expected
2. **JavaScript loads the form dynamically** (not in initial HTML)
3. **Portal blocks automated access** (anti-bot protection)
4. **Network timeout** before form loads

## How to Debug

### Step 1: Deploy with Enhanced Debugging

The latest commit (65958aa) added detailed debugging.

When the login fails, it will now log:
```
📊 PAGE STRUCTURE DEBUG:
  Current URL: https://billing.dittotvv.cc/login
  Page title: Ditto Billing - Login
  Found 1 form(s), 3 input field(s), 2 button(s)

  📝 INPUT FIELDS FOUND:
    [0] type="text" name="username" id="user-input" placeholder="Enter username" class="form-control"
    [1] type="password" name="password" id="pass-input" placeholder="Enter password" class="form-control"
    [2] type="hidden" name="csrf_token" id="csrf" ...

  🔘 BUTTONS FOUND:
    [0] text="Login" type="submit" name="login" class="btn btn-primary"
    [1] text="Forgot Password" type="button" name="forgot" class="btn btn-link"

  📸 Screenshot saved to: /tmp/ditto-login-debug-1707396000.png
```

### Step 2: Check the Logs After Failed Search

Trigger a search and check server logs:

```bash
# On Render, go to Logs tab
# Look for the PAGE STRUCTURE DEBUG output
# This tells you exactly what form fields exist
```

### Step 3: Update the Service with Correct Selectors

Once you see what the actual fields are, you can update the login logic:

**Example:** If logs show:
```
[0] type="text" name="username" id="user-input"
[1] type="password" name="password" id="pass-input"
[0] text="Login" type="submit"
```

Then the current code should work! But if it shows different field names, let me know what it is.

### Step 4: Common Issues & Fixes

#### Issue: "No input fields found"

```
Found 0 input field(s)
```

**Possible causes:**
- Page hasn't loaded yet
- Form is in an iframe
- Form loaded via JavaScript after page load

**Fix:**
- Wait longer for page load
- Check for iframes
- Use JavaScript to wait for elements

---

#### Issue: Fields have unusual names

```
[0] type="text" name="login_username_xyz" id="field_123"
```

**Fix:**
The code tries multiple selector patterns:
- `input[name*="username"]` ← Matches "login_username_xyz" ✅
- `input[id*="username"]` ← Matches id with "username"
- `input[type="text"]` ← Fallback for any text input

So it should still work!

---

#### Issue: Form in an iframe

```
The login form might be inside an iframe!
```

**Check in browser:**
Press F12 → Inspector → Look for `<iframe>` tags

**If you find an iframe:**
```javascript
// The code needs to switch to the iframe context
// Let me know and I'll add iframe support
```

---

## What to Do Now

### Immediate Actions:

1. **Provide second portal information** (from Issue 1)
   - URL
   - Login path
   - Device list path
   - Column positions for MAC address

2. **Trigger a new search** and share the debug logs:
   - Go to MAC Search page
   - Enter MAC address
   - Click Search
   - Share the server logs showing:
     ```
     📊 PAGE STRUCTURE DEBUG:
     ... (all the input field and button info)
     ```

3. **Take a manual screenshot** of Ditto login page:
   - Open: https://billing.dittotvv.cc/login
   - Show me what you see (the form fields, buttons)

### Once I Have This Info:

I can:
- ✅ Add the second portal config
- ✅ Fix the Ditto login issue with correct selectors
- ✅ Test everything works

---

## Quick Checklist

**For Second Portal:**
- [ ] Get portal URL
- [ ] Get login path
- [ ] Get device list path
- [ ] Get username/password for admin account
- [ ] Know which columns have MAC/Name/Status/Expiry
- [ ] Update config/billingPortals.js
- [ ] Deploy and test

**For Ditto Login Issue:**
- [ ] Deploy latest code (commit 65958aa)
- [ ] Trigger MAC search
- [ ] Share the "PAGE STRUCTURE DEBUG" logs
- [ ] Take screenshot of login page
- [ ] Send me the details

---

## File Locations

**Portal Config:**
- `config/billingPortals.js` ← Edit here

**Login Logic:**
- `services/macAddressSearchService.js` ← Will be fixed once I see debug logs

**Search Routes:**
- `routes/macSearch.js` ← API that triggers search

**Frontend:**
- `frontend/src/pages/MacAddressSearch.jsx` ← UI page

---

## Example: Complete Second Portal Config

Here's a full example if you have a second portal:

```javascript
{
  id: 'portal2-accounts',
  name: 'Portal 2 - Accounts',
  url: 'https://billing.portal2.com',
  loginPath: '/login',
  usersListPath: '/admin/accounts',  // Where MACs are listed
  enabled: true,
  searchType: 'table',
  tableConfig: {
    rowSelector: 'tbody tr',  // Standard HTML table rows
    macColumn: 2,             // 3rd column (MAC address)
    nameColumn: 1,            // 2nd column (Account name)
    statusColumn: 4,          // 5th column (Status)
    expiryColumn: 5,          // 6th column (Expiry)
  },
  timeout: 30000,
},
```

---

## Need Help?

Share the following:

1. **Second portal details:**
   ```
   Portal Name: ___________
   Portal URL: ___________
   Login username/password: ___________
   Device list page URL (after login): ___________
   ```

2. **Debug logs from Ditto:**
   ```
   Copy the full "PAGE STRUCTURE DEBUG" section from server logs
   ```

3. **Screenshot of Ditto login page:**
   - Just show me what the form looks like

Once you provide this, I can fix everything! 🚀
