# Authentication Issue Analysis: c1351e4 & e309171 Breaking devtest

## Summary
Both commits c1351e4 and e309171 break authentication on devtest, but for **different reasons**. The attempted fix in e309171 only addresses a CORS header issue, but c1351e4 has multiple other critical problems that prevent authentication from working.

---

## Issue #1: Missing CORS Header Configuration (CRITICAL - Affects Both)

### The Problem
The timezone feature introduces a new custom header `X-User-Timezone` that is sent on ALL authenticated API requests. However, the CORS configuration in `middleware/security.js` does NOT allow this header.

### Current CORS Configuration (lines 336-347)
```javascript
allowedHeaders: [
  'Origin',
  'X-Requested-With',
  'Content-Type',
  'Accept',
  'Authorization',
  'X-Organization-Slug',
  'X-Organization-ID',
  'X-API-Key',
  'X-Webhook-Id',
  'X-Webhook-Source'
  // ❌ X-User-Timezone is MISSING!
]
```

### Why This Breaks Authentication
1. In **c1351e4**, the frontend's `api.js` sets `X-User-Timezone` header on ALL requests (lines 45-51):
   ```javascript
   if (userTimezone) {
     api.defaults.headers.common['X-User-Timezone'] = userTimezone
   }
   ```
   This includes the LOGIN request itself.

2. When a custom header is used, the browser sends a CORS preflight (OPTIONS) request first to verify the server allows it.

3. The server rejects the preflight because `X-User-Timezone` is not in `allowedHeaders`.

4. The preflight failure causes the actual login POST request to be blocked.

### Attempted Fix in e309171
The e309171 commit tries to fix this by only setting the header AFTER login:
```javascript
// Set initial headers if tokens exist
if (authToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
  // Only set timezone header if we have an auth token (user is logged in)
  if (userTimezone) {
    api.defaults.headers.common['X-User-Timezone'] = userTimezone
  }
}
```

### Why e309171 Still Doesn't Work
While e309171 prevents the timezone header from being sent on the LOGIN request (avoiding the preflight), this **STILL BREAKS** because:

1. **The header is never added to subsequent authenticated requests** - The code only sets the header during app initialization from localStorage. It doesn't call `setUserTimezone()` during login.

2. **`setUserTimezone()` function is never imported or called** in AuthContext - The login function stores timezone in localStorage but never calls `setUserTimezone(data.user.timezone)` to update the axios headers.

3. **Later authenticated requests will fail** - After login, when the app makes authenticated requests (like `/auth/me` or any API call), the header still won't be set because `setUserTimezone()` was never called.

4. **The CORS issue still exists in the background** - Once the timezone header needs to be sent, it will hit the same CORS preflight rejection because `X-User-Timezone` is still not in the CORS allowedHeaders list.

---

## Issue #2: Missing setUserTimezone() Call in AuthContext Login (CRITICAL - Only Affects e309171)

### The Problem
In the login flow (`frontend/src/contexts/AuthContext.jsx`), the timezone is stored in localStorage but `setUserTimezone()` is never called to update the API service headers.

### c1351e4 AuthContext.jsx (lines 120-130)
```javascript
const login = async (email, password) => {
  dispatch({ type: 'AUTH_START' })

  try {
    const data = await authAPI.login(email, password)

    setAuthToken(data.token)
    setOrganizationSlug(data.organization.slug)

    // Store timezone from login response
    const userTimezone = data.user?.timezone || 'America/New_York'
    localStorage.setItem('userTimezone', userTimezone)
    // ❌ Missing: setUserTimezone(userTimezone)

    dispatch({
      type: 'AUTH_SUCCESS',
      payload: {
        user: data.user,
        organization: data.organization,
      },
    })
```

### Impact
- The timezone is stored in localStorage (line: `localStorage.setItem('userTimezone', userTimezone)`)
- But it's never set in the API service headers via `setUserTimezone()`
- This means subsequent requests won't have the timezone header set
- When requests try to include the header, they'll hit the CORS preflight issue

---

## Issue #3: Database Migration Not Run (POTENTIAL)

### The Problem
The commit c1351e4 includes a database migration (`database/migrations/001-add-timezone-to-users.js`) that adds the timezone column to the users table.

### Current State
The migration hasn't been run on devtest yet. This means:
- The `timezone` column doesn't exist in the users table
- When the User model tries to query the timezone field, it will fail
- The login response won't include timezone (since the column doesn't exist)

### The Migration Code
```javascript
async function up() {
  try {
    console.log('⏱️  Starting timezone migration (up)...');

    // Add timezone column to users table
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
    `);
    console.log('✓ Added timezone column to users table');
