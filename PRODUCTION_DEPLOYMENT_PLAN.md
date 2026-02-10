# Production Deployment Plan - Account Status Consolidation

**Date:** February 4, 2026
**Migration:** 020_consolidate_account_status.sql
**Affected:** Database schema + 5 service files
**Risk Level:** ⚠️ HIGH (Database schema change)

---

## Pre-Deployment Checklist

### Step 1: Database Backup ✅
**Status:** PENDING
- [ ] Production database backup initiated
- [ ] Backup verified and stored securely
- [ ] Backup size: ___ GB
- [ ] Backup location: Render PostgreSQL backup system
- [ ] Backup time: [will be recorded]

### Step 2: Code Deployment ✅
**Status:** READY
- [x] All fixes deployed to devtest ✅
- [x] All fixes deployed to staging ✅
- [ ] Merge staging → main
- [ ] Push to GitHub (triggers Render deployment)
- [ ] Render backend auto-rebuilds (~3-5 min)
- [ ] Render frontend auto-rebuilds (~3-5 min)

### Step 3: Database Migration ✅
**Status:** PENDING
- [ ] Connect to production database
- [ ] Run migration 020
- [ ] Verify migration success
- [ ] Check data integrity
- [ ] Verify no orphaned columns

### Step 4: Post-Deployment Testing ✅
**Status:** PENDING
- [ ] Dashboard KPIs load without errors
- [ ] Lead conversion works
- [ ] Account operations (delete/restore) work
- [ ] Reporting/analytics queries execute
- [ ] No schema errors in logs

### Step 5: Monitoring ✅
**Status:** PENDING
- [ ] Monitor Render logs for 30 minutes
- [ ] Check error rates
- [ ] Verify user activity
- [ ] Monitor database performance

---

## Deployment Timeline

| Phase | Step | Duration | Status |
|-------|------|----------|--------|
| Pre | Database Backup | 10-20 min | ⏳ PENDING |
| Deploy | Code merge to main | 1 min | ⏳ PENDING |
| Deploy | Render backend rebuild | 3-5 min | ⏳ PENDING |
| Deploy | Render frontend rebuild | 3-5 min | ⏳ PENDING |
| Migrate | Run database migration | 2-5 min | ⏳ PENDING |
| Verify | Post-deployment tests | 10-15 min | ⏳ PENDING |
| Monitor | Error monitoring | 30 min | ⏳ PENDING |
| **Total** | **Complete Deployment** | **60-90 min** | ⏳ PENDING |

---

## What's Being Deployed

### Database Changes
- Removed: `license_status`, `account_type`, `is_trial` columns
- Added: `account_status` column with values (active, on_hold, inactive, suspended, cancelled)
- Views dropped and recreated if needed

### Code Changes (5 files)
1. `services/queryBuilderService.js` - KPI queries
2. `services/reportingService.js` - Stats queries
3. `services/leadConversionService.js` - Account creation
4. `controllers/fieldMappingController.js` - Field mapping UI
5. `database/migrations/020_consolidate_account_status.sql` - Migration

---

## Rollback Plan

**If Critical Issues Occur:**

1. **Revert Code (2-5 min):**
   ```bash
   git revert 26c5a9f
   git push origin main
   # Render auto-redeploys old code
   ```

2. **Restore Database (10-30 min):**
   - Use Render PostgreSQL backup from pre-deployment
   - Point production database to backup
   - Verify data consistency

3. **Communication:**
   - Notify stakeholders of rollback
   - Post incident summary
   - Plan post-mortem

---

## Success Criteria

✅ All fixes deployed to production
✅ Database migration completed without errors
✅ No schema errors in application logs
✅ Dashboard KPIs load successfully
✅ Lead conversion works
✅ No orphaned column references
✅ Users can perform all account operations

---

## Sign-Off Required

- [ ] **Database Owner:** _________________ Date: _____
- [ ] **DevOps/Render Admin:** _________________ Date: _____
- [ ] **QA Lead:** _________________ Date: _____
- [ ] **Product Lead:** _________________ Date: _____
