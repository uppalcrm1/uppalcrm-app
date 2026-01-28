# Phase 1A: Timezone Support Implementation Specification

**Document Version:** 1.0
**Date:** January 2026
**Status:** Implementation Ready
**Scope:** Complete timezone support for user sessions, data display, and reporting

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Database Changes](#database-changes)
3. [Backend Changes](#backend-changes)
4. [Frontend Changes](#frontend-changes)
5. [Configuration & Dependencies](#configuration--dependencies)
6. [Implementation Order](#implementation-order)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Plan](#rollback-plan)

---

## Executive Summary

This specification provides a complete, step-by-step implementation plan for adding timezone support to the Uppal CRM system. The implementation will:

- Store user timezone preferences in the database
- Handle timezone conversions for timestamp display
- Maintain timezone context across API calls
- Support dynamic timezone switching
- Preserve backward compatibility with existing data

**Key Dependencies:**
- date-fns-tz (new library - version 2.0+)
- Existing date-fns library (already installed v2.30.0)
- PostgreSQL with timezone support (already enabled)

**Estimated Implementation Time:** 4-6 hours
**Risk Level:** Low (isolated changes, non-breaking)

---

## Database Changes

### 1.1 Migration Strategy

#### Step 1: Create Migration File

Create a new migration file:

**File:** `C:\Users\uppal\uppal-crm-project\database\migrations\001-add-timezone-to-users.js`

```javascript
/**
 * Migration: Add timezone support to users table
 * - Adds timezone column to store user preferences
 * - Adds timezone to organization_settings
 * - Provides rollback capability
 */

const { query, transaction } = require('../connection');

async function up() {
  try {
    console.log('⏱️  Starting timezone migration (up)...');

    // Add timezone column to users table
    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/New_York';
    `);
    console.log('✓ Added timezone column to users table');

    // Add timezone to organization_settings if it exists
    const checkSettingsTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'organization_settings'
      );
    `);

    if (checkSettingsTable.rows[0].exists) {
      await query(`
        ALTER TABLE organization_settings
        ADD COLUMN IF NOT EXISTS default_timezone VARCHAR(50) DEFAULT 'America/New_York';
      `);
      console.log('✓ Added default_timezone to organization_settings');
    }

    // Create index for timezone searches (optional optimization)
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_timezone
      ON users(timezone);
    `);
    console.log('✓ Created index on timezone column');

    console.log('✅ Timezone migration (up) completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Timezone migration (up) failed:', error.message);
    throw error;
  }
}

async function down() {
  try {
    console.log('⏱️  Starting timezone migration (down - rollback)...');

    // Remove index
    await query(`DROP INDEX IF EXISTS idx_users_timezone;`);
    console.log('✓ Dropped timezone index');

    // Remove timezone from users table
    await query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS timezone;
    `);
    console.log('✓ Removed timezone column from users table');

    // Remove from organization_settings if exists
    const checkSettingsTable = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'organization_settings'
      );
    `);

    if (checkSettingsTable.rows[0].exists) {
      await query(`
        ALTER TABLE organization_settings
        DROP COLUMN IF EXISTS default_timezone;
      `);
      console.log('✓ Removed default_timezone from organization_settings');
    }

    console.log('✅ Timezone migration (down) completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Timezone migration (down) failed:', error.message);
    throw error;
  }
}

module.exports = { up, down };
```

#### Step 2: Run Migration

Create a runner script:

**File:** `C:\Users\uppal\uppal-crm-project\scripts\run-timezone-migration.js`

```javascript
/**
 * Runner script for timezone migration
 * Usage: node scripts/run-timezone-migration.js [up|down]
 */

const path = require('path');
const migration = require('../database/migrations/001-add-timezone-to-users');

