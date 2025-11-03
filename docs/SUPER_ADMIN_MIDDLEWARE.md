# Super Admin Middleware Documentation

**File:** `middleware/auth.js`
**Function:** `requireSuperAdmin`
**Status:** ✅ Production Ready
**Date:** November 3, 2025

---

## Overview

The `requireSuperAdmin` middleware authenticates and authorizes super admin users who have platform-wide access to manage all organizations. Super admins are **NOT** tied to any specific organization and operate at the platform level.

---

## Key Differences: Super Admin vs Regular Users

| Feature | Regular Users | Super Admins |
|---------|--------------|--------------|
| **Database Table** | `users` | `super_admin_users` |
| **Organization** | Required (`organization_id`) | None (no `organization_id`) |
| **Access Scope** | Single organization | All organizations (platform-wide) |
| **Authentication** | `authenticateToken` | `requireSuperAdmin` |
| **Token Flag** | Standard JWT | `is_super_admin: true` in JWT |
| **Role Check** | `role` in users table | `role = 'super_admin'` |
| **Context** | `req.user` | `req.superAdmin` (also sets `req.user` for compatibility) |

---

## Middleware Function

### Function Signature
```javascript
const requireSuperAdmin = async (req, res, next)
```

### What It Does

1. **Checks Authorization Header**
   - Looks for `Authorization: Bearer <token>`
   - Returns 401 if no token provided

2. **Verifies JWT Token**
   - Validates token signature using `JWT_SECRET`
   - Checks for `is_super_admin: true` flag
   - Returns 403 if not a super admin token

3. **Validates Super Admin User**
   - Queries `super_admin_users` table
   - Verifies user exists and `is_active = true`
   - Checks `role = 'super_admin'`
   - Returns 403 if user invalid or inactive

4. **Sets Request Context**
   - Sets `req.superAdmin` with user details
   - Also sets `req.user` for backward compatibility
   - Calls `next()` to continue

---

## Database Schema

### Super Admin Users Table

```sql
CREATE TABLE super_admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'super_admin',
    permissions JSONB DEFAULT '["view_all_organizations", "manage_trials", "view_analytics"]',
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Key Points:**
- ✅ No `organization_id` column (platform-wide access)
- ✅ Separate from `users` table (different authentication)
- ✅ `role` defaults to 'super_admin'
- ✅ `is_active` flag for enabling/disabling accounts
- ✅ `permissions` JSONB for fine-grained access control

---

## Usage

### Import Middleware
```javascript
const { requireSuperAdmin } = require('../middleware/auth');
```

### Apply to Routes
```javascript
router.get('/organizations', requireSuperAdmin, async (req, res) => {
  // req.superAdmin is available here
  console.log(`Super admin: ${req.superAdmin.email}`);

  // Access all organizations (no RLS restrictions)
  const organizations = await Organization.getAllWithStats();

  res.json({ organizations });
});
```

### Multiple Middlewares
```javascript
router.put(
  '/organizations/:id',
  requireSuperAdmin,
  validateInput,
  async (req, res) => {
    // All middlewares passed
  }
);
```

---

## Request Context

After successful authentication, `req.superAdmin` contains:

```javascript
{
  id: 'uuid',
  email: 'admin@uppalcrm.com',
  first_name: 'Super',
  last_name: 'Admin',
  role: 'super_admin',
  permissions: ['view_all_organizations', 'manage_trials', 'view_analytics'],
  is_super_admin: true
}
```

**Also sets `req.user`** for backward compatibility with existing code.

---

## Response Codes

| Status | Scenario | Response |
|--------|----------|----------|
| **200** | Authorized | Request continues to handler |
| **401** | No token provided | `{ error: 'Access denied', message: 'No token provided' }` |
| **401** | Invalid token | `{ error: 'Access denied', message: 'Invalid token' }` |
| **401** | Expired token | `{ error: 'Access denied', message: 'Token has expired' }` |
| **403** | Not super admin | `{ error: 'Access forbidden', message: 'Super admin access required' }` |
| **403** | Inactive account | `{ error: 'Access forbidden', message: 'Invalid super admin user or account is inactive' }` |
| **403** | Wrong role | `{ error: 'Access forbidden', message: 'User is not a super admin' }` |
| **500** | Server error | `{ error: 'Server error', message: 'Failed to authenticate super admin' }` |

---

## Error Handling

The middleware handles three types of JWT errors:

### 1. JsonWebTokenError
```json
{
  "error": "Access denied",
  "message": "Invalid token"
}
```

### 2. TokenExpiredError
```json
{
  "error": "Access denied",
  "message": "Token has expired"
}
```

### 3. Database Errors
```json
{
  "error": "Server error",
  "message": "Failed to authenticate super admin"
}
```

---

## Security Features

### 1. Multi-Layer Validation
- ✅ JWT signature verification
- ✅ `is_super_admin` flag check
- ✅ Database user existence check
- ✅ `is_active` status check
- ✅ Role verification

### 2. Token Requirements
- ✅ Valid JWT signature
- ✅ `is_super_admin: true` in payload
- ✅ `user_id` matches super admin user
- ✅ Token not expired

### 3. Database Checks
- ✅ User exists in `super_admin_users` table
- ✅ User `is_active = true`
- ✅ User `role = 'super_admin'`

### 4. Protection Against
- ✅ Token theft (signature verification)
- ✅ Role elevation (separate table + role check)
- ✅ Disabled accounts (is_active check)
- ✅ Regular user access (is_super_admin flag)
- ✅ Expired tokens (JWT expiration)

---

## Testing

### Test Script
```bash
npm run test:super-admin-auth
```

### Test Coverage
1. ✅ Super admin login (valid credentials)
2. ✅ Access with valid super admin token
3. ✅ Access without token (should fail with 401)
4. ✅ Access with invalid token (should fail with 401)
5. ✅ Access with expired token (should fail with 401)
6. ✅ Access with regular user token (should fail with 403)
7. ✅ Verify `req.superAdmin` context is set

**Test File:** `test/super-admin-middleware.test.js`

---

## Example: Super Admin Login Flow

### 1. Login Request
```bash
POST /api/super-admin/login
Content-Type: application/json

