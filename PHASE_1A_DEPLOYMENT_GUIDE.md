# Phase 1A: Deployment & Operations Guide

---

## Pre-Deployment Checklist

### Code Verification
```
[ ] All database migration files created
[ ] All backend files created/modified
[ ] All frontend files created/modified
[ ] Package dependencies updated
[ ] No merge conflicts in git
[ ] All tests passing locally
[ ] No console errors in development
[ ] No linting errors
```

### Documentation Review
```
[ ] PHASE_1A_TIMEZONE_IMPLEMENTATION_SPEC.md reviewed
[ ] PHASE_1A_QUICK_START.md reviewed
[ ] PHASE_1A_CODE_SNIPPETS.md reviewed
[ ] This deployment guide reviewed
[ ] Rollback plan documented
[ ] Team briefed on changes
```

### Environment Verification
```
[ ] NODE_ENV correctly set for environment
[ ] DATABASE_URL accessible
[ ] JWT_SECRET configured
[ ] All required env variables present
[ ] Database backups current
[ ] Server has adequate disk space
[ ] Network connectivity verified
```

---

## Deployment Process

### Step 1: Backup Database (5 minutes)

```bash
# PostgreSQL backup
pg_dump -U $DB_USER -d $DB_NAME > backup-timezone-phase-1a-$(date +%Y%m%d-%H%M%S).sql

# Or via environment variable
pg_dump "$DATABASE_URL" > backup-timezone-phase-1a-$(date +%Y%m%d-%H%M%S).sql

# Verify backup
ls -lh backup-timezone-phase-1a-*.sql
```

### Step 2: Deploy Backend Code (10 minutes)

```bash
# 1. Pull latest code
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Verify no breaking changes in existing code
npm test

# 4. Run database migration
node scripts/run-timezone-migration.js up

# 5. Verify migration
psql -d $DB_NAME << EOF
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'timezone';
EOF
```

Expected output:
```
column_name | data_type | column_default
timezone    | character varying | 'America/New_York'::character varying
```

### Step 3: Deploy Frontend Code (10 minutes)

```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install new dependencies
npm install

# 3. Verify date-fns-tz installed
npm list date-fns-tz

# 4. Build for production (if using build step)
npm run build

# 5. Check for build errors
# Verify no bundle size warnings

# 6. Return to root
cd ..
```

### Step 4: Restart Application (5 minutes)

```bash
# Option 1: If using PM2
pm2 restart uppal-crm

# Option 2: If using systemd
sudo systemctl restart uppal-crm

# Option 3: Manual restart
# Stop the application
pkill -f "node server.js"

# Start it again
npm start

# Option 4: Docker
docker-compose restart uppal-crm
```

### Step 5: Health Checks (10 minutes)

```bash
# 1. Check API is responding
curl http://localhost:3004/api/timezones

# Expected: 200 OK with array of timezones

# 2. Check database migration
curl http://localhost:3004/api/health

# 3. Test login
curl -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

# 4. Check user timezone in response
# Response should include "timezone": "America/New_York"

# 5. Test timezone endpoint with token
TOKEN="<copy from login response>"
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3004/api/timezones/user

# 6. Verify frontend loads
curl http://localhost:3000

# Should return HTML without errors
```

### Step 6: Smoke Testing (15 minutes)

1. **Login Test**
   - Open browser
   - Navigate to application URL
   - Login with test account
   - Verify no 401 errors in console
   - Check localStorage for userTimezone

2. **Timezone Test**
   - Open browser DevTools (F12)
   - Go to Application > Local Storage
   - Look for `userTimezone` key
   - Should have value like `America/New_York`

3. **API Header Test**
   - Open Network tab in DevTools
   - Make any API call
   - Check Request Headers
   - Should see `X-User-Timezone: America/New_York`

4. **Display Test**
   - Navigate to Contacts page
   - Verify timestamps display correctly
   - Check multiple timestamps show same timezone

---

## Post-Deployment Verification

### Database Integrity Check

```sql
-- Run these queries to verify data integrity

-- Check timezone column exists
SELECT EXISTS (
  SELECT FROM information_schema.columns
  WHERE table_name = 'users' AND column_name = 'timezone'
) as timezone_column_exists;

-- Count users with timezone
SELECT
  COUNT(CASE WHEN timezone IS NOT NULL THEN 1 END) as with_timezone,
  COUNT(CASE WHEN timezone IS NULL THEN 1 END) as without_timezone,
  COUNT(*) as total
FROM users;

-- Sample users timezone distribution
SELECT timezone, COUNT(*) as user_count
FROM users
GROUP BY timezone
ORDER BY user_count DESC;

-- Check for invalid timezones
SELECT DISTINCT timezone FROM users
WHERE timezone NOT IN (
  'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Paris',
  'Asia/Tokyo', 'Australia/Sydney'
  -- Include all valid timezones from timezones.json
);
```

