# Phase 1A: Quick Start Guide

**Estimated Time:** 4-6 hours
**Difficulty:** Intermediate
**Prerequisites:** Node.js, PostgreSQL, existing CRM codebase understanding

---

## TL;DR - Essential Commands

```bash
# 1. Run database migration
node scripts/run-timezone-migration.js up

# 2. Install frontend dependency
cd frontend && npm install --save date-fns-tz@2.0.0

# 3. Run tests
npm test timezone

# 4. Start development
npm run dev
```

---

## 5-Minute Setup

### 1. Database Migration
```bash
node scripts/run-timezone-migration.js up
```

Output should show:
```
✓ Added timezone column to users table
✓ Added default_timezone to organization_settings
✓ Created index on timezone column
✅ Timezone migration (up) completed successfully
```

### 2. Backend Files (Copy-Paste Ready)

1. Update `models/User.js` - Add timezone field (3 locations)
2. Update `middleware/auth.js` - Include timezone in queries
3. Create `utils/timezone.js` - Timezone validation utilities
4. Create `utils/timezones.json` - List of all timezones
5. Create `routes/timezone.js` - API endpoints for timezone management
6. Update `server.js` - Register timezone routes

### 3. Frontend Setup

```bash
cd frontend
npm install --save date-fns-tz@2.0.0
```

1. Create `src/utils/timezoneUtils.js` - Timezone formatting functions
2. Update `src/contexts/AuthContext.jsx` - Add timezone state management
3. Update `src/services/api.js` - Add timezone headers & endpoints
4. Create `src/components/TimezoneSelector.jsx` - UI component

### 4. Quick Test

```bash
# Test API
curl http://localhost:3004/api/timezones

# Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3004/api/timezones/user
```

---

## File-by-File Implementation

### Files to Create

1. **`database/migrations/001-add-timezone-to-users.js`**
   - Location: New file
   - Copy from: PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md section 2.1

2. **`scripts/run-timezone-migration.js`**
   - Location: New file
   - Copy from: PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md section 1.2

3. **`utils/timezone.js`**
   - Location: New file
   - Copy from: PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md section 2.3

4. **`utils/timezones.json`**
   - Location: New file
   - Copy from: PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md section 2.4

5. **`routes/timezone.js`**
   - Location: New file
   - Copy from: PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md section 2.5

6. **`frontend/src/utils/timezoneUtils.js`**
   - Location: New file
   - Copy from: PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md section 3.2

7. **`frontend/src/components/TimezoneSelector.jsx`**
   - Location: New file
   - Copy from: PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md section 3.5

### Files to Modify

1. **`models/User.js`**
   - Add timezone to constructor
   - Add timezone to create() method
   - Add timezone to update() method
   - Add timezone to toJSON() method
   - Add timezone to verifyToken() query
   - Add timezone to generateToken() JWT payload

2. **`middleware/auth.js`**
   - No changes needed (User model updates handle this)

3. **`frontend/src/contexts/AuthContext.jsx`**
   - Add timezone to initialState
   - Add timezone to AUTH_SUCCESS case
   - Add timezone to AUTH_ERROR case
   - Add timezone handling in login()
   - Add timezone handling in register()
   - Add timezone handling in logout()
   - Add setTimezone() method

4. **`frontend/src/services/api.js`**
   - Add timezone header setup
   - Add setUserTimezone() export
   - Add getUserTimezone() export
   - Add timezone to request interceptor
   - Add timezoneAPI object with 3 methods

5. **`server.js`**
   - Add timezone routes registration: `app.use('/api/timezones', timezoneRoutes)`

6. **`frontend/package.json`**
   - Add date-fns-tz dependency (or use npm install)

---

## Step-by-Step Walkthrough

### Step 1: Prepare Database (10 min)

```bash
# 1a. Create migration file
# Copy file from spec section 2.1 to database/migrations/001-add-timezone-to-users.js

# 1b. Create migration runner
# Copy file from spec section 1.2 to scripts/run-timezone-migration.js

# 1c. Run migration
node scripts/run-timezone-migration.js up

# 1d. Verify
psql -d uppal_crm -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='timezone';"
```

### Step 2: Update User Model (15 min)

Open `models/User.js`:

**Change 1:** Constructor (line ~7)
```javascript
// Add after line 25
this.timezone = data.timezone || 'America/New_York';
```

**Change 2:** create() method (line ~35)
```javascript
// Add timezone to destructuring
const { email, password, first_name, last_name, role = 'user', is_first_login = false, timezone = 'America/New_York' } = userData;

// Add timezone to INSERT
INSERT INTO users (
  organization_id, email, password_hash, first_name, last_name,
  role, created_by, email_verified, is_first_login, timezone
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)

// Add timezone to params array at end
timezone
```