{
  "email": "admin@uppalcrm.com",
  "password": "SecurePassword123!"
}
```

### 2. Login Response
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "admin": {
    "id": "uuid",
    "email": "admin@uppalcrm.com",
    "first_name": "Super",
    "last_name": "Admin",
    "role": "super_admin",
    "permissions": [...]
  }
}
```

### 3. Token Payload
```json
{
  "user_id": "uuid",
  "email": "admin@uppalcrm.com",
  "is_super_admin": true,
  "iat": 1699027200,
  "exp": 1699056000
}
```

### 4. Authenticated Request
```bash
GET /api/super-admin/organizations
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Middleware Processing
```
1. Extract token from header ✓
2. Verify JWT signature ✓
3. Check is_super_admin flag ✓
4. Query super_admin_users table ✓
5. Verify is_active = true ✓
6. Verify role = 'super_admin' ✓
7. Set req.superAdmin context ✓
8. Call next() ✓
```

---

## Integration with Existing Code

### Before (Old Code)
```javascript
// In routes/super-admin.js
const authenticateSuperAdmin = async (req, res, next) => {
  // Inline middleware logic...
};

router.get('/organizations', authenticateSuperAdmin, handler);
```

### After (New Code)
```javascript
// In routes/super-admin.js
const { requireSuperAdmin } = require('../middleware/auth');

router.get('/organizations', requireSuperAdmin, handler);
```

**Benefits:**
- ✅ Centralized middleware management
- ✅ Consistent authentication across routes
- ✅ Easier to maintain and test
- ✅ Better code organization
- ✅ Exported from single location

---

## Comparison with Regular User Middleware

### Regular User Authentication
```javascript
const { authenticateToken } = require('../middleware/auth');

router.get('/leads', authenticateToken, (req, res) => {
  // req.user is set (from users table)
  // req.organizationId is set
  // Access limited to user's organization
});
```

### Super Admin Authentication
```javascript
const { requireSuperAdmin } = require('../middleware/auth');

router.get('/organizations', requireSuperAdmin, (req, res) => {
  // req.superAdmin is set (from super_admin_users table)
  // req.user is also set (for compatibility)
  // No organizationId (platform-wide access)
  // Access to ALL organizations
});
```

---

## Permissions System

Super admins have a `permissions` JSONB field for fine-grained access control:

### Default Permissions
```json
[
  "view_all_organizations",
  "manage_trials",
  "view_analytics"
]
```

### Future: Permission Checks
```javascript
// Can be extended to check specific permissions
if (req.superAdmin.permissions.includes('manage_trials')) {
  // Allow trial management
}
```

---

## Best Practices

### 1. Always Use Middleware
```javascript
// ✅ Good
router.get('/organizations', requireSuperAdmin, handler);

// ❌ Bad - Manual checks in handler
router.get('/organizations', async (req, res) => {
  if (!req.user || !req.user.is_super_admin) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  // Handler logic...
});
```

### 2. Check req.superAdmin Not req.user
```javascript
// ✅ Good - Explicit
router.get('/organizations', requireSuperAdmin, (req, res) => {
  console.log(`Super admin: ${req.superAdmin.email}`);
});