```

### Fix Required
The migration needs to be run with: `node scripts/run-timezone-migration.js`

---

## Issue #4: Timezone Not Included in User.toJSON() Response (POTENTIAL - Affects e309171)

### The Problem
The User model in c1351e4 was updated to include timezone in the JWT payload:
```javascript
async generateToken(ipAddress = null, userAgent = null) {
  const payload = {
    userId: this.id,
    organizationId: this.organization_id,
    email: this.email,
    role: this.role,
    timezone: this.timezone  // ✓ Added to JWT
  };
```

However, looking at the current User.js model in the working state (ff838ad), the `toJSON()` method doesn't include timezone:

**Current toJSON() (ff838ad)**:
```javascript
toJSON() {
  return {
    id: this.id,
    organization_id: this.organization_id,
    email: this.email,
    first_name: this.first_name,
    last_name: this.last_name,
    full_name: this.getFullName(),
    role: this.role,
    permissions: this.permissions,
    last_login: this.last_login,
    email_verified: this.email_verified,
    is_active: this.is_active,
    created_at: this.created_at,
    updated_at: this.updated_at
    // ❌ timezone is missing!
  };
}
```

**Expected in c1351e4**:
```javascript
toJSON() {
  return {
    // ... all above fields ...
    timezone: this.timezone,  // ✓ Should be here
    created_at: this.created_at,
    updated_at: this.updated_at
  };
}
```

### Why This Matters
If the timezone column doesn't exist in the database and the User model hasn't been updated to include timezone in the response, the login endpoint will return a response without timezone:

```javascript
res.json({
  message: 'Login successful',
  user: tokenData.user,  // timezone field is missing here
  token: tokenData.token,
  expires_at: tokenData.expiresAt,
  organization: organization.toJSON()
});
```

Then in AuthContext:
```javascript
const userTimezone = data.user?.timezone || 'America/New_York'  // Falls back to default
localStorage.setItem('userTimezone', userTimezone)  // Stores default, not user's preference
```

---

## Summary of Root Causes

### c1351e4 Breaks devtest Because:
1. ✓ **CORS Header Missing** - `X-User-Timezone` not in allowedHeaders (will cause preflight rejection)
2. ✓ **Login Request Sends Timezone Header** - Triggers preflight on login endpoint (immediate failure)
3. ? **Database Migration Not Run** - `timezone` column doesn't exist (will cause NULL fields)
4. ? **User Model Not Updated** - `toJSON()` doesn't include timezone field

### e309171 Still Breaks devtest Because:
1. ✓ **CORS Header Still Missing** - The header is still not in allowedHeaders (fixes login, breaks later requests)
2. ✓ **setUserTimezone() Never Called** - Header won't be set in API service, so later requests fail
3. ✓ **Conditional Header Setting Too Late** - Once AuthContext initializes, it tries to set header from localStorage
4. ? **Database Migration Still Not Run** - Migration still wasn't executed
5. ? **User.toJSON() Still Missing timezone** - Response still won't include timezone field

---

## Complete Fix Checklist

To fix devtest authentication, the following must be applied:

### 1. Add CORS Header (middleware/security.js line 346)
```diff
      'X-API-Key',
      'X-Webhook-Id',
      'X-Webhook-Source',
+     'X-User-Timezone'
```

### 2. Conditionally Set Timezone Header in api.js
The header should only be set for authenticated requests, not during login:
```javascript
export const setUserTimezone = (timezone) => {
  userTimezone = timezone
  localStorage.setItem('userTimezone', timezone)
  api.defaults.headers.common['X-User-Timezone'] = timezone
}

// Set initial headers if tokens exist
if (authToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
  if (userTimezone) {
    api.defaults.headers.common['X-User-Timezone'] = userTimezone
  }
}
if (organizationSlug) {
  api.defaults.headers.common['X-Organization-Slug'] = organizationSlug
}
```

### 3. Call setUserTimezone() in AuthContext Login
```diff
+import { authAPI, setAuthToken, setOrganizationSlug, setUserTimezone, clearAuth } from '../services/api'

const login = async (email, password) => {
  dispatch({ type: 'AUTH_START' })

  try {
    const data = await authAPI.login(email, password)

    setAuthToken(data.token)
    setOrganizationSlug(data.organization.slug)

    // Store timezone from login response
    const userTimezone = data.user?.timezone || 'America/New_York'
    localStorage.setItem('userTimezone', userTimezone)
+   setUserTimezone(userTimezone)  // ← THIS IS CRITICAL

    dispatch({
      type: 'AUTH_SUCCESS',
      payload: {
        user: data.user,
        organization: data.organization,
      },
    })
```

### 4. Update User.toJSON() to Include timezone
```diff
  toJSON() {
    return {
      id: this.id,
      organization_id: this.organization_id,
      email: this.email,
      first_name: this.first_name,
      last_name: this.last_name,
      full_name: this.getFullName(),
      role: this.role,
      permissions: this.permissions,
      last_login: this.last_login,
      email_verified: this.email_verified,
      is_active: this.is_active,
+     timezone: this.timezone,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
```

### 5. Run Database Migration
```bash
node scripts/run-timezone-migration.js
```

### 6. Update User Constructor to Handle timezone
Ensure User constructor properly initializes timezone field from database:
```javascript
constructor(data = {}) {
  // ... other fields ...
  this.timezone = data.timezone || 'America/New_York';
  // ...
}
```

---

## Why e309171's Approach is Insufficient

e309171 only moves the timezone header to be conditional on `authToken` existing. This addresses the CORS preflight issue during login, but creates a new problem:

1. The header won't be sent for the initial `/auth/me` check after page load
2. The `setUserTimezone()` function is never imported or called
3. When AuthContext mounts, it tries to validate the token with `/auth/me`
4. This request won't have the timezone header (because `setUserTimezone()` was never called)
5. Subsequent authenticated requests also won't have the header

The issue is that e309171 tries to solve a symptom (CORS preflight error) rather than the root cause (missing CORS configuration and missing function calls).

---

## Testing After Fix

Once all fixes are applied:

1. Restart the backend server (to pick up middleware changes)
2. Clear browser localStorage and cache
3. Navigate to login page
4. Verify login request succeeds
5. Verify `/auth/me` request includes `X-User-Timezone` header
6. Verify timezone is returned in user profile