**Change 3:** update() method - add 'timezone' to allowedFields array
```javascript
const allowedFields = [
  'name', 'email', 'role', 'status', 'first_name', 'last_name',
  'is_first_login', 'failed_login_attempts', 'password', 'deleted_at',
  'timezone'  // ADD THIS
];
```

**Change 4:** toJSON() method - add timezone to return object
```javascript
return {
  // ... existing fields ...
  timezone: this.timezone,
  created_at: this.created_at,
  updated_at: this.updated_at
};
```

**Change 5:** verifyToken() query - add timezone to SELECT
```javascript
const sessionResult = await query(`
  SELECT
    u.id, u.organization_id, u.email, u.first_name, u.last_name,
    u.role, u.permissions, u.last_login, u.email_verified,
    u.is_active, u.timezone, u.created_at, u.updated_at, u.created_by
  FROM user_sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = true
`, [tokenHash], decoded.organizationId);
```

**Change 6:** generateToken() - add timezone to JWT payload
```javascript
const payload = {
  userId: this.id,
  organizationId: this.organization_id,
  email: this.email,
  role: this.role,
  timezone: this.timezone  // ADD THIS
};
```

### Step 3: Create Backend Utilities (10 min)

1. Create `utils/timezone.js` - Copy from spec section 2.3
2. Create `utils/timezones.json` - Copy from spec section 2.4

### Step 4: Create Timezone API Routes (10 min)

Create `routes/timezone.js` - Copy from spec section 2.5

### Step 5: Register Routes (2 min)

In `server.js`, add:
```javascript
const timezoneRoutes = require('./routes/timezone');
app.use('/api/timezones', timezoneRoutes);
```

### Step 6: Test Backend (5 min)

```bash
# Start server
npm run dev

# In another terminal:
# Test 1: Get all timezones
curl http://localhost:3004/api/timezones

# Test 2: Login and get token
curl -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# Copy the token from response

# Test 3: Get user timezone
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  http://localhost:3004/api/timezones/user

# Test 4: Update timezone
curl -X PUT http://localhost:3004/api/timezones/user \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"timezone":"America/Los_Angeles"}'
```

### Step 7: Frontend - Install Dependency (5 min)

```bash
cd frontend
npm install --save date-fns-tz@2.0.0
```

### Step 8: Frontend - Create Utilities (10 min)

Create `frontend/src/utils/timezoneUtils.js` - Copy from spec section 3.2

### Step 9: Frontend - Update AuthContext (15 min)

Open `frontend/src/contexts/AuthContext.jsx`:

**Change 1:** Add timezone to initialState (line ~7)
```javascript
const initialState = {
  user: null,
  organization: null,
  timezone: 'America/New_York', // ADD THIS
  isLoading: true,
  isAuthenticated: false,
}
```

**Change 2:** Add timezone to AUTH_SUCCESS case
```javascript
case 'AUTH_SUCCESS':
  return {
    ...state,
    user: action.payload.user,
    organization: action.payload.organization,
    timezone: action.payload.user?.timezone || 'America/New_York', // ADD THIS
    isLoading: false,
    isAuthenticated: true,
  }
```

**Change 3:** Add SET_TIMEZONE case in authReducer
```javascript
case 'SET_TIMEZONE': // ADD THIS NEW CASE
  return {
    ...state,
    timezone: action.payload,
  }
```

**Change 4:** Update login() method
```javascript
// Store timezone from login response
const userTimezone = data.user?.timezone || 'America/New_York'
localStorage.setItem('userTimezone', userTimezone)
```

**Change 5:** Update register() method (same as login)

**Change 6:** Update logout() method
```javascript
finally {
  clearAuth()
  localStorage.removeItem('userTimezone') // ADD THIS
  dispatch({ type: 'LOGOUT' })
  toast.success('Logged out successfully')
}
```

**Change 7:** Add setTimezone method before return statement
```javascript
const setTimezone = (timezone) => {
  localStorage.setItem('userTimezone', timezone)
  dispatch({ type: 'SET_TIMEZONE', payload: timezone })
}

const value = {
  ...state,
  login,
  register,
  logout,
  updateUser,
  setTimezone, // ADD THIS
}
```

### Step 10: Frontend - Update API Service (10 min)

Open `frontend/src/services/api.js`:

**Change 1:** Add timezone management (after line ~23)
```javascript
// Timezone management
let userTimezone = localStorage.getItem('userTimezone') || 'America/New_York'

export const setUserTimezone = (timezone) => {
  userTimezone = timezone
  localStorage.setItem('userTimezone', timezone)
  api.defaults.headers.common['X-User-Timezone'] = timezone
}

export const getUserTimezone = () => {
  return userTimezone
}

// Set initial timezone header
if (userTimezone) {
  api.defaults.headers.common['X-User-Timezone'] = userTimezone
}
```

**Change 2:** Update request interceptor
```javascript
api.interceptors.request.use(
  (config) => {
    // Add timezone header to all requests
    const tz = localStorage.getItem('userTimezone') || 'America/New_York'
    config.headers['X-User-Timezone'] = tz

    console.log('🚀 API Request:', config.method?.toUpperCase(), config.url)
    console.log('  - Timezone:', tz)
    return config
  },
  (error) => {
    console.error('❌ Request interceptor error:', error)
    return Promise.reject(error)
  }
)
```

**Change 3:** Add timezoneAPI object (before last export)
```javascript
export const timezoneAPI = {
  getTimezones: async () => {
    const response = await api.get('/timezones')
    return response.data.data
  },

  getUserTimezone: async () => {
    const response = await api.get('/timezones/user')
    return response.data
  },

  updateTimezone: async (timezone) => {
    const response = await api.put('/timezones/user', { timezone })
    return response.data
  }
}
```

### Step 11: Create TimezoneSelector Component (5 min)

Create `frontend/src/components/TimezoneSelector.jsx` - Copy from spec section 3.5

### Step 12: Test Frontend (15 min)

1. Start frontend dev server: `npm run dev` (in frontend directory)
2. Log in to the application
3. Open browser console, check for timezone in localStorage
4. Open network tab, verify X-User-Timezone header in requests
5. Test timestamp display in any component showing dates

### Step 13: Run Tests (10 min)

```bash
# Backend timezone tests
npm test timezone

# Frontend timezone tests (if using Jest)
cd frontend
npm test -- timezoneUtils
```

---

## Troubleshooting Quick Fixes

### Issue: "Timezone column not found"
```bash
# Check if migration ran
psql -d uppal_crm -c "\d users"

# Manually add if missing
psql -d uppal_crm -c "ALTER TABLE users ADD COLUMN timezone VARCHAR(50) DEFAULT 'America/New_York';"
```

### Issue: "date-fns-tz not found"
```bash
# Reinstall
cd frontend
rm -rf node_modules/date-fns-tz
npm install --save date-fns-tz@2.0.0
```

### Issue: "API returns 401 on timezone endpoint"
```bash
# Make sure token is valid
# Copy token from localStorage in browser console
# Test with curl

# Check auth middleware is working
curl -H "Authorization: Bearer INVALID" \
  http://localhost:3004/api/timezones/user
# Should return 401
```

### Issue: "Wrong time displayed"
```javascript
// Check timezone is being passed correctly
console.log('User timezone:', useAuth().timezone)

// Check formatInTimeZone is being used
import { formatInTimeZone } from 'date-fns-tz'
```

---

## Verification Checklist

After completing all steps, verify:

```
BACKEND
[ ] node scripts/run-timezone-migration.js up completes successfully
[ ] psql shows timezone column in users table
[ ] curl http://localhost:3004/api/timezones returns list
[ ] curl with auth token gets user timezone
[ ] curl with PUT updates timezone
[ ] User model includes timezone in toJSON output
[ ] JWT token includes timezone field

FRONTEND
[ ] npm install date-fns-tz completes successfully
[ ] timezoneUtils.js imports without errors
[ ] AuthContext includes timezone state
[ ] Login stores timezone in localStorage
[ ] API requests include X-User-Timezone header
[ ] TimezoneSelector component loads
[ ] Can change timezone in settings

INTEGRATION
[ ] User logs in, timezone loads from backend
[ ] Change timezone, localStorage updates
[ ] Reload page, timezone persists
[ ] Timestamps display in user's timezone
[ ] Logout clears timezone from localStorage
```

---

## Performance Tips

1. **Cache timezone list** - Load once on app startup
2. **Lazy load TimezoneSelector** - Only load when user accesses settings
3. **Batch timezone updates** - Update user timezone with other profile updates
4. **Use memoization** - Memoize format functions to prevent re-renders

---

## Next Steps

After completing Phase 1A:

1. Create settings page component with TimezoneSelector
2. Add timezone display to user profile
3. Update all timestamp displays in main tables (Dashboard, Contacts, Leads)
4. Create unit/integration tests
5. Test across browsers
6. Deploy to staging environment
7. Get approval for production deployment

---

**Document created:** January 27, 2026
**Ready to implement:** Yes
**Estimated duration:** 4-6 hours