// ⚠️  Okay - Works due to compatibility
router.get('/organizations', requireSuperAdmin, (req, res) => {
  console.log(`Super admin: ${req.user.email}`);
});
```

### 3. Don't Mix User Types
```javascript
// ❌ Bad - Don't use super admin middleware for regular users
router.get('/user-leads', requireSuperAdmin, handler); // Wrong!

// ✅ Good - Use appropriate middleware
router.get('/user-leads', authenticateToken, handler); // Correct!
```

### 4. Super Admin Routes Should Not Check organizationId
```javascript
// ✅ Good - Platform-wide access
router.get('/organizations', requireSuperAdmin, async (req, res) => {
  const orgs = await Organization.getAllWithStats();
  res.json({ organizations: orgs });
});

// ❌ Bad - Super admins have no organizationId
router.get('/organizations', requireSuperAdmin, async (req, res) => {
  const orgId = req.organizationId; // undefined!
  // This won't work for super admins
});
```

---

## Troubleshooting

### Issue: 401 Unauthorized
**Cause:** Token missing, invalid, or expired
**Solution:**
- Check `Authorization` header format: `Bearer <token>`
- Verify token hasn't expired
- Get new token by logging in again

### Issue: 403 Forbidden - "Super admin access required"
**Cause:** Token doesn't have `is_super_admin: true` flag
**Solution:**
- Token is for regular user, not super admin
- Login via `/api/super-admin/login` instead

### Issue: 403 Forbidden - "Invalid super admin user"
**Cause:** User doesn't exist or is inactive
**Solution:**
- Check user exists in `super_admin_users` table
- Verify `is_active = true`
- Check `role = 'super_admin'`

### Issue: req.superAdmin is undefined
**Cause:** Middleware not applied or failed
**Solution:**
- Verify middleware is in route chain
- Check for errors in server logs
- Ensure middleware runs before handler

---

## Migration Notes

### Updating Existing Routes

**Step 1:** Import new middleware
```javascript
const { requireSuperAdmin } = require('../middleware/auth');
```

**Step 2:** Replace old middleware
```javascript
// Before
router.get('/organizations', authenticateSuperAdmin, handler);

// After
router.get('/organizations', requireSuperAdmin, handler);
```

**Step 3:** Remove old middleware definition
```javascript
// Delete this:
const authenticateSuperAdmin = async (req, res, next) => {
  // ...
};
```

---

## Security Audit

### ✅ Checklist
- [x] JWT signature verification
- [x] is_super_admin flag check
- [x] Database user validation
- [x] Active status check
- [x] Role verification
- [x] Token expiration handling
- [x] Error messages don't leak sensitive info
- [x] Separate from regular user authentication
- [x] No organization_id leakage

### ⚠️  Important
- Super admins bypass Row-Level Security (RLS)
- Super admin access should be VERY restricted
- Monitor super admin activity
- Use strong passwords and 2FA (future)
- Regularly audit super admin accounts
- Log all super admin actions

---

## Future Enhancements

### 1. Two-Factor Authentication (2FA)
```javascript
const require2FA = async (req, res, next) => {
  if (req.superAdmin && !req.session.twoFactorVerified) {
    return res.status(403).json({
      error: '2FA required',
      redirect: '/verify-2fa'
    });
  }
  next();
};

router.get('/critical-action', requireSuperAdmin, require2FA, handler);
```

### 2. Permission-Based Access
```javascript
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.superAdmin.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

router.delete('/organizations/:id',
  requireSuperAdmin,
  requirePermission('delete_organizations'),
  handler
);
```

### 3. Activity Logging
```javascript
const logSuperAdminActivity = async (req, res, next) => {
  await query(`
    INSERT INTO super_admin_activity_log (admin_id, action, resource, timestamp)
    VALUES ($1, $2, $3, NOW())
  `, [req.superAdmin.id, req.method, req.path]);

  next();
};

router.use(requireSuperAdmin, logSuperAdminActivity);
```

---

## References

- **Middleware File:** `middleware/auth.js`
- **Routes File:** `routes/super-admin.js`
- **Database Migration:** `database/migrations/004_super_admin.sql`
- **Test File:** `test/super-admin-middleware.test.js`
- **API Documentation:** `docs/SUPER_ADMIN_API_ENDPOINTS.md`

---

**Documentation Version:** 1.0
**Last Updated:** November 3, 2025
**Maintained By:** UppalCRM Development Team
