# Fix Guide: Restore DevTest Authentication

This guide provides the exact changes needed to restore authentication functionality on devtest while keeping the timezone feature from c1351e4.

---

## Prerequisites

Before applying fixes, ensure:
1. Current branch is devtest
2. Current commit is ff838ad (working version)
3. You have access to run database migrations

---

## Fix #1: Add X-User-Timezone to CORS allowedHeaders

**File**: `/c/Users/uppal/uppal-crm-project/middleware/security.js`

**Location**: Lines 336-347

**Current Code**:
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
]
```

**Change To**:
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
  'X-Webhook-Source',
  'X-User-Timezone'
]
```

**Why**: Allows the browser to send the custom header without CORS preflight rejection.

---

## Fix #2: Update frontend/src/services/api.js

**File**: `/c/Users/uppal/uppal-crm-project/frontend/src/services/api.js`

**Location**: Lines 20-52

**Current Code**:
```javascript
// Auth token management
let authToken = localStorage.getItem('authToken')
let organizationSlug = localStorage.getItem('organizationSlug')

export const setAuthToken = (token) => {
  authToken = token
  localStorage.setItem('authToken', token)
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export const setOrganizationSlug = (slug) => {
  organizationSlug = slug
  localStorage.setItem('organizationSlug', slug)
  api.defaults.headers.common['X-Organization-Slug'] = slug
}

export const clearAuth = () => {
  authToken = null
  organizationSlug = null
  localStorage.removeItem('authToken')
  localStorage.removeItem('organizationSlug')
  delete api.defaults.headers.common['Authorization']
  delete api.defaults.headers.common['X-Organization-Slug']
}

// Set initial headers if tokens exist
if (authToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
}
if (organizationSlug) {
  api.defaults.headers.common['X-Organization-Slug'] = organizationSlug
}
```

**Change To**:
```javascript
// Auth token management
let authToken = localStorage.getItem('authToken')
let organizationSlug = localStorage.getItem('organizationSlug')
let userTimezone = localStorage.getItem('userTimezone') || 'America/New_York'

export const setAuthToken = (token) => {
  authToken = token
  localStorage.setItem('authToken', token)
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`
}

export const setOrganizationSlug = (slug) => {
  organizationSlug = slug
  localStorage.setItem('organizationSlug', slug)
  api.defaults.headers.common['X-Organization-Slug'] = slug
}

export const setUserTimezone = (timezone) => {
  userTimezone = timezone
  localStorage.setItem('userTimezone', timezone)
  api.defaults.headers.common['X-User-Timezone'] = timezone
}

export const clearAuth = () => {
  authToken = null
  organizationSlug = null
  userTimezone = 'America/New_York'
  localStorage.removeItem('authToken')
  localStorage.removeItem('organizationSlug')
  localStorage.removeItem('userTimezone')
  delete api.defaults.headers.common['Authorization']
  delete api.defaults.headers.common['X-Organization-Slug']
  delete api.defaults.headers.common['X-User-Timezone']
}

