# 🚀 STAGING DEPLOYMENT GUIDE
## Soft Delete System for Uppal CRM2

**Status:** ✅ Ready for deployment
**Date:** 2025-12-15
**Verification:** All checks passed

---

## ⚡ QUICK START

Run the verification script first:
```bash
node verify-soft-delete-deployment.js
```

You should see: `✅ All checks passed! Ready for staging deployment.`

---

## 📋 STEP-BY-STEP DEPLOYMENT

### STEP 1: Backup Staging Database ⚠️

**CRITICAL: Always backup before migrations!**

#### Option A: Using pg_dump (Recommended)

```bash
# Set your staging database credentials
$env:PGPASSWORD="your-password"

# Create backup
pg_dump -h your-staging-host.com `
  -U your-db-user `
  -d uppal_crm_staging `
  > backup_staging_$(Get-Date -Format "yyyyMMdd_HHmmss").sql
```

#### Option B: Using your hosting provider

- **Heroku:** `heroku pg:backups:capture --app your-staging-app`
- **Railway:** Use dashboard backup feature
- **Render:** Use dashboard backup feature
- **AWS RDS:** Create snapshot via AWS Console

✅ **Verify:** Check backup file size > 0 KB

---

### STEP 2: Run Database Migration

#### Connect to Staging Database

```bash
# Using psql
psql -h your-staging-host.com `
  -U your-db-user `
  -d uppal_crm_staging `
  -f database/migrations/018_add_soft_delete_columns.sql
```

#### OR via Hosting Provider

**Heroku:**
```bash
heroku pg:psql --app your-staging-app < database/migrations/018_add_soft_delete_columns.sql
```

**Railway:**
```bash
# Use Railway CLI or paste migration into database console
```

#### Expected Output

You should see:
```
ALTER TABLE
ALTER TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
...
========================================
SOFT DELETE MIGRATION VERIFICATION
========================================
Accounts.deleted_at column: ✓ EXISTS
Transactions.deleted_at column: ✓ EXISTS
Audit_log table: ✓ EXISTS
========================================
✓ Migration completed successfully!
```

✅ **Verify:** Run this query to confirm:
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'accounts'
AND column_name IN ('deleted_at', 'deleted_by', 'deletion_reason');
```

Should return 3 rows.

---

### STEP 3: Verify Migration Success

Run these verification queries:

```sql
-- Check accounts table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'accounts'
AND column_name LIKE '%deleted%';

-- Check transactions table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions'
AND column_name LIKE '%deleted%' OR column_name = 'is_void';

-- Check audit_log table exists
SELECT COUNT(*) as audit_table_exists
FROM information_schema.tables
WHERE table_name = 'audit_log';

-- Check indexes
SELECT indexname
FROM pg_indexes
WHERE tablename IN ('accounts', 'transactions')
AND indexname LIKE '%deleted%';
```

✅ **Expected:** All queries should return results with no errors.

---

### STEP 4: Deploy Backend Code

#### Option A: Git Push (Recommended)

```bash
# Commit changes
git add backend/controllers/accountController.js
git add backend/controllers/transactionController.js
git add routes/accounts-simple.js
git add routes/transactions.js
git add database/migrations/018_add_soft_delete_columns.sql

git commit -m "feat: Add soft delete system for accounts and transactions

- Add soft delete columns to accounts and transactions tables
- Create audit_log table for complete audit trail
- Add account soft delete/restore endpoints
- Add transaction void/restore endpoints
- Add frontend components for delete/void actions
- Complete documentation and testing guides"

# Push to staging branch
git push origin staging
```

#### Option B: Manual Upload

Upload these files to your staging server:
- `backend/controllers/accountController.js`
- `backend/controllers/transactionController.js`
- `routes/accounts-simple.js`
- `routes/transactions.js`

✅ **Verify:** Check files exist on staging server

---

### STEP 5: Install Dependencies (if needed)

```bash
# On staging server
cd backend
npm install

# OR if using SSH
ssh your-staging-server
cd /path/to/backend
npm install
```

✅ **Verify:** No error messages

---

### STEP 6: Restart Backend Server

Choose your deployment method:

#### PM2
```bash
pm2 restart all
# OR specific app
pm2 restart uppal-crm-backend

# Check logs
pm2 logs
```

#### Systemd
```bash
sudo systemctl restart uppal-crm
# Check status
sudo systemctl status uppal-crm
```

#### Docker
```bash
docker-compose restart backend
# Check logs
docker-compose logs -f backend
```

#### Heroku
```bash
heroku restart --app your-staging-app
```

#### Railway/Render
- Deployments restart automatically on Git push

✅ **Verify:** Backend is running without errors
```bash
curl https://your-staging-api.com/api/health
```

---

### STEP 7: Build & Deploy Frontend

```bash
cd frontend

# Install dependencies
npm install

# Build for staging
npm run build
# OR if you have staging env
npm run build:staging
```

#### Deploy Build

**Option A: Netlify/Vercel**
```bash
# Netlify
netlify deploy --prod --dir=dist

# Vercel
vercel --prod
```

**Option B: Manual Upload**
- Upload `dist/` or `build/` folder to your hosting

**Option C: Git-based deployment**
- Push to GitHub (auto-deploy via Netlify/Vercel)

✅ **Verify:** Frontend loads without console errors

---

### STEP 8: Smoke Tests

#### Test 1: API Endpoints

```bash
# Get accounts (should work)
curl -X GET "https://your-staging-api.com/api/accounts" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check new endpoint exists (should return 401/403 if not authenticated)
curl -X POST "https://your-staging-api.com/api/accounts/test-id/delete" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### Test 2: Database

