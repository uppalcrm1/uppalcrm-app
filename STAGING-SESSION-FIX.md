# Staging Session Expiration Fix

## Problem
After deploying commit `b92f785` (strict UUID validation), users in staging are getting "session expired" errors.

## Root Cause
1. **Staging Configuration**: JWT tokens expire after 1 hour (`JWT_EXPIRES_IN=1h`)
2. **Recent Changes**: Added strict UUID validation to authentication middleware
3. **Impact**: Old sessions created before the deployment don't pass the new validation

## Solution

### Option 1: Run Cleanup Script (Recommended)

```bash
# Connect to your staging database and run:
node scripts/cleanup-invalid-sessions.js
```

This script will:
- Remove all expired sessions
- Remove sessions with invalid user references
- Show statistics about remaining sessions
- Clean up any corrupted data

### Option 2: Manual SQL Cleanup

If you have direct database access to staging:

```sql
-- 1. Check expired sessions
SELECT COUNT(*) FROM user_sessions WHERE expires_at < NOW();

-- 2. Delete expired sessions
DELETE FROM user_sessions WHERE expires_at < NOW();

-- 3. Delete sessions with invalid users
DELETE FROM user_sessions s
WHERE NOT EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = s.user_id AND u.is_active = true
);

-- 4. Verify cleanup
SELECT COUNT(*) FROM user_sessions;
```

### Option 3: Extend Session Duration in Staging

If you want staging to have longer sessions like production:

1. Go to Render Dashboard → uppalcrm-api-staging
2. Navigate to Environment Variables
3. Change `JWT_EXPIRES_IN` from `1h` to `24h`
4. Redeploy the service

## For Render Deployment

### Via Render Dashboard:
1. Go to https://dashboard.render.com
2. Select `uppalcrm-api-staging` service
3. Click "Shell" tab
4. Run: `node scripts/cleanup-invalid-sessions.js`

### Via Render API:
```bash
# Get shell access
render shell uppalcrm-api-staging

# Run cleanup
node scripts/cleanup-invalid-sessions.js
```

## Prevention

To prevent this in the future:

1. **Before deploying authentication changes**, run the cleanup script
2. **Consider using longer sessions in staging** (24h instead of 1h)
3. **Add session cleanup to deployment workflow**
4. **Monitor session table growth** and clean up periodically

## Testing After Fix

1. Clear all browser cookies/localStorage for staging
2. Navigate to staging URL
3. Log in with valid credentials
4. Verify session persists
5. Check browser console for any 401 errors

## Environment Variable Comparison

| Environment | JWT_EXPIRES_IN | Session Duration |
|-------------|----------------|------------------|
| Development | Not set (24h)  | 24 hours         |
| Staging     | 1h             | 1 hour           |
| Production  | 1h             | 1 hour           |

**Recommendation**: Consider changing staging to 24h for better developer experience.

## Related Files
- `middleware/auth.js` - Authentication middleware with UUID validation
- `models/User.js` - Token verification with strict validation
- `render.yaml` - Staging environment configuration
- `.env.production` - Production environment template

## Need Help?

If the issue persists after cleanup:
1. Check staging logs for specific error messages
2. Verify database connectivity
3. Ensure JWT_SECRET is properly set in Render
4. Check if user_sessions table exists and has correct schema