// Set initial headers if tokens exist
if (authToken) {
  api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`
  // Only set timezone header if we have an auth token (user is logged in)
  if (userTimezone) {
    api.defaults.headers.common['X-User-Timezone'] = userTimezone
  }
}
if (organizationSlug) {
  api.defaults.headers.common['X-Organization-Slug'] = organizationSlug
}
```

**Why**:
- Adds `setUserTimezone()` function so AuthContext can update headers after login
- Stores timezone in variable so it persists across requests
- Only sets header if user is authenticated (prevents header on login request)
- Clears timezone on logout

---

## Fix #3: Update frontend/src/contexts/AuthContext.jsx

**File**: `/c/Users/uppal/uppal-crm-project/frontend/src/contexts/AuthContext.jsx`

**Location**: Import statement (top of file)

**Current Code**:
```javascript
import { authAPI, setAuthToken, setOrganizationSlug, clearAuth } from '../services/api'
```

**Change To**:
```javascript
import { authAPI, setAuthToken, setOrganizationSlug, setUserTimezone, clearAuth } from '../services/api'
```

**Why**: Imports the timezone-setting function so it can be called in the login flow.

---

## Fix #4: Update AuthContext login Function

**File**: `/c/Users/uppal/uppal-crm-project/frontend/src/contexts/AuthContext.jsx`

**Location**: login function (around line 100-130)

**Current Code**:
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

    dispatch({
      type: 'AUTH_SUCCESS',
      payload: {
        user: data.user,
        organization: data.organization,
      },
    })

    toast.success(`Welcome back, ${data.user.first_name}!`)
    return { success: true, data }
  } catch (error) {
    dispatch({ type: 'AUTH_ERROR' })
    const message = error.response?.data?.message || 'Login failed'
    toast.error(message)
    return { success: false, error: message }
  }
}
```

**Change To**:
```javascript
const login = async (email, password) => {
  dispatch({ type: 'AUTH_START' })

  try {
    const data = await authAPI.login(email, password)

    setAuthToken(data.token)
    setOrganizationSlug(data.organization.slug)

    // Store timezone from login response and update API headers
    const userTimezone = data.user?.timezone || 'America/New_York'
    setUserTimezone(userTimezone)  // ← THIS IS CRITICAL

    dispatch({
      type: 'AUTH_SUCCESS',
      payload: {
        user: data.user,
        organization: data.organization,
      },
    })

    toast.success(`Welcome back, ${data.user.first_name}!`)
    return { success: true, data }
  } catch (error) {
    dispatch({ type: 'AUTH_ERROR' })
    const message = error.response?.data?.message || 'Login failed'
    toast.error(message)
    return { success: false, error: message }
  }
}
```

**Why**: Calls `setUserTimezone()` to update the axios headers with the user's actual timezone after login succeeds.

---

## Fix #5: Update AuthContext register Function

**File**: `/c/Users/uppal/uppal-crm-project/frontend/src/contexts/AuthContext.jsx`

**Location**: register function (around line 160-190)

**Current Code**:
```javascript
const register = async (organizationData, adminData) => {
  dispatch({ type: 'AUTH_START' })

  try {
    const data = await authAPI.register(organizationData, adminData)

    setAuthToken(data.token)
    setOrganizationSlug(data.organization.slug)

    // Store timezone from register response
    const userTimezone = data.user?.timezone || 'America/New_York'
    localStorage.setItem('userTimezone', userTimezone)

    dispatch({
      type: 'AUTH_SUCCESS',
      payload: {
        user: data.user,
        organization: data.organization,
```

**Change To**:
```javascript
const register = async (organizationData, adminData) => {
  dispatch({ type: 'AUTH_START' })

  try {
    const data = await authAPI.register(organizationData, adminData)

    setAuthToken(data.token)
    setOrganizationSlug(data.organization.slug)

    // Store timezone from register response and update API headers
    const userTimezone = data.user?.timezone || 'America/New_York'
    setUserTimezone(userTimezone)  // ← THIS IS CRITICAL

    dispatch({
      type: 'AUTH_SUCCESS',
      payload: {
        user: data.user,
        organization: data.organization,
```

**Why**: Same as Fix #4, ensures timezone is set on registration as well.

---

## Fix #6: Update AuthContext initAuth useEffect

**File**: `/c/Users/uppal/uppal-crm-project/frontend/src/contexts/AuthContext.jsx`

**Location**: useEffect in AuthProvider (around line 55-90)

**Current Code**:
```javascript
useEffect(() => {
  const initAuth = async () => {
    const token = localStorage.getItem('authToken')
    const storedTimezone = localStorage.getItem('userTimezone')

    if (!token) {
      dispatch({ type: 'AUTH_ERROR' })
      return
    }

    try {
      setAuthToken(token)
      const data = await authAPI.me()

      // Set organization slug from the response if not already set
      if (data.organization?.slug) {
        setOrganizationSlug(data.organization.slug)
      }

      // Store timezone from user data
      const userTimezone = data.user?.timezone || storedTimezone || 'America/New_York'
      localStorage.setItem('userTimezone', userTimezone)

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: data.user,
          organization: data.organization,
        },
      })
    } catch (error) {
      console.error('Auth initialization failed:', error)
      clearAuth()
      dispatch({ type: 'AUTH_ERROR' })
    }
  }

  initAuth()
}, [])
```

**Change To**:
```javascript
useEffect(() => {
  const initAuth = async () => {
    const token = localStorage.getItem('authToken')
    const storedTimezone = localStorage.getItem('userTimezone')

    if (!token) {
      dispatch({ type: 'AUTH_ERROR' })
      return
    }

    try {
      setAuthToken(token)

      // Also restore timezone from localStorage on app initialization
      if (storedTimezone) {
        setUserTimezone(storedTimezone)
      }

      const data = await authAPI.me()

      // Set organization slug from the response if not already set
      if (data.organization?.slug) {
        setOrganizationSlug(data.organization.slug)
      }

      // Update timezone from user data (in case it changed server-side)
      const userTimezone = data.user?.timezone || storedTimezone || 'America/New_York'
      setUserTimezone(userTimezone)  // ← THIS IS CRITICAL

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: data.user,
          organization: data.organization,
        },
      })
    } catch (error) {
      console.error('Auth initialization failed:', error)
      clearAuth()
      dispatch({ type: 'AUTH_ERROR' })
    }
  }

  initAuth()
}, [])
```

**Why**: Ensures timezone header is set during app initialization from both localStorage and fresh user data.

---

## Fix #7: Update User Model Constructor

**File**: `/c/Users/uppal/uppal-crm-project/models/User.js`

**Location**: constructor method (around line 5-30)

**Current Code**:
```javascript
constructor(data = {}) {
  this.id = data.id;
  this.organization_id = data.organization_id;
  this.email = data.email;
  this.name = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
  this.first_name = data.first_name;
  this.last_name = data.last_name;
  this.role = data.role || 'user';
  this.status = data.status || 'active';
  this.permissions = data.permissions || [];
  this.last_login = data.last_login;
  this.email_verified = data.email_verified || false;
  this.is_active = data.is_active !== false;
  this.is_first_login = data.is_first_login || false;
  this.failed_login_attempts = data.failed_login_attempts || 0;
  this.created_at = data.created_at;
  this.updated_at = data.updated_at;
  this.deleted_at = data.deleted_at;
  this.created_by = data.created_by;
}
```

**Change To**:
```javascript
constructor(data = {}) {
  this.id = data.id;
  this.organization_id = data.organization_id;
  this.email = data.email;
  this.name = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
  this.first_name = data.first_name;
  this.last_name = data.last_name;
  this.role = data.role || 'user';
  this.status = data.status || 'active';
  this.permissions = data.permissions || [];
  this.last_login = data.last_login;
  this.email_verified = data.email_verified || false;
  this.is_active = data.is_active !== false;
  this.is_first_login = data.is_first_login || false;
  this.failed_login_attempts = data.failed_login_attempts || 0;
  this.timezone = data.timezone || 'America/New_York';  // ← ADD THIS LINE
  this.created_at = data.created_at;
  this.updated_at = data.updated_at;
  this.deleted_at = data.deleted_at;
  this.created_by = data.created_by;
}
```

**Why**: Ensures timezone is properly initialized when a User instance is created from database data.

---

## Fix #8: Update User.toJSON() Method

**File**: `/c/Users/uppal/uppal-crm-project/models/User.js`

**Location**: toJSON method (at the end of the class)

**Current Code**:
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
  };
}
```

**Change To**:
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
    timezone: this.timezone,  // ← ADD THIS LINE
    created_at: this.created_at,
    updated_at: this.updated_at
  };
}
```

**Why**: Includes timezone in API responses so the frontend knows the user's timezone preference.

---

## Fix #9: Run Database Migration

**Command**:
```bash
cd /c/Users/uppal/uppal-crm-project
node scripts/run-timezone-migration.js
```

**Or manually if the script doesn't exist**:
```bash
psql -d $DATABASE_URL -c "
ALTER TABLE users
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';

CREATE INDEX IF NOT EXISTS idx_users_timezone
ON users(timezone);
"
```

**Why**: Creates the timezone column in the database so user preferences can be stored and retrieved.

---

## Testing Checklist

After applying all fixes:

1. **Clear Browser Cache**
   - DevTools → Application → Clear storage
   - Or open in Incognito/Private window

2. **Restart Backend Server**
   ```bash
   npm start  # or your start command
   ```

3. **Test Login Flow**
   - Navigate to login page
   - Check browser DevTools Network tab
   - Verify login POST request succeeds (no CORS errors)
   - Verify response includes `user.timezone`
   - Verify user is logged in

4. **Test Authenticated Requests**
   - After login, check any API request in DevTools
   - Verify `X-User-Timezone` header is present
   - Verify requests succeed (no CORS errors)

5. **Test Logout**
   - Click logout
   - Verify headers are cleared
   - Verify can't access protected pages

6. **Test Page Reload**
   - Login
   - Reload page
   - Verify you stay logged in
   - Verify timezone header is still present

---

## Verification Commands

### Check CORS Header
```javascript
// In browser DevTools console, after login:
fetch('/api/auth/me', {
  headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
}).then(r => r.json()).then(console.log)
```

### Check User Timezone in Response
```javascript
// In browser DevTools console:
console.log(JSON.parse(localStorage.getItem('userTimezone')))
```

### Check Database Migration
```bash
# If using PostgreSQL:
psql -d $DATABASE_URL -c "\d users"

# Should show:
# timezone | character varying | | not null | 'America/New_York'::character varying
```

---

## Rollback Instructions

If something goes wrong:

1. **Revert code changes**: `git checkout HEAD -- middleware/security.js frontend/src/`
2. **Restore from backup**: If database migration caused issues, use rollback:
   ```bash
   # Create a migration rollback
   node -e "const m = require('./database/migrations/001-add-timezone-to-users'); m.down();"
   ```

---

## Summary of Changes

| File | Type | Lines | Changes |
|------|------|-------|---------|
| middleware/security.js | config | 346 | Add `X-User-Timezone` to allowedHeaders |
| frontend/src/services/api.js | feature | 20-52 | Add timezone management functions |
| frontend/src/contexts/AuthContext.jsx | import | 1-3 | Import setUserTimezone |
| frontend/src/contexts/AuthContext.jsx | function | login | Add setUserTimezone call |
| frontend/src/contexts/AuthContext.jsx | function | register | Add setUserTimezone call |
| frontend/src/contexts/AuthContext.jsx | effect | initAuth | Add setUserTimezone calls |
| models/User.js | constructor | 20 | Add timezone field initialization |
| models/User.js | method | toJSON | Add timezone to response |
| database | migration | N/A | Run timezone migration |

---

## Why These Changes Work Together

1. **CORS Header** allows browser to send custom header without preflight rejection
2. **api.js Functions** provide the mechanism to update headers dynamically
3. **AuthContext Calls** ensure headers are set at the right time (after auth confirmation)
4. **User Model** properly handles timezone data from database and in API responses
5. **Database Migration** creates the column where timezone is actually stored

All 9 changes are required. Missing even one will cause the feature to fail.

