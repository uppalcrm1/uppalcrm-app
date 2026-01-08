# Staging Deployment Checklist

## Before Deploying to Production from Staging

This checklist ensures that fixes applied directly to production are also in staging, preventing regressions when deploying from staging to production.

### ✅ Custom Field Override Fix (Applied: Jan 7, 2026)

**Problem**: Custom fields with system field names (email, phone, source) were overriding system field settings and preventing visibility changes from persisting.

**Fixes Applied to Both Staging and Production**:

1. **Added SYSTEM_FIELD_NAMES constant** (`routes/customFields.js`)
   - Prevents creating custom fields with reserved system field names
   - Blocks: source, first_name, last_name, email, phone, company, status, priority, assigned_to, next_follow_up, etc.

2. **Updated GET /custom-fields endpoint** (`routes/customFields.js`)
   - Explicitly excludes system field names from custom_field_definitions queries
   - Filter: `WHERE field_name != ALL($SYSTEM_FIELD_NAMES)`

3. **Removed custom field override logic** (`routes/customFields.js`)
   - System fields NO LONGER read from custom_field_definitions
   - Only reads from default_field_configurations and system defaults

4. **Cleanup Script Available** (`delete-conflicting-custom-fields.js`)
   - Run this on staging database if needed: `node delete-conflicting-custom-fields.js`
   - Will delete any custom fields that have system field names
   - Production cleanup: Deleted 12 conflicting fields on Jan 7, 2026

### When to Run Cleanup on Staging

If you see these symptoms on staging:
- System field visibility changes don't persist after refresh
- Unable to delete certain custom fields
- System fields showing incorrect visibility

**Run the cleanup**:
```bash
# Make sure you're connected to staging database
node delete-conflicting-custom-fields.js
```

### Git Branches Status
- ✅ `main`: Contains all fixes (commit 8392b61)
- ✅ `production`: Deployed with fixes (commit 8392b61)
- ✅ `staging`: Merged from main (commit 8392b61)

### Future Workflow
1. Always develop on `main` or feature branches
2. Merge to `staging` for testing
3. Only deploy to `production` after staging validation
4. If hotfixes are applied directly to `production`, immediately merge back to `staging` and `main`

---

## General Deployment Process

### From Staging to Production
```bash
git checkout staging
git pull origin staging
# Test thoroughly on staging environment
git checkout main
git merge staging
git push origin main:production
```

### Emergency Hotfix (Direct to Production)
```bash
# Fix on main
git checkout main
# Make fixes...
git commit -m "Hotfix: description"
git push origin main:production

# Immediately sync back to staging
git checkout staging
git merge main
git push origin staging
```

This ensures staging always has the latest production fixes.
