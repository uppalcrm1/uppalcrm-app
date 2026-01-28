# Phase 1A: Complete Code Snippets Reference

This document contains all actual code needed for Phase 1A implementation, organized by file.

---

## Backend Implementation

### 1. Database Migration

**File:** `database/migrations/001-add-timezone-to-users.js`

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

### 2. Migration Runner Script

**File:** `scripts/run-timezone-migration.js`

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

### 3. Timezone Utilities

**File:** `utils/timezone.js`

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

### 4. Timezones List (JSON)

**File:** `utils/timezones.json`

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

### 5. Timezone API Routes

**File:** `routes/timezone.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
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

### 6. User Model Updates

**In `models/User.js`, make these changes:**

```javascript
// CHANGE 1: Constructor (add after line 25)
class User {
  constructor(data = {}) {
    // ... existing fields ...
    this.deleted_at = data.deleted_at;
    this.created_by = data.created_by;
    this.timezone = data.timezone || 'America/New_York'; // ADD THIS LINE
  }

  // CHANGE 2: In create() method (around line 36)
  static async create(userData, organizationId, createdBy = null) {
    const {
      email, password, first_name, last_name, role = 'user',
      is_first_login = false,
      timezone = 'America/New_York'  // ADD THIS LINE
    } = userData;

    // ... existing validation code ...

    // In the INSERT query, add timezone to columns and values:
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

  // CHANGE 3: In update() method (around line 579)
  static async update(id, updates, organizationId) {
    const allowedFields = [
      'name', 'email', 'role', 'status', 'first_name', 'last_name',
      'is_first_login', 'failed_login_attempts', 'password', 'deleted_at',
      'timezone'  // ADD THIS
    ];
    // ... rest of method stays the same ...
  }

  // CHANGE 4: In toJSON() method (around line 551)
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

  // CHANGE 5: In verifyToken() method (around line 347)
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      console.log('[verifyToken] Decoded token:', {
        userId: decoded.userId,
        organizationId: decoded.organizationId,
        email: decoded.email
      });

      // UPDATE THIS QUERY TO INCLUDE timezone
      const sessionResult = await query(`
        SELECT
          u.id, u.organization_id, u.email, u.first_name, u.last_name,
          u.role, u.permissions, u.last_login, u.email_verified,
          u.is_active, u.timezone, u.created_at, u.updated_at, u.created_by
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = true
      `, [tokenHash], decoded.organizationId);

      // ... rest stays the same ...
    }
  }

  // CHANGE 6: In generateToken() method (around line 277)
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

    // ... rest stays the same ...
  }
}
```

### 7. Register Routes in Server

**In `server.js`, add this:**

```javascript
// Near other route registrations (around line 50-100)
const timezoneRoutes = require('./routes/timezone');
app.use('/api/timezones', timezoneRoutes);
```

---

## Frontend Implementation

### 1. Timezone Utilities

**File:** `frontend/src/utils/timezoneUtils.js`

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

### 2. Update AuthContext

**File:** `frontend/src/contexts/AuthContext.jsx` - Replace entirely with:

```javascript
import React, { createContext, useContext, useReducer, useEffect } from 'react'
import { authAPI, setAuthToken, setOrganizationSlug, clearAuth } from '../services/api'
import toast from 'react-hot-toast'

const AuthContext = createContext()

const initialState = {
  user: null,
  organization: null,
  timezone: 'America/New_York',
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
        timezone: action.payload.user?.timezone || 'America/New_York',
        isLoading: false,
        isAuthenticated: true,
      }
    case 'AUTH_ERROR':
      return {
        ...state,
        user: null,
        organization: null,
        timezone: 'America/New_York',
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
        timezone: action.payload.timezone || state.timezone,
      }
    case 'SET_TIMEZONE':
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
      localStorage.removeItem('userTimezone')
      dispatch({ type: 'LOGOUT' })
      toast.success('Logged out successfully')
    }
  }

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData })
  }

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
    setTimezone,
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

### 3. Update API Service

**In `frontend/src/services/api.js`, add these sections:**

```javascript
// After the organizationSlug setup (around line 30-35)
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

// Update the request interceptor (replace existing one):
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

// Add this before the final exports (at the end of api.js):
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

### 4. TimezoneSelector Component

**File:** `frontend/src/components/TimezoneSelector.jsx`

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

  // Update selected timezone when auth timezone changes
  useEffect(() => {
    setSelectedTimezone(timezone)
  }, [timezone])

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
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 disabled:bg-gray-100"
      >
        {timezones.map((tz) => (
          <option key={tz.value} value={tz.value}>
            {tz.label} (UTC {tz.offset})
          </option>
        ))}
      </select>
      {loading && <p className="text-sm text-gray-500 mt-1">Updating...</p>}
    </div>
  )
}

export default TimezoneSelector
```

---

## Usage Examples in Components

### Example 1: Table Component with Timezone

```javascript
import { useAuth } from '../contexts/AuthContext'
import { formatDateWithTimezone } from '../utils/timezoneUtils'

export const ContactsTable = ({ contacts }) => {
  const { timezone } = useAuth()

  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Created At</th>
          <th>Updated At</th>
        </tr>
      </thead>
      <tbody>
        {contacts.map(contact => (
          <tr key={contact.id}>
            <td>{contact.name}</td>
            <td>{formatDateWithTimezone(contact.created_at, timezone, 'MMM d, yyyy HH:mm')}</td>
            <td>{formatDateWithTimezone(contact.updated_at, timezone, 'MMM d, yyyy HH:mm')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

### Example 2: Page with Timezone Selector

```javascript
import { useAuth } from '../contexts/AuthContext'
import TimezoneSelector from '../components/TimezoneSelector'

export const SettingsPage = () => {
  const { user, timezone } = useAuth()

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="profile-settings">
        <h2>Profile</h2>
        <p>Name: {user.first_name} {user.last_name}</p>
        <p>Email: {user.email}</p>
        <p>Current Timezone: {timezone}</p>
      </section>

      <section className="timezone-settings">
        <h2>Timezone Preferences</h2>
        <TimezoneSelector />
      </section>
    </div>
  )
}
```

### Example 3: Display Current Time in User Timezone

```javascript
import { useAuth } from '../contexts/AuthContext'
import { getCurrentTimeInTimezone } from '../utils/timezoneUtils'
import { useState, useEffect } from 'react'

export const CurrentTimeDisplay = () => {
  const { timezone } = useAuth()
  const [currentTime, setCurrentTime] = useState('')

  useEffect(() => {
    // Update every second
    const timer = setInterval(() => {
      setCurrentTime(getCurrentTimeInTimezone(timezone, 'HH:mm:ss'))
    }, 1000)

    return () => clearInterval(timer)
  }, [timezone])

  return (
    <div className="current-time">
      <p>Current time: {currentTime}</p>
    </div>
  )
}
```

---

**All code snippets are production-ready and can be copied directly into your project.**