### API Endpoint Testing

```bash
#!/bin/bash
# run-timezone-tests.sh

BASE_URL="http://localhost:3004/api"
TOKEN="YOUR_AUTH_TOKEN"

echo "Testing Timezone Endpoints..."
echo "=============================="

# Test 1: Get all timezones
echo ""
echo "Test 1: GET /api/timezones"
curl -s $BASE_URL/timezones | jq '.count'
echo "✓ Timezones endpoint working"

# Test 2: Get user timezone
echo ""
echo "Test 2: GET /api/timezones/user"
curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE_URL/timezones/user | jq '.timezone'
echo "✓ User timezone endpoint working"

# Test 3: Update timezone
echo ""
echo "Test 3: PUT /api/timezones/user"
curl -s -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"timezone":"America/Los_Angeles"}' \
  $BASE_URL/timezones/user | jq '.user.timezone'
echo "✓ Timezone update endpoint working"

echo ""
echo "All timezone endpoints functional!"
```

### Frontend Verification Checklist

```
[ ] No JavaScript errors in console
[ ] Timezone loaded from backend
[ ] Timezone header sent in requests
[ ] Timestamps display correctly
[ ] TimezoneSelector component loads
[ ] Can change timezone in settings
[ ] Timezone persists after page reload
[ ] Logout clears timezone
[ ] Login restores timezone
```

---

## Monitoring & Alerts

### Logs to Monitor

```bash
# Backend logs
tail -f logs/application.log | grep -i timezone

# Check for migration errors
tail -f logs/migration.log

# Watch for API errors
tail -f logs/api.log | grep "timezone"

# Database logs
tail -f /var/log/postgresql/postgresql.log | grep "users"
```

### Key Metrics to Track

1. **Database Performance**
   - Query time for users table
   - Index usage on timezone column
   - Connection pool status

2. **API Performance**
   - Response time for /api/timezones
   - Response time for /api/timezones/user
   - Error rate on timezone endpoints

3. **Frontend Performance**
   - Page load time
   - JavaScript bundle size
   - Time to first interactive

### Error Patterns to Watch

```
ERROR: "Invalid timezone" -> Check user input validation
ERROR: "Column 'timezone' not found" -> Migration didn't run
ERROR: "TypeError: formatInTimeZone is not a function" -> date-fns-tz not installed
ERROR: "X-User-Timezone header missing" -> API interceptor issue
WARN: "Unknown timezone" -> Invalid timezone in database
```

---

## Common Deployment Issues & Solutions

### Issue 1: Migration Fails with "Column Already Exists"

**Cause:** Migration was previously run or column was manually added

**Solution:**
```bash
# Check if column exists
psql -d $DB_NAME -c "\d users" | grep timezone

# If exists, modify migration to handle it (it should with IF NOT EXISTS)
# Or manually add IF NOT EXISTS to migration

# Verify migration runs without error
node scripts/run-timezone-migration.js up
```

### Issue 2: "date-fns-tz: Cannot find module"

**Cause:** Dependency not installed

**Solution:**
```bash
cd frontend
npm install --save date-fns-tz@2.0.0
npm list date-fns-tz

# Verify in node_modules
ls node_modules/date-fns-tz/

# Clear cache and reinstall if needed
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue 3: "User timezone undefined" in API response

**Cause:** User model not updated to include timezone

**Solution:**
```javascript
// Verify User.js includes timezone in toJSON()
// Check verifyToken() includes timezone in SELECT
// Restart server after changes

npm run dev
```

### Issue 4: "401 Unauthorized" on timezone endpoints

**Cause:** Token expired or invalid auth header

**Solution:**
```bash
# Get fresh token
curl -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Use new token
curl -H "Authorization: Bearer NEW_TOKEN" \
  http://localhost:3004/api/timezones/user
```

### Issue 5: Timestamps showing wrong time

**Cause:** formatInTimeZone not being used or wrong timezone passed

**Solution:**
```javascript
// Verify timezone is passed to formatter
console.log('Timezone:', timezone)
console.log('Date:', dateValue)

// Use formatInTimeZone instead of format
import { formatInTimeZone } from 'date-fns-tz'

// Verify timezone is valid
import { isValidTimezone } from '../utils/timezoneUtils'
console.log('Valid?', isValidTimezone(timezone))
```

### Issue 6: "X-User-Timezone header not sent"

**Cause:** API interceptor not setting header

**Solution:**
```javascript
// Check api.js request interceptor
console.log('Adding header:', localStorage.getItem('userTimezone'))

// Verify header in network tab
// DevTools > Network > Click request > Headers

// Manually add if needed
api.defaults.headers.common['X-User-Timezone'] = 'America/New_York'
```

---

## Rollback Procedure

If critical issues occur, follow this sequence:

### Quick Rollback (Under 30 minutes)

```bash
# Step 1: Stop the application
pm2 stop uppal-crm
# or
sudo systemctl stop uppal-crm

