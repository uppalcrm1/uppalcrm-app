# Quick Reference: Why Authentication Breaks in c1351e4 & e309171

## One-Sentence Summary
**c1351e4** sends timezone header on login → CORS preflight fails → login blocked.
**e309171** prevents header on login but never sets it in API service → later requests fail + missing CORS config.

---

## The 4 Root Causes (In Order of Impact)

### 1. CORS Header Missing (Affects Both)
- **What**: `X-User-Timezone` not in CORS allowedHeaders
- **Where**: `middleware/security.js` line 346
- **Fix**: Add `'X-User-Timezone'` to allowedHeaders array
- **Impact**: CRITICAL - Causes preflight rejection on ANY request with the header

### 2. Timezone Header Sent Too Early (Affects c1351e4 Only)
- **What**: Header set unconditionally on page load, before login
- **Where**: `frontend/src/services/api.js` lines 45-51
- **Fix**: Only set header if `authToken` exists
- **Impact**: CRITICAL - Login request includes header → browser blocks it

### 3. setUserTimezone() Never Called (Affects Both)
- **What**: Function exists but never imported or called in login flow
- **Where**: `frontend/src/contexts/AuthContext.jsx` login function
- **Fix**: Call `setUserTimezone(data.user.timezone)` after login
- **Impact**: CRITICAL - Header never set in axios instance after auth

### 4. Database Migration Not Run + Model Not Updated (Affects Both)
- **What**: timezone column doesn't exist in database, User.toJSON() doesn't include it
- **Where**: Database + `models/User.js`
- **Fix**: Run migration, add timezone to User constructor and toJSON()
- **Impact**: HIGH - User preferences lost, responses incomplete

---

## Authentication Flow Comparison

### ff838ad (WORKING)
```
1. Page load
2. No timezone header (doesn't exist yet)
3. User login
4. Backend authenticates
5. Frontend stores token
6. /auth/me succeeds
7. App works
```

### c1351e4 (BROKEN)
```
1. Page load
2. ❌ Sets timezone header unconditionally
3. User clicks login
4. ❌ Browser sends preflight for custom header
5. ❌ Server rejects (header not in CORS config)
6. ❌ Browser blocks login request
7. ❌ Login fails immediately
```

### e309171 (STILL BROKEN)
```
1. Page load
2. ✓ No header (conditional on authToken)
3. User clicks login
4. ✓ Login succeeds (no custom header)
5. ❌ setUserTimezone() never called
6. ❌ Header not in axios instance
7. ❌ /auth/me request fails (if backend validates) or
8. ❌ Later authenticated requests fail (if header suddenly needed)
```

---

## Code Changes Required

### middleware/security.js
```diff
      'X-Webhook-Source'
+     'X-User-Timezone'
```

### frontend/src/services/api.js
```diff
+ export const setUserTimezone = (timezone) => {
+   userTimezone = timezone
+   localStorage.setItem('userTimezone', timezone)
+   api.defaults.headers.common['X-User-Timezone'] = timezone
+ }
```

### frontend/src/contexts/AuthContext.jsx
```diff
- import { authAPI, setAuthToken, setOrganizationSlug, clearAuth }
+ import { authAPI, setAuthToken, setOrganizationSlug, setUserTimezone, clearAuth }

  const login = async (email, password) => {
    const data = await authAPI.login(email, password)
    setAuthToken(data.token)
    setOrganizationSlug(data.organization.slug)
+   setUserTimezone(data.user?.timezone || 'America/New_York')
```

### models/User.js
```diff
  constructor(data = {}) {
    // ...
+   this.timezone = data.timezone || 'America/New_York';
  }

  toJSON() {
    return {
      // ...
+     timezone: this.timezone,
    }
  }
```

### Database
```bash
node scripts/run-timezone-migration.js
```

---

## Why Each Fix is Necessary