async function runMigration(direction = 'up') {
  try {
    console.log(`\n🚀 Running timezone migration: ${direction.toUpperCase()}\n`);

    const result = direction === 'down' ? await migration.down() : await migration.up();

    if (result) {
      console.log('\n✅ Migration completed successfully\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message, '\n');
    process.exit(1);
  }
}

const direction = process.argv[2] || 'up';
if (!['up', 'down'].includes(direction)) {
  console.error('Invalid direction. Use: up or down');
  process.exit(1);
}

runMigration(direction);
```

### 1.2 Data Verification SQL

**File:** `C:\Users\uppal\uppal-crm-project\database\verify-timezone-migration.sql`

```sql
-- Verify timezone migration was successful

-- Check timezone column exists and has default value
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'timezone';

-- Count users by timezone
SELECT
  timezone,
  COUNT(*) as user_count
FROM users
GROUP BY timezone
ORDER BY user_count DESC;

-- Check organization_settings has default_timezone
SELECT
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_name = 'organization_settings' AND column_name = 'default_timezone';

-- Verify index exists
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'users' AND indexname = 'idx_users_timezone';
```

---

## Backend Changes

### 2.1 Update User Model

**File:** `C:\Users\uppal\uppal-crm-project\models\User.js`

Add timezone field to the User class (update existing file):

```javascript
class User {
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
    // ADD THIS NEW FIELD
    this.timezone = data.timezone || 'America/New_York';
  }

  // In the create method, add timezone to INSERT statement:
  static async create(userData, organizationId, createdBy = null) {
    const {
      email, password, first_name, last_name, role = 'user',
      is_first_login = false,
      timezone = 'America/New_York'  // ADD THIS
    } = userData;

    // ... existing validation code ...

    const result = await query(`
      INSERT INTO users (
        organization_id, email, password_hash, first_name, last_name,
        role, created_by, email_verified, is_first_login, timezone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      organizationId,
      email.toLowerCase(),
      passwordHash,
      first_name,
      last_name,
      role,
      createdBy,
      false,
      is_first_login,
      timezone  // ADD THIS
    ], organizationId);

    return new User(result.rows[0]);
  }

  // Update the update method to allow timezone changes:
  static async update(id, updates, organizationId) {
    const allowedFields = [
      'name', 'email', 'role', 'status', 'first_name', 'last_name',
      'is_first_login', 'failed_login_attempts', 'password', 'deleted_at',
      'timezone'  // ADD THIS
    ];

    // ... rest of existing code ...
  }

  // Update toJSON method to include timezone:
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
      timezone: this.timezone,  // ADD THIS
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}
```

### 2.2 Update Authentication Middleware

**File:** `C:\Users\uppal\uppal-crm-project\middleware\auth.js`

Add timezone to token verification (update verifyToken and authenticateToken):

```javascript
// In User.verifyToken method (User.js), update the query to include timezone:
static async verifyToken(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    console.log('[verifyToken] Decoded token:', {
      userId: decoded.userId,
      organizationId: decoded.organizationId,
      email: decoded.email
    });

    // ADD timezone TO SELECT
    const sessionResult = await query(`
      SELECT
        u.id, u.organization_id, u.email, u.first_name, u.last_name,
        u.role, u.permissions, u.last_login, u.email_verified,
        u.is_active, u.timezone, u.created_at, u.updated_at, u.created_by
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = true
    `, [tokenHash], decoded.organizationId);

    // ... rest of existing code ...
  } catch (error) {
    return null;
  }
}

// Update generateToken to include timezone in JWT payload:
async generateToken(ipAddress = null, userAgent = null) {
  const payload = {
    userId: this.id,
    organizationId: this.organization_id,
    email: this.email,
    role: this.role,
    timezone: this.timezone  // ADD THIS
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: '24h',
    issuer: 'uppal-crm'
  });

  // ... rest of existing code ...
}
```

### 2.3 Create Timezone Utility

**File:** `C:\Users\uppal\uppal-crm-project\utils\timezone.js`

```javascript
/**
 * Timezone utility functions for backend
 * Handles timezone conversions and validations
 */

const TIMEZONE_LIST = require('./timezones.json');

/**
 * Validate if a timezone string is valid
 * @param {string} timezone - Timezone string (e.g., 'America/New_York')
 * @returns {boolean} True if valid timezone
 */
function isValidTimezone(timezone) {
  return TIMEZONE_LIST.some(tz => tz.value === timezone);
}

/**
 * Get all available timezones
 * @returns {Array} Array of timezone objects {value, label, offset}
 */
function getTimezoneList() {
  return TIMEZONE_LIST;
}

/**
 * Get timezone by value
 * @param {string} timezone - Timezone value
 * @returns {Object|null} Timezone object or null if not found
 */
function getTimezone(timezone) {
  return TIMEZONE_LIST.find(tz => tz.value === timezone) || null;
}

/**
 * Get user timezone with fallback
 * @param {Object} user - User object
 * @param {string} defaultTz - Default timezone fallback
 * @returns {string} Valid timezone string
 */
function getUserTimezone(user, defaultTz = 'America/New_York') {
  if (!user || !user.timezone) {
    return defaultTz;
  }

  return isValidTimezone(user.timezone) ? user.timezone : defaultTz;
}

module.exports = {
  isValidTimezone,
  getTimezoneList,
  getTimezone,
  getUserTimezone
};
```

### 2.4 Create Timezone List File

**File:** `C:\Users\uppal\uppal-crm-project\utils\timezones.json`

```json
[
  {"value": "America/Anchorage", "label": "Alaska", "offset": "-9:00"},
  {"value": "America/Chicago", "label": "Central Time (US & Canada)", "offset": "-6:00"},
  {"value": "America/Denver", "label": "Mountain Time (US & Canada)", "offset": "-7:00"},
  {"value": "America/Los_Angeles", "label": "Pacific Time (US & Canada)", "offset": "-8:00"},
  {"value": "America/New_York", "label": "Eastern Time (US & Canada)", "offset": "-5:00"},
  {"value": "America/Toronto", "label": "Eastern Time (Canada)", "offset": "-5:00"},
  {"value": "America/Vancouver", "label": "Pacific Time (Canada)", "offset": "-8:00"},
  {"value": "America/Mexico_City", "label": "Mexico City", "offset": "-6:00"},
  {"value": "America/Argentina/Buenos_Aires", "label": "Buenos Aires", "offset": "-3:00"},
  {"value": "America/Sao_Paulo", "label": "Brasília", "offset": "-3:00"},
  {"value": "Atlantic/Azores", "label": "Azores", "offset": "-1:00"},
  {"value": "Europe/London", "label": "London", "offset": "+0:00"},
  {"value": "Europe/Paris", "label": "Paris", "offset": "+1:00"},
  {"value": "Europe/Berlin", "label": "Berlin", "offset": "+1:00"},
  {"value": "Europe/Madrid", "label": "Madrid", "offset": "+1:00"},
  {"value": "Europe/Amsterdam", "label": "Amsterdam", "offset": "+1:00"},
  {"value": "Europe/Brussels", "label": "Brussels", "offset": "+1:00"},
  {"value": "Europe/Vienna", "label": "Vienna", "offset": "+1:00"},
  {"value": "Europe/Prague", "label": "Prague", "offset": "+1:00"},
  {"value": "Europe/Budapest", "label": "Budapest", "offset": "+1:00"},
  {"value": "Europe/Warsaw", "label": "Warsaw", "offset": "+1:00"},
  {"value": "Europe/Istanbul", "label": "Istanbul", "offset": "+3:00"},
  {"value": "Europe/Moscow", "label": "Moscow", "offset": "+3:00"},
  {"value": "Asia/Dubai", "label": "Dubai", "offset": "+4:00"},
  {"value": "Asia/Kolkata", "label": "India Standard Time", "offset": "+5:30"},
  {"value": "Asia/Bangkok", "label": "Bangkok", "offset": "+7:00"},
  {"value": "Asia/Hong_Kong", "label": "Hong Kong", "offset": "+8:00"},
  {"value": "Asia/Shanghai", "label": "Shanghai", "offset": "+8:00"},
  {"value": "Asia/Singapore", "label": "Singapore", "offset": "+8:00"},
  {"value": "Asia/Tokyo", "label": "Tokyo", "offset": "+9:00"},
  {"value": "Asia/Seoul", "label": "Seoul", "offset": "+9:00"},
  {"value": "Australia/Sydney", "label": "Sydney", "offset": "+11:00"},
  {"value": "Australia/Melbourne", "label": "Melbourne", "offset": "+11:00"},
  {"value": "Australia/Brisbane", "label": "Brisbane", "offset": "+10:00"},
  {"value": "Australia/Perth", "label": "Perth", "offset": "+8:00"},
  {"value": "Pacific/Auckland", "label": "Auckland", "offset": "+13:00"},
  {"value": "Pacific/Fiji", "label": "Fiji", "offset": "+13:00"}
]
```

### 2.5 Create Timezone API Endpoints

**File:** `C:\Users\uppal\uppal-crm-project\routes\timezone.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const User = require('../models/User');
const { getTimezoneList, isValidTimezone, getUserTimezone } = require('../utils/timezone');

/**
 * Get all available timezones
 * GET /api/timezones
 */
router.get('/', (req, res) => {
  try {
    const timezones = getTimezoneList();
    res.json({
      success: true,
      data: timezones,
      count: timezones.length
    });
  } catch (error) {
    console.error('Error fetching timezones:', error);
    res.status(500).json({
      error: 'Failed to fetch timezones',
      message: error.message
    });
  }
});

/**
 * Get current user's timezone
 * GET /api/timezones/user
 */
router.get('/user', authenticateToken, (req, res) => {
  try {
    const timezone = getUserTimezone(req.user);
    res.json({
      success: true,
      timezone: timezone,
      user: {
        id: req.user.id,
        email: req.user.email,
        timezone: timezone
      }
    });
  } catch (error) {
    console.error('Error fetching user timezone:', error);
    res.status(500).json({
      error: 'Failed to fetch user timezone',
      message: error.message
    });
  }
});

/**
 * Update user's timezone
 * PUT /api/timezones/user
 */
router.put('/user', authenticateToken, async (req, res) => {
  try {
    const { timezone } = req.body;

    // Validate timezone
    if (!timezone) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Timezone is required'
      });
    }

    if (!isValidTimezone(timezone)) {
      return res.status(400).json({
        error: 'Validation error',
        message: `Invalid timezone: ${timezone}`
      });
    }

    // Update user timezone
    const updatedUser = await User.update(
      req.user.id,
      { timezone },
      req.user.organization_id
    );

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Timezone updated successfully',
      user: updatedUser.toJSON()
    });
  } catch (error) {
    console.error('Error updating user timezone:', error);
    res.status(500).json({
      error: 'Failed to update timezone',
      message: error.message
    });
  }
});

module.exports = router;
```

### 2.6 Register Timezone Routes

In your main server file (likely `C:\Users\uppal\uppal-crm-project\server.js`), add:

```javascript
// Add near other route registrations
const timezoneRoutes = require('./routes/timezone');
app.use('/api/timezones', timezoneRoutes);
```

---

## Frontend Changes

### 3.1 Install date-fns-tz Library

**Command to run:**
```bash
npm install --save date-fns-tz@2.0.0
```

Update `C:\Users\uppal\uppal-crm-project\frontend\package.json`:

```json
{
  "dependencies": {
    "date-fns": "^2.30.0",
    "date-fns-tz": "^2.0.0"
  }
}
```

### 3.2 Create Timezone Utility Hook

**File:** `C:\Users\uppal\uppal-crm-project\frontend\src\utils\timezoneUtils.js`

```javascript
import { format, parseISO } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Timezone utilities for frontend
 * Handles timezone conversions and formatting with timezone support
 */

/**
 * Format a date/timestamp with timezone awareness
 * Converts server UTC time to user's local timezone
 *
 * @param {string|Date} dateValue - The date to format (ISO string or Date object)
 * @param {string} userTimezone - User's timezone (e.g., 'America/New_York')
 * @param {string} formatStr - Format string for date-fns (default: 'MMM d, yyyy HH:mm')
 * @returns {string} Formatted date in user's timezone
 */
export function formatDateWithTimezone(dateValue, userTimezone, formatStr = 'MMM d, yyyy HH:mm') {
  if (!dateValue || !userTimezone) {
    return '—';
  }

  try {
    // Parse the date
    let dateObj;
    if (typeof dateValue === 'string') {
      dateObj = parseISO(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return '—';
    }

    // Convert to user's timezone and format
    const zonedDate = toZonedTime(dateObj, userTimezone);
    return format(zonedDate, formatStr);
  } catch (error) {
    console.warn('Error formatting date with timezone:', error);
    return '—';
  }
}

/**
 * Format time only with timezone
 * @param {string|Date} dateValue - The date to format
 * @param {string} userTimezone - User's timezone
 * @param {string} formatStr - Format string (default: 'HH:mm:ss zzz')
 * @returns {string} Formatted time
 */
export function formatTimeWithTimezone(dateValue, userTimezone, formatStr = 'HH:mm:ss zzz') {
  if (!dateValue || !userTimezone) {
    return '—';
  }

  try {
    let dateObj;
    if (typeof dateValue === 'string') {
      dateObj = parseISO(dateValue);
    } else if (dateValue instanceof Date) {
      dateObj = dateValue;
    } else {
      return '—';
    }

    return formatInTimeZone(dateObj, userTimezone, formatStr);
  } catch (error) {
    console.warn('Error formatting time with timezone:', error);
    return '—';
  }
}

/**
 * Format a timestamp in user's timezone with short format
 * @param {string|Date} dateValue
 * @param {string} userTimezone
 * @returns {string}
 */
export function formatDateTimeShort(dateValue, userTimezone) {
  return formatDateWithTimezone(dateValue, userTimezone, 'MMM d, yyyy HH:mm');
}

/**
 * Format date only (no time)
 * @param {string|Date} dateValue
 * @param {string} userTimezone
 * @returns {string}
 */
export function formatDateOnlyWithTimezone(dateValue, userTimezone) {
  return formatDateWithTimezone(dateValue, userTimezone, 'MMM d, yyyy');
}

/**
 * Convert server UTC time to user's timezone string
 * @param {string|Date} dateValue
 * @param {string} userTimezone
 * @returns {string} e.g., "2025-01-27 14:30:00 EST"
 */
export function formatFullDateTimeWithTimezone(dateValue, userTimezone) {
  return formatDateWithTimezone(dateValue, userTimezone, 'yyyy-MM-dd HH:mm:ss zzz');
}

/**
 * Get current time in user's timezone
 * @param {string} userTimezone
 * @param {string} formatStr
 * @returns {string}
 */
export function getCurrentTimeInTimezone(userTimezone, formatStr = 'HH:mm:ss') {
  return formatInTimeZone(new Date(), userTimezone, formatStr);
}

/**
 * Validate timezone string
 * @param {string} timezone
 * @returns {boolean}
 */
export function isValidTimezone(timezone) {
  // This will throw if timezone is invalid
  try {
    formatInTimeZone(new Date(), timezone, 'HH:mm');
    return true;
  } catch {
    return false;
  }
}
```

### 3.3 Update AuthContext

**File:** `C:\Users\uppal\uppal-crm-project\frontend\src\contexts\AuthContext.jsx`

```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authAPI, setAuthToken, setOrganizationSlug, clearAuth } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext()

const initialState = {
  user: null,
  organization: null,
  timezone: 'America/New_York', // ADD THIS
  isLoading: true,
  isAuthenticated: false,
}

const authReducer = (state, action) => {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true }
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        organization: action.payload.organization,
        timezone: action.payload.user?.timezone || 'America/New_York', // ADD THIS
        isLoading: false,
        isAuthenticated: true,
      }
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        organization: null,
        timezone: 'America/New_York', // ADD THIS
        isLoading: false,
        isAuthenticated: false,
      }
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
      }
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload },
        timezone: action.payload.timezone || state.timezone, // ADD THIS
      }
    case 'SET_TIMEZONE': // ADD THIS NEW CASE
      return {
        ...state,
        timezone: action.payload,
      }
    default:
      return state
  }
}

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Initialize auth on app start
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('authToken')
      const storedTimezone = localStorage.getItem('userTimezone') // ADD THIS

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
        localStorage.setItem('userTimezone', userTimezone) // ADD THIS

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

  const login = async (email, password) => {
    dispatch({ type: 'AUTH_START' })

    try {
      const data = await authAPI.login(email, password)

      setAuthToken(data.token)
      setOrganizationSlug(data.organization.slug)

      // Store timezone from login response
      const userTimezone = data.user?.timezone || 'America/New_York'
      localStorage.setItem('userTimezone', userTimezone) // ADD THIS

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

  const register = async (organizationData, adminData) => {
    dispatch({ type: 'AUTH_START' })

    try {
      const data = await authAPI.register(organizationData, adminData)

      setAuthToken(data.token)
      setOrganizationSlug(data.organization.slug)

      // Store timezone from register response
      const userTimezone = data.user?.timezone || 'America/New_York'
      localStorage.setItem('userTimezone', userTimezone) // ADD THIS

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: data.user,
          organization: data.organization,
        },
      })

      toast.success('Organization created successfully!')
      return { success: true, data }
    } catch (error) {
      dispatch({ type: 'AUTH_ERROR' })
      const message = error.response?.data?.message || 'Registration failed'
      toast.error(message)
      return { success: false, error: message }
    }
  }

  const logout = async () => {
    try {
      await authAPI.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      clearAuth()
      localStorage.removeItem('userTimezone') // ADD THIS
      dispatch({ type: 'LOGOUT' })
      toast.success('Logged out successfully')
    }
  }

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData })
  }

  // ADD THIS NEW METHOD
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
```

### 3.4 Update API Service

**File:** `C:\Users\uppal\uppal-crm-project\frontend\src\services\api.js`

Add timezone header to API calls:

```javascript
// Around line 30-50, add timezone header setup:

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

// Set initial timezone header if available
if (userTimezone) {
  api.defaults.headers.common['X-User-Timezone'] = userTimezone
}

// Update request interceptor to include timezone
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

// Add timezone endpoints
export const timezoneAPI = {
  /**
   * Get all available timezones
   */
  getTimezones: async () => {
    const response = await api.get('/timezones')
    return response.data.data
  },

  /**
   * Get current user's timezone
   */
  getUserTimezone: async () => {
    const response = await api.get('/timezones/user')
    return response.data
  },

  /**
   * Update user's timezone
   */
  updateTimezone: async (timezone) => {
    const response = await api.put('/timezones/user', { timezone })
    return response.data
  }
}
```

### 3.5 Create Timezone Settings Component

**File:** `C:\Users\uppal\uppal-crm-project\frontend\src\components\TimezoneSelector.jsx`

```javascript
import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { timezoneAPI } from '../services/api'
import toast from 'react-hot-toast'

export const TimezoneSelector = () => {
  const { timezone, setTimezone } = useAuth()
  const [timezones, setTimezones] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTimezone, setSelectedTimezone] = useState(timezone)

  // Fetch available timezones on mount
  useEffect(() => {
    const fetchTimezones = async () => {
      try {
        const data = await timezoneAPI.getTimezones()
        setTimezones(data)
      } catch (error) {
        console.error('Failed to fetch timezones:', error)
        toast.error('Failed to load timezones')
      }
    }

    fetchTimezones()
  }, [])

  const handleTimezoneChange = async (e) => {
    const newTimezone = e.target.value
    setSelectedTimezone(newTimezone)
    setLoading(true)

    try {
      const result = await timezoneAPI.updateTimezone(newTimezone)
      setTimezone(newTimezone)
      toast.success('Timezone updated successfully')
    } catch (error) {
      console.error('Failed to update timezone:', error)
      toast.error('Failed to update timezone')
      setSelectedTimezone(timezone) // Reset to previous value
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="timezone-selector">
      <label htmlFor="timezone-select" className="block text-sm font-medium mb-2">
        Timezone
      </label>
      <select
        id="timezone-select"
        value={selectedTimezone}
        onChange={handleTimezoneChange}
        disabled={loading}
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
      >
        {timezones.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label} (UTC {tz.offset})
          </option>
        ))}
      </select>
    </div>
  )
}

export default TimezoneSelector
```

### 3.6 Components Requiring Timezone Updates

Create a comprehensive list of components that display timestamps:

**File:** `C:\Users\uppal\uppal-crm-project\TIMEZONE_COMPONENT_UPDATES.md`

```markdown
# Components Requiring Timezone Parameter Updates

These components display timestamps and should be updated to use timezone-aware formatting:

## Pages
- `/src/pages/Dashboard.jsx` - Display creation times, last updated times
- `/src/pages/Contacts.jsx` - Contact created_at, updated_at fields
- `/src/pages/Leads.jsx` - Lead created_at, updated_at, follow_up_date
- `/src/pages/Deals.jsx` - Deal created_at, updated_at, close_date
- `/src/pages/Tasks.jsx` - Task created_at, due_date, completion_date
- `/src/pages/Reports.jsx` - Report generated dates, data time ranges
- `/src/pages/ActivityLog.jsx` - Activity timestamps
- `/src/pages/Transactions.jsx` - Transaction dates, payment dates
- `/src/pages/Settings/ProfileSettings.jsx` - User preferences, timezone selector

## Components (Reusable)
- `/src/components/tables/ContactsTable.jsx` - timestamps in table rows
- `/src/components/tables/LeadsTable.jsx` - timestamps in table rows
- `/src/components/tables/DealsTable.jsx` - timestamps in table rows
- `/src/components/tables/TasksTable.jsx` - timestamps in table rows
- `/src/components/tables/TransactionsTable.jsx` - transaction dates
- `/src/components/cards/ActivityCard.jsx` - activity timestamps
- `/src/components/cards/LeadCard.jsx` - creation and update dates
- `/src/components/forms/DatePickerField.jsx` - may need timezone context
- `/src/components/modals/EditContactModal.jsx` - display last modified time
- `/src/components/modals/EditLeadModal.jsx` - display last modified time
- `/src/components/charts/*.jsx` - X-axis date labels need timezone

## Usage Pattern

Replace:
```javascript
import { formatDate } from '../utils/dateFormatter'

<span>{formatDate(timestamp)}</span>
```

With:
```javascript
import { formatDateWithTimezone } from '../utils/timezoneUtils'
import { useAuth } from '../contexts/AuthContext'

const MyComponent = () => {
  const { timezone } = useAuth()

  return (
    <span>{formatDateWithTimezone(timestamp, timezone)}</span>
  )
}
```

## Priority Order
1. **High Priority (User-facing):**
   - ContactsTable, LeadsTable - Most viewed
   - Dashboard - First page users see
   - Reports - Critical for business logic

2. **Medium Priority:**
   - DealsTable, TasksTable, TransactionsTable
   - ActivityLog
   - Individual entity pages

3. **Low Priority:**
   - Internal timestamps
   - Audit/system timestamps
```

---

## Configuration & Dependencies

### 4.1 Frontend Dependencies

Install the timezone library:

```bash
cd frontend
npm install --save date-fns-tz@2.0.0
```

Verify in `frontend/package.json`:

```json
{
  "dependencies": {
    "date-fns": "^2.30.0",
    "date-fns-tz": "^2.0.0",
    "react": "^18.2.0"
  }
}
```

### 4.2 Backend Configuration

Update `C:\Users\uppal\uppal-crm-project\.env`:

```bash
# Timezone Configuration
DEFAULT_TIMEZONE=America/New_York
# Supported timezones list URL (optional)
TIMEZONES_JSON_PATH=/utils/timezones.json
```

### 4.3 Environment Variables

Ensure these are in your .env files:

```bash
# For database
DATABASE_URL=...
DB_HOST=localhost
DB_PORT=5432

# For timezone
DEFAULT_TIMEZONE=America/New_York

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h
```

---

## Implementation Order

### Phase 1: Database & Backend Setup (30 minutes)

1. **Create migration file**
   - Create `database/migrations/001-add-timezone-to-users.js`

2. **Run migration**
   ```bash
   node scripts/run-timezone-migration.js up
   ```

3. **Verify migration**
   ```bash
   psql -d uppal_crm -f database/verify-timezone-migration.sql
   ```

4. **Update User model**
   - Add `timezone` field to User class
   - Update constructor
   - Update `create()` method
   - Update `update()` method
   - Update `toJSON()` method
   - Update `verifyToken()` to include timezone

5. **Update auth middleware**
   - Update `generateToken()` to include timezone in JWT payload
   - Update token verification to include timezone in queries

### Phase 2: Backend API Setup (30 minutes)

6. **Create timezone utilities**
   - Create `utils/timezone.js`
   - Create `utils/timezones.json`

7. **Create timezone routes**
   - Create `routes/timezone.js`
   - Register routes in `server.js`

8. **Test API endpoints**
   ```bash
   # Get all timezones
   curl http://localhost:3004/api/timezones

   # Get user timezone (requires auth)
   curl -H "Authorization: Bearer {token}" http://localhost:3004/api/timezones/user

   # Update timezone
   curl -X PUT http://localhost:3004/api/timezones/user \
     -H "Authorization: Bearer {token}" \
     -H "Content-Type: application/json" \
     -d '{"timezone":"America/Los_Angeles"}'
   ```

### Phase 3: Frontend Setup (20 minutes)

9. **Install dependencies**
   ```bash
   cd frontend
   npm install --save date-fns-tz@2.0.0
   ```

10. **Create timezone utilities**
    - Create `frontend/src/utils/timezoneUtils.js`

11. **Update AuthContext**
    - Add timezone state management
    - Update login/register to store timezone
    - Add setTimezone method

12. **Update API service**
    - Add timezone header to all requests
    - Add timezoneAPI endpoints

### Phase 4: Component Updates (2-3 hours)

13. **High-priority components**
    - Dashboard: Add timezone context to timestamp displays
    - ContactsTable: Update all timestamp columns
    - LeadsTable: Update all timestamp columns
    - Reports: Update date displays

14. **Medium-priority components**
    - DealsTable, TasksTable, TransactionsTable
    - ActivityLog
    - Individual entity pages

15. **Create Settings component**
    - Create `TimezoneSelector.jsx`
    - Add to user settings page

### Phase 5: Testing (1 hour)

16. **Unit tests** - See Testing Strategy section
17. **Integration tests** - See Testing Strategy section
18. **Manual QA** - See Testing Strategy section

---

## Testing Strategy

### 5.1 Unit Tests

**File:** `C:\Users\uppal\uppal-crm-project\test\timezone.unit.test.js`

```javascript
const timezoneUtils = require('../utils/timezone');
const { isValidTimezone, getTimezoneList, getUserTimezone } = timezoneUtils;

describe('Timezone Utilities', () => {
  describe('isValidTimezone', () => {
    test('should validate correct timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    });

    test('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('')).toBe(false);
      expect(isValidTimezone(null)).toBe(false);
    });
  });

  describe('getTimezoneList', () => {
    test('should return array of timezones', () => {
      const list = getTimezoneList();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    });

    test('each timezone should have value and label', () => {
      const list = getTimezoneList();
      list.forEach(tz => {
        expect(tz).toHaveProperty('value');
        expect(tz).toHaveProperty('label');
        expect(typeof tz.value).toBe('string');
        expect(typeof tz.label).toBe('string');
      });
    });
  });

  describe('getUserTimezone', () => {
    test('should return user timezone if valid', () => {
      const user = { timezone: 'America/Los_Angeles' };
      expect(getUserTimezone(user)).toBe('America/Los_Angeles');
    });

    test('should return default timezone if user has no timezone', () => {
      const user = {};
      expect(getUserTimezone(user)).toBe('America/New_York');
    });

    test('should return default timezone for null user', () => {
      expect(getUserTimezone(null)).toBe('America/New_York');
    });

    test('should accept custom default timezone', () => {
      const user = {};
      expect(getUserTimezone(user, 'Europe/London')).toBe('Europe/London');
    });
  });
});
```

### 5.2 Frontend Unit Tests

**File:** `C:\Users\uppal\uppal-crm-project\frontend\test\timezoneUtils.test.js`

```javascript
import { formatDateWithTimezone, formatDateOnlyWithTimezone, isValidTimezone } from '../src/utils/timezoneUtils';

describe('Timezone Utils - Frontend', () => {
  const testDate = '2025-01-27T14:30:00Z'; // 2:30 PM UTC

  describe('formatDateWithTimezone', () => {
    test('should format date in Eastern timezone', () => {
      const result = formatDateWithTimezone(testDate, 'America/New_York', 'MMM d, yyyy HH:mm');
      // UTC 14:30 = EST 09:30
      expect(result).toContain('09:30');
      expect(result).toContain('Jan 27');
    });

    test('should format date in Pacific timezone', () => {
      const result = formatDateWithTimezone(testDate, 'America/Los_Angeles', 'MMM d, yyyy HH:mm');
      // UTC 14:30 = PST 06:30
      expect(result).toContain('06:30');
      expect(result).toContain('Jan 27');
    });

    test('should format date in Tokyo timezone', () => {
      const result = formatDateWithTimezone(testDate, 'Asia/Tokyo', 'MMM d, yyyy HH:mm');
      // UTC 14:30 = JST 23:30 (same day)
      expect(result).toContain('23:30');
      expect(result).toContain('Jan 27');
    });

    test('should return fallback for invalid date', () => {
      const result = formatDateWithTimezone('invalid-date', 'America/New_York');
      expect(result).toBe('—');
    });

    test('should return fallback for missing timezone', () => {
      const result = formatDateWithTimezone(testDate, null);
      expect(result).toBe('—');
    });
  });

  describe('formatDateOnlyWithTimezone', () => {
    test('should format date without time', () => {
      const result = formatDateOnlyWithTimezone(testDate, 'America/New_York');
      expect(result).toMatch(/Jan 27, 2025/);
      expect(result).not.toMatch(/\d{2}:\d{2}/); // No time
    });
  });

  describe('isValidTimezone', () => {
    test('should validate correct timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
    });

    test('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Zone')).toBe(false);
      expect(isValidTimezone('Invalid')).toBe(false);
    });
  });
});
```

### 5.3 Integration Tests

**File:** `C:\Users\uppal\uppal-crm-project\test\timezone.integration.test.js`

```javascript
const request = require('supertest');
const app = require('../server');
const User = require('../models/User');
const { query } = require('../database/connection');

describe('Timezone API Integration', () => {
  let authToken;
  let testUserId;
  let testOrgId;

  beforeAll(async () => {
    // Create test user with timezone
    // Login and get token
  });

  afterAll(async () => {
    // Cleanup test data
  });

  describe('GET /api/timezones', () => {
    test('should return list of all timezones', async () => {
      const response = await request(app)
        .get('/api/timezones');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);

      const sampleTz = response.body.data[0];
      expect(sampleTz).toHaveProperty('value');
      expect(sampleTz).toHaveProperty('label');
    });
  });

  describe('GET /api/timezones/user', () => {
    test('should return current user timezone', async () => {
      const response = await request(app)
        .get('/api/timezones/user')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.timezone).toBeDefined();
      expect(response.body.user.id).toBeDefined();
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/timezones/user');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/timezones/user', () => {
    test('should update user timezone', async () => {
      const newTz = 'America/Los_Angeles';

      const response = await request(app)
        .put('/api/timezones/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ timezone: newTz });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.timezone).toBe(newTz);

      // Verify in database
      const dbResult = await query(
        'SELECT timezone FROM users WHERE id = $1',
        [testUserId]
      );
      expect(dbResult.rows[0].timezone).toBe(newTz);
    });

    test('should reject invalid timezone', async () => {
      const response = await request(app)
        .put('/api/timezones/user')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ timezone: 'Invalid/Zone' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put('/api/timezones/user')
        .send({ timezone: 'America/Los_Angeles' });

      expect(response.status).toBe(401);
    });
  });
});
```

### 5.4 Manual Testing Checklist

Create a testing checklist document:

**File:** `C:\Users\uppal\uppal-crm-project\TIMEZONE_MANUAL_TESTING.md`

```markdown
# Manual Testing Checklist for Timezone Support

## Database & Backend Tests

- [ ] Migration runs successfully
- [ ] Timezone column added to users table
- [ ] Default timezone set to 'America/New_York'
- [ ] Existing users have timezone field populated
- [ ] Can query users by timezone

## API Endpoint Tests

- [ ] GET /api/timezones returns list of timezones
- [ ] GET /api/timezones/user returns current user's timezone
- [ ] PUT /api/timezones/user updates timezone successfully
- [ ] Invalid timezone rejected with 400 error
- [ ] Unauthenticated requests return 401
- [ ] User timezone included in JWT token

## Frontend Tests

### Login & Authentication
- [ ] User logs in successfully
- [ ] Timezone is loaded from response
- [ ] Timezone stored in localStorage
- [ ] Timezone header sent in subsequent API calls
- [ ] User can see their timezone in Auth context

### Timestamp Display (Eastern Timezone)
- [ ] Contact created at 10:00 UTC displays as 5:00 AM EST
- [ ] Lead created at 16:00 UTC displays as 11:00 AM EST
- [ ] Deal created at 00:00 UTC displays as 7:00 PM (previous day) EST
- [ ] Task due dates show correct timezone
- [ ] Report generation dates show correct timezone

### Timezone Switching
- [ ] User can change timezone in settings
- [ ] Change immediately reflects in API header
- [ ] Timestamps update to new timezone
- [ ] Timezone persists across page reload
- [ ] Timezone persists across logout/login

### Edge Cases
- [ ] Daylight Saving Time transitions handled correctly
- [ ] Date boundaries cross correctly (UTC vs local time)
- [ ] Old data without timezone defaults correctly
- [ ] Invalid timezones handled gracefully
- [ ] Null/undefined dates don't crash display

## Browser Consistency
- [ ] Test in Chrome, Firefox, Safari
- [ ] Verify formatting is consistent
- [ ] Verify timezone abbreviations display correctly

## Performance
- [ ] Timezone list loads quickly
- [ ] No UI lag when changing timezone
- [ ] Timestamp formatting doesn't slow down tables
```

---

## Rollback Plan

### 6.1 Quick Rollback (Emergency)

If critical issues occur, follow this sequence:

#### Step 1: Stop Using New Features

Disable timezone selector in UI:

```javascript
// In TimezoneSelector.jsx
export const TimezoneSelector = () => {
  return <div>Timezone selection temporarily unavailable</div>
}
```

#### Step 2: Revert Code Changes

```bash
# Revert specific files
git checkout HEAD -- \
  middleware/auth.js \
  models/User.js \
  routes/timezone.js \
  utils/timezone.js \
  frontend/src/contexts/AuthContext.jsx \
  frontend/src/services/api.js
```

#### Step 3: Database Rollback

```bash
# Run rollback migration
node scripts/run-timezone-migration.js down
```

Verify rollback:

```bash
psql -d uppal_crm -c "\d users" | grep timezone
# Should show: No timezone column
```

#### Step 4: Deploy Previous Version

```bash
git revert <commit-hash>
git push origin production
```

### 6.2 Partial Rollback (Specific Features)

#### If Only Frontend Has Issues

```bash
# Revert frontend only
git checkout HEAD -- frontend/src/

# Keep backend timezone support for future use
# Frontend will use default timezone
```

#### If Only API Has Issues

```bash
# Disable timezone endpoints
# Edit routes/timezone.js
module.exports = {
  disabled: true,
  message: 'Timezone endpoints temporarily disabled'
};

# Frontend will gracefully fall back to default timezone
```

### 6.3 Database Rollback Script

**File:** `C:\Users\uppal\uppal-crm-project\database\rollback-timezone.sql`

```sql
-- Manual database rollback if migration script fails

-- Remove timezone column from users
ALTER TABLE users DROP COLUMN IF EXISTS timezone CASCADE;

-- Remove timezone from organization_settings
ALTER TABLE organization_settings DROP COLUMN IF EXISTS default_timezone CASCADE;

-- Remove index
DROP INDEX IF EXISTS idx_users_timezone;

-- Verify rollback
SELECT * FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'timezone';
-- Should return: No rows
```

### 6.4 Verification After Rollback

```bash
# Verify API works without timezone
curl http://localhost:3004/api/auth/me -H "Authorization: Bearer {token}"

# Verify users can login
curl -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Verify database integrity
psql -d uppal_crm -c "SELECT COUNT(*) FROM users;"
psql -d uppal_crm -c "SELECT COUNT(*) FROM user_sessions;"

# Verify no orphaned references
psql -d uppal_crm -c "PRAGMA integrity_check;" # Or equivalent for PostgreSQL
```

---

## Implementation Checklist

Use this checklist to track progress:

```
PHASE 1: DATABASE & MIGRATION
  [ ] Create migration file
  [ ] Create migration runner script
  [ ] Run migration (up)
  [ ] Verify with verification SQL
  [ ] Backup database

PHASE 2: BACKEND SETUP
  [ ] Update User model constructor
  [ ] Update User.create() method
  [ ] Update User.update() method
  [ ] Update User.toJSON()
  [ ] Update User.generateToken()
  [ ] Update User.verifyToken()
  [ ] Create timezone.js utility
  [ ] Create timezones.json
  [ ] Create timezone API routes
  [ ] Register routes in server.js
  [ ] Test API endpoints with Postman/curl
  [ ] Verify JWT includes timezone

PHASE 3: FRONTEND DEPENDENCIES & CONTEXT
  [ ] npm install date-fns-tz
  [ ] Verify in package.json
  [ ] Create timezoneUtils.js
  [ ] Update AuthContext (state management)
  [ ] Update AuthContext (setTimezone method)
  [ ] Update api.js (timezone header)
  [ ] Add timezoneAPI exports

PHASE 4: COMPONENTS
  [ ] Create TimezoneSelector component
  [ ] Update Dashboard
  [ ] Update ContactsTable
  [ ] Update LeadsTable
  [ ] Update all other tables
  [ ] Update Reports page
  [ ] Update Settings page

PHASE 5: TESTING
  [ ] Unit tests pass
  [ ] Integration tests pass
  [ ] Manual testing checklist completed
  [ ] Cross-browser testing done
  [ ] Performance verified

PHASE 6: DEPLOYMENT
  [ ] Code review completed
  [ ] All tests passing
  [ ] Documentation updated
  [ ] Rollback plan reviewed
  [ ] Deploy to staging
  [ ] Smoke tests on staging
  [ ] Deploy to production
  [ ] Monitor for errors
  [ ] Document any issues
```

---

## Support & Troubleshooting

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Timezone not persisting | localStorage cleared | Add fallback default in AuthContext |
| Wrong time displayed | UTC vs local confusion | Check formatInTimeZone is being used |
| Migration fails | Column already exists | Check IF NOT EXISTS in migration |
| API returns 401 | Token expired | Re-login to get fresh token with timezone |
| Invalid timezone error | Wrong timezone string | Verify against TIMEZONE_LIST |
| Performance issues | Too many API calls | Cache timezone list in localStorage |

### Debug Mode

Enable debug logging:

**Frontend:**
```javascript
// In timezoneUtils.js
const DEBUG = true;

export function formatDateWithTimezone(...) {
  if (DEBUG) console.log('Formatting', dateValue, 'with', userTimezone);
  // ...
}
```

**Backend:**
```javascript
// In routes/timezone.js
const DEBUG = process.env.DEBUG_TIMEZONE === 'true';

router.get('/', (req, res) => {
  if (DEBUG) console.log('Timezone list requested');
  // ...
});
```

---

## Next Steps After Phase 1A

1. **Phase 1B:** Time formatting in reports and exports
2. **Phase 2:** Organization-level default timezone settings
3. **Phase 3:** Meeting/event scheduling with timezone support
4. **Phase 4:** Automated reports sent at user's local time

---

**Document completed:** January 27, 2026
**Next review date:** February 28, 2026
**Owner:** Development Team