# Step 2: Revert code changes
git revert <commit-hash>

# Step 3: Reinstall frontend dependencies to remove date-fns-tz
cd frontend
npm install
cd ..

# Step 4: Rollback database (if needed)
node scripts/run-timezone-migration.js down

# Step 5: Restart application
pm2 start uppal-crm
# or
npm start

# Step 6: Verify
curl http://localhost:3004/api/auth/login \
  -d '{"email":"admin@example.com","password":"password"}'
```

### Database Rollback Only

```bash
# If only database needs rollback, code changes are safe
node scripts/run-timezone-migration.js down

# Verify rollback
psql -d $DB_NAME -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='timezone';"

# Should return: (0 rows)
```

### Full Restore from Backup

```bash
# If rollback fails, restore from backup
psql -d $DB_NAME < backup-timezone-phase-1a-TIMESTAMP.sql

# Verify restoration
psql -d $DB_NAME -c "SELECT COUNT(*) FROM users;"

# Check no timezone column
psql -d $DB_NAME -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='timezone';"
```

---

## Performance Tuning

### Database Optimization

```sql
-- Verify index is being used
EXPLAIN ANALYZE SELECT * FROM users WHERE timezone = 'America/New_York';

-- If needed, create index on specific timezones
CREATE INDEX idx_users_timezone_popular
ON users(timezone)
WHERE timezone IN ('America/New_York', 'America/Los_Angeles', 'Europe/London');

-- Monitor index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename = 'users'
ORDER BY idx_scan DESC;
```

### Frontend Optimization

```javascript
// Cache timezone list in IndexedDB or sessionStorage
// Avoid refetching on every component mount

const getCachedTimezones = async () => {
  const cached = sessionStorage.getItem('timezonesList')
  if (cached) return JSON.parse(cached)

  const data = await timezoneAPI.getTimezones()
  sessionStorage.setItem('timezonesList', JSON.stringify(data))
  return data
}

// Memoize formatting function
import { useMemo } from 'react'

const formattedDate = useMemo(
  () => formatDateWithTimezone(dateValue, timezone),
  [dateValue, timezone]
)
```

---

## Support & Escalation

### Tier 1: Common Issues (Internal team)

- Timezone selector not appearing
- Wrong time displayed by a few hours
- Timezone not persisting after reload

### Tier 2: Database Issues (DBA)

- Migration failed
- Timezone column missing
- Data inconsistency

### Tier 3: Critical Issues (Escalate)

- API completely broken
- Database corruption
- Data loss

### Contact Information

- **Development Lead:** [Contact Info]
- **Database Admin:** [Contact Info]
- **DevOps/Infrastructure:** [Contact Info]
- **On-Call Support:** [Phone/Slack]

---

## Post-Deployment Documentation

### What Changed
- Added timezone support to user profiles
- Users can now select their timezone
- All timestamps display in user's local timezone

### User Impact
- **Positive:** Accurate time display in their timezone
- **Neutral:** No action required, defaults to Eastern Time
- **Potential Issues:** None identified

### API Changes
- New endpoint: `GET /api/timezones` - Get available timezones
- New endpoint: `GET /api/timezones/user` - Get user's timezone
- New endpoint: `PUT /api/timezones/user` - Update user's timezone
- New header: `X-User-Timezone` - Sent with all requests

### Database Changes
- Column added: `users.timezone` (VARCHAR(50))
- Index added: `idx_users_timezone`
- Default value: `'America/New_York'`
- All existing users get default timezone

### Frontend Changes
- New library: `date-fns-tz` (2.0.0)
- New component: `TimezoneSelector.jsx`
- Updated: `AuthContext.jsx` - Timezone state management
- Updated: `api.js` - Timezone header handling

---

## Verification Commands Cheatsheet

```bash
# Check database
psql -d uppal_crm -c "SELECT COUNT(*) as users_with_timezone FROM users WHERE timezone IS NOT NULL;"

# Check API
curl http://localhost:3004/api/timezones | jq '.count'

# Check migrations
psql -d uppal_crm -c "\d users" | grep timezone

# Check logs
grep -i timezone logs/application.log | tail -20

# Check file existence
ls models/User.js routes/timezone.js frontend/src/utils/timezoneUtils.js

# Quick health check
curl http://localhost:3004/api/health && echo "✓ API OK"
```

---

## Version Management

**Phase 1A Version:** 1.0.0
**Release Date:** January 2026
**Status:** Deployed

### Version History
- **1.0.0:** Initial timezone support
- **1.0.1:** (TBD) Bug fixes
- **1.1.0:** (TBD) Organization-level timezone settings

### Rollback Version
If rollback needed, revert to: [Previous Git Tag]

---

**Deployment Guide Last Updated:** January 27, 2026
**Next Review:** February 27, 2026
