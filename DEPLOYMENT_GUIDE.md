# Deployment Guide: Custom Fields Lead Conversion

## 🎯 Deployment Strategy

**RECOMMENDED APPROACH: Staging → Production**

This deployment involves:
- ✓ Database migration (new column)
- ✓ Code changes (lead conversion logic)
- ✓ Multi-tenant system (affects all orgs)

---

## 📋 STAGING DEPLOYMENT

### Prerequisites

- [ ] Staging database backup created
- [ ] Staging environment accessible
- [ ] Database credentials for staging
- [ ] Git branch created/merged for staging

### Step 1: Deploy to Staging Database

```bash
# Connect to staging environment
# (adjust based on your deployment setup)

# Option A: Run migration script directly
node apply-contacts-custom-fields-migration.js

# Option B: Use your migration runner (if you have one)
# npm run migrate:up
# or
# node database/migrate.js up
```

**Expected Output:**
```
✅ Migration applied successfully!
✅ Verification successful:
   Column name: custom_fields
   Data type: jsonb
   Default: '{}'::jsonb
```

### Step 2: Deploy Code to Staging

```bash
# If using Git deployment
git checkout main
git pull origin main
git push staging main  # or your staging remote

# If using PM2
pm2 deploy ecosystem.config.js staging

# Or restart manually
pm2 restart uppal-crm-staging
# or
npm restart
```

### Step 3: Verify Staging Deployment

#### A. Check Database Structure
```bash
node check-table-structure.js
```

Should show:
```
📋 CONTACTS TABLE COLUMNS:
  ...
  - custom_fields: jsonb
  ✓ Has custom_fields column: ✅ YES
```

#### B. Run Test Scripts
```bash
# Test custom fields conversion
node test-custom-fields-conversion.js

# Test multi-tenant isolation
node test-multi-tenant-isolation.js
```

#### C. Manual Testing in Staging

1. **Create a test lead with custom fields**
   ```
   - Go to Leads page in staging
   - Create a new lead
   - Add custom field: App = "test_app"
   ```

2. **Convert the lead**
   ```
   - Open the lead
   - Click "Convert" or use conversion API
   - Create account during conversion
   ```

3. **Verify custom fields copied**
   ```
   - Check Contact details → should see custom_fields with "App"
   - Check Account details → should see custom_fields with "App"
   ```

4. **Verify existing functionality**
   ```
   - Convert a lead without custom fields → should work normally
   - Create a new contact → should work normally
   - Create a new account → should work normally
   ```

### Step 4: Staging Validation Checklist

- [ ] Migration completed successfully (no errors)
- [ ] Server restarted without issues
- [ ] Test scripts pass
- [ ] Manual lead conversion works
- [ ] Custom fields appear in contact
- [ ] Custom fields appear in account
- [ ] Leads without custom fields still convert normally
- [ ] No errors in server logs
- [ ] No console errors in frontend
- [ ] Multi-tenant isolation verified (if multiple orgs in staging)

### Step 5: Monitor Staging

**Monitor for 24-48 hours:**
- [ ] Check error logs: `npm run logs:staging` or `pm2 logs`
- [ ] Verify lead conversions work
- [ ] Check database performance (no slow queries)
- [ ] Review any reported issues from staging users

---

## 📋 PRODUCTION DEPLOYMENT

### Prerequisites

- [ ] ✅ Staging deployment successful
- [ ] ✅ Staging tests passed
- [ ] ✅ No issues found in staging (24-48 hour monitoring)
- [ ] Production database backup created
- [ ] Deployment window scheduled (if required)
- [ ] Rollback plan documented
- [ ] Team notified

### Step 1: Pre-Production Checklist

- [ ] Create full production database backup
  ```bash
  # Example (adjust based on your setup)
  pg_dump -h production-host -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] Verify backup integrity
- [ ] Ensure rollback scripts ready
- [ ] Schedule deployment (low-traffic time if possible)

### Step 2: Deploy to Production Database

```bash
# Connect to production environment
# IMPORTANT: Double-check you're on production!

# Run migration
node apply-contacts-custom-fields-migration.js

# Or use your migration tool
# npm run migrate:up --env=production
```

**Verify immediately:**
```bash
node check-table-structure.js
```

### Step 3: Deploy Code to Production

```bash
# Git deployment
git checkout main
git pull origin main
git push production main

# PM2 deployment
pm2 deploy ecosystem.config.js production