| Fix | Without It | With It |
|-----|-----------|---------|
| CORS Header | Preflight fails on any request with custom header | Browser allows custom header in preflight response |
| Conditional Header | Header sent on login → preflight → blocked | Header only on authenticated requests |
| setUserTimezone() Call | Header never in axios instance after login | Header properly set in all subsequent requests |
| Database Migration | Column doesn't exist → NULL values | User timezone data persists |
| User.toJSON() | Response missing timezone field | Frontend gets timezone from API |

---

## The Cascading Failure in c1351e4

```
Frontend tries to set header
    ↓
Header set unconditionally before login
    ↓
Login request includes custom header
    ↓
Browser sees custom header → sends preflight OPTIONS
    ↓
Server checks allowedHeaders → X-User-Timezone not found
    ↓
Server rejects OPTIONS request
    ↓
Browser blocks the actual POST request
    ↓
Frontend never receives login response
    ↓
Login fails with CORS error
    ↓
User can't authenticate
    ↓
Application is broken
```

---

## The Subtle Failure in e309171

```
Frontend conditionally sets header (only if logged in)
    ↓
Login request has no custom header (good!)
    ↓
Login succeeds (good!)
    ↓
AuthContext receives token and user data
    ↓
AuthContext stores timezone in localStorage
    ↓
BUT: AuthContext never calls setUserTimezone() function
    ↓
Timezone not in axios headers
    ↓
Later requests don't have X-User-Timezone header
    ↓
If backend validates header presence → request fails
    ↓
If backend doesn't validate → feature doesn't work anyway
    ↓
Application is partially broken
```

---

## How to Verify the Fix Works

```bash
# 1. Clear cache
# DevTools → Application → Clear storage

# 2. Restart backend
npm start

# 3. Open DevTools Network tab

# 4. Try login
# Observe: POST /auth/login succeeds
# Observe: Response includes user.timezone

# 5. Check subsequent requests
# Observe: X-User-Timezone header is present in /auth/me
# Observe: All requests succeed

# 6. Check browser console
console.log(localStorage.getItem('userTimezone'))
# Should show a valid timezone, not undefined
```

---

## Files That MUST be Changed

1. ✅ `middleware/security.js` - CORS configuration
2. ✅ `frontend/src/services/api.js` - Timezone management functions
3. ✅ `frontend/src/contexts/AuthContext.jsx` - Call setUserTimezone in login
4. ✅ `models/User.js` - Include timezone in responses
5. ✅ Database migration - Create timezone column

All 5 areas must be fixed. Fixing only some will leave auth broken.

---

## Why e309171 is Not Enough

e309171 **only** moves the header-setting logic to be conditional on `authToken`. This addresses the symptom (premature header) but not the root causes:

1. ❌ Doesn't add header to CORS config
2. ✓ Does prevent header on login (partial fix)
3. ❌ Doesn't call setUserTimezone() function
4. ❌ Doesn't run database migration
5. ❌ Doesn't update User model

It's a 20% solution that leaves 4 critical issues unresolved.

---

## Verification Checklist

After applying ALL fixes:

- [ ] CORS header added to middleware/security.js
- [ ] setUserTimezone() function exported from api.js
- [ ] setUserTimezone imported in AuthContext
- [ ] setUserTimezone called in login function
- [ ] setUserTimezone called in register function
- [ ] setUserTimezone called in initAuth useEffect
- [ ] timezone field added to User constructor
- [ ] timezone included in User.toJSON()
- [ ] Database migration executed
- [ ] Backend server restarted
- [ ] Browser cache cleared
- [ ] Login succeeds
- [ ] /auth/me request includes X-User-Timezone header
- [ ] API requests succeed with custom header
- [ ] Timezone persists after page reload

---

## Key Insight

The timezone feature is NOT broken in c1351e4 and e309171.
The **authentication system** is broken by the incomplete implementation of the timezone feature.

Specifically:
- Missing CORS configuration prevents the header from being sent
- Missing function calls prevent the header from being set in axios
- Missing database changes prevent timezone from being stored/retrieved
- Missing model changes prevent timezone from being returned in responses

Fix these 5 things, and both the timezone feature AND authentication will work.