```sql
-- Verify audit_log table is empty (no operations yet)
SELECT COUNT(*) FROM audit_log;

-- Verify indexes exist
\di idx_accounts_deleted_at
\di idx_transactions_deleted_at
```

#### Test 3: Frontend

1. Open staging URL in browser
2. Open Developer Console (F12)
3. Check for JavaScript errors
4. Navigate to Accounts page
5. Verify no console errors

✅ **Expected:** No errors, page loads normally

---

## 🧪 FUNCTIONAL TESTING

### Test 1: Delete an Account

1. Log in to staging
2. Go to Accounts page
3. Click "Delete" on any test account
4. Select reason: "Customer requested cancellation"
5. Click "Confirm Delete"

**Expected:**
- ✅ Success toast appears
- ✅ Account disappears from list
- ✅ No errors in console

### Test 2: Show Deleted Accounts

1. Check the "Show deleted accounts" toggle
2. Deleted account should reappear
3. Should have gray/red background
4. Should show "Deleted" badge

**Expected:**
- ✅ Deleted account visible
- ✅ Different styling
- ✅ Shows deletion info

### Test 3: Restore Account

1. With "Show deleted" enabled
2. Click "Restore" on deleted account
3. Disable "Show deleted" toggle

**Expected:**
- ✅ Success toast appears
- ✅ Account returns to normal list
- ✅ No longer marked as deleted

### Test 4: Void Transaction

1. Go to Transactions page
2. Click "Void" on any test transaction
3. Read the warning carefully
4. Select reason: "Duplicate entry"
5. Click "Confirm Void"

**Expected:**
- ✅ Success toast appears
- ✅ Transaction disappears from list
- ✅ Revenue total updates (decreases)

### Test 5: Check Audit Log

```sql
-- View recent audit log entries
SELECT
  id,
  action,
  entity_type,
  entity_id,
  performed_by,
  performed_at,
  reason
FROM audit_log
ORDER BY performed_at DESC
LIMIT 10;
```

**Expected:**
- ✅ Entries for delete/restore operations
- ✅ Correct reasons recorded
- ✅ User IDs populated
- ✅ Timestamps accurate

### Test 6: Performance Check

1. Go to Accounts page
2. Note load time
3. Should be < 2 seconds for 1000+ accounts

**Check database query performance:**
```sql
EXPLAIN ANALYZE
SELECT * FROM accounts
WHERE organization_id = 'test-org-id'
AND deleted_at IS NULL
LIMIT 100;
```

**Expected:**
- ✅ Uses index scan
- ✅ Execution time < 50ms

---

## 🐛 TROUBLESHOOTING

### Issue: Migration fails with "relation already exists"

**Solution:** Migration was already run. Check:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'accounts' AND column_name = 'deleted_at';
```

If column exists, migration is already applied.

### Issue: Backend won't start after deployment

**Check logs:**
```bash
pm2 logs
# OR
journalctl -u uppal-crm -n 50
```

**Common causes:**
- Syntax error in controller (check logs)
- Missing module.exports (verify files)
- Port already in use (check PM2/systemd)

### Issue: Frontend shows "Cannot read property of undefined"

**Solution:** Clear browser cache and rebuild:
```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### Issue: Deleted accounts not appearing

**Check:**
1. Is `includeDeleted` parameter being sent?
2. Check Network tab in browser DevTools
3. Verify API response

### Issue: Audit log not recording

**Check trigger:**
```sql
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname LIKE '%soft_delete%';
```

Should show triggers as enabled.

---

## 📊 DEPLOYMENT CHECKLIST

Before marking as complete:

- [ ] ✅ Database backup created and verified
- [ ] ✅ Migration ran successfully
- [ ] ✅ Migration verification passed
- [ ] ✅ Backend code deployed
- [ ] ✅ Backend server restarted
- [ ] ✅ Frontend built and deployed
- [ ] ✅ Smoke tests passed
- [ ] ✅ Delete account test passed
- [ ] ✅ Restore account test passed
- [ ] ✅ Void transaction test passed
- [ ] ✅ Audit log verified
- [ ] ✅ Performance acceptable
- [ ] ✅ No console errors
- [ ] ✅ Team notified

---

## 🔄 ROLLBACK PROCEDURE

If something goes wrong:

### 1. Stop the Application

```bash
pm2 stop all
# OR
sudo systemctl stop uppal-crm
```

### 2. Restore Database

```bash
psql -h your-staging-host.com \
  -U your-db-user \
  -d uppal_crm_staging \
  < backup_staging_TIMESTAMP.sql
```

### 3. Revert Code

```bash
git revert HEAD
git push origin staging
```

### 4. Restart

```bash
pm2 restart all
```

---

## 📞 POST-DEPLOYMENT

### Monitor for 24 hours

- Check error logs every few hours
- Monitor database performance
- Watch for user-reported issues

### Notify Team

Send to team:
```
✅ Soft delete system deployed to STAGING

Features:
- Account soft delete/restore
- Transaction void/unvoid
- Complete audit trail
- Admin views for deleted records

Testing URL: https://staging.uppal-crm.com

Please test and report any issues.

Docs: SOFT_DELETE_IMPLEMENTATION.md
```

---

## ✅ READY FOR PRODUCTION?

After successful staging testing (24-48 hours), proceed to production:

1. Review staging test results
2. Create production deployment plan
3. Schedule production deployment (low-traffic time)
4. Follow same steps for production
5. Monitor closely for first week

---

**Deployment Date:** _________________
**Deployed By:** _________________
**Verified By:** _________________
**Production Ready:** [ ] Yes [ ] No