# Or restart
pm2 restart uppal-crm-production
```

### Step 4: Post-Deployment Verification

#### Immediate Checks (First 5 minutes)

1. **Server health**
   ```bash
   pm2 status
   pm2 logs --lines 100
   ```

2. **Database connection**
   ```bash
   # Test a simple query
   node -e "require('./database/connection').testConnection()"
   ```

3. **API health check**
   ```bash
   curl https://your-production-domain.com/health
   ```

#### Functional Testing (First 30 minutes)

- [ ] Convert a test lead (with custom fields)
- [ ] Convert a test lead (without custom fields)
- [ ] Verify contact created successfully
- [ ] Verify account created successfully
- [ ] Check custom_fields appear in UI
- [ ] Test with different organizations

#### Monitoring (First 24 hours)

- [ ] Monitor error logs continuously
- [ ] Watch database performance metrics
- [ ] Track lead conversion success rate
- [ ] Monitor API response times
- [ ] Check for any customer-reported issues

---

## 🔄 ROLLBACK PLAN

### If Issues Occur in Production

#### Option 1: Rollback Code Only (if migration was successful but code has issues)

```bash
# Revert code to previous version
git revert <commit-hash>
git push production main

# Restart server
pm2 restart uppal-crm-production
```

**Note:** Database migration does NOT need to be rolled back because:
- Adding a column with a default value is non-breaking
- Existing code ignores the new column
- No data is lost

#### Option 2: Full Rollback (if migration has issues)

```bash
# 1. Rollback code
git revert <commit-hash>
git push production main
pm2 restart uppal-crm-production

# 2. Rollback database migration
# Create rollback script:
```

**Rollback Migration (`rollback_017.sql`):**
```sql
BEGIN;

-- Drop the index
DROP INDEX IF EXISTS idx_contacts_custom_fields;

-- Remove the column (only if absolutely necessary)
-- WARNING: This will delete any custom_fields data in contacts
ALTER TABLE contacts DROP COLUMN IF EXISTS custom_fields;

COMMIT;
```

**⚠️ WARNING:** Only run database rollback if absolutely necessary, as it will delete any custom_fields data already saved in contacts.

#### Option 3: Restore from Backup (worst case)

```bash
# Restore database from backup
psql -h production-host -U username -d database_name < backup_YYYYMMDD_HHMMSS.sql

# Verify restoration
# Restart server with previous code version
```

---

## 📊 Success Criteria

### Staging Success
- ✅ All automated tests pass
- ✅ Manual testing confirms expected behavior
- ✅ No errors in logs for 24-48 hours
- ✅ Performance metrics normal

### Production Success
- ✅ Migration completes without errors
- ✅ Server starts normally
- ✅ Lead conversions work as expected
- ✅ Custom fields transfer correctly
- ✅ No increase in error rates
- ✅ No customer complaints
- ✅ Database performance stable

---

## 🔍 What to Monitor

### Application Logs
```bash
# Look for these errors
- "custom_fields"
- "column does not exist"
- "conversion failed"
- Lead conversion endpoint errors
```

### Database Metrics
- Query execution time for lead conversion
- Table size of contacts table
- Index usage on custom_fields column

### User Behavior
- Lead conversion success rate
- Contact creation success rate
- Account creation success rate

---

## 📞 Emergency Contacts

Document your team's escalation path:

1. **First Responder:** [Name, Contact]
2. **Database Admin:** [Name, Contact]
3. **Engineering Lead:** [Name, Contact]
4. **On-Call:** [Name, Contact]

---

## 📝 Deployment Checklist Summary

### Staging
- [ ] Database backup
- [ ] Run migration
- [ ] Deploy code
- [ ] Run tests
- [ ] Manual testing
- [ ] Monitor for 24-48 hours
- [ ] Document any issues

### Production
- [ ] Staging validated ✅
- [ ] Production backup
- [ ] Run migration
- [ ] Deploy code
- [ ] Immediate verification
- [ ] Functional testing
- [ ] 24-hour monitoring
- [ ] Sign-off

---

## ✅ Final Notes

**Deployment Risk Level:** 🟡 Medium

- **Database change:** Low risk (adding column with default)
- **Code change:** Medium risk (modifies core conversion logic)
- **Impact:** All organizations (multi-tenant)
- **Reversibility:** Code easily reversible, database column can remain

**Recommendation:**
1. Deploy to staging first
2. Test thoroughly for 24-48 hours
3. Deploy to production during low-traffic window
4. Monitor closely for first 24 hours

---

**Last Updated:** 2026-01-04
**Author:** Account Management Agent
