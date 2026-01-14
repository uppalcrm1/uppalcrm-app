# UppalCRM Development & Release Workflow

## Overview
This document outlines the development and release process to ensure safe deployments and protect active production clients.

**Last Updated:** 2026-01-08

---

## 🏗️ Environment Structure

| Environment | Branch | Purpose | Database | URLs |
|-------------|--------|---------|----------|------|
| **Local** | feature/* | Development & testing | Local DB | localhost:3004 (backend), localhost:3001 (frontend) |
| **Staging** | `staging` | Pre-production testing | Staging DB | uppalcrm-api-staging.onrender.com, uppalcrm-frontend-staging.onrender.com |
| **Production** | `main` | Live client environment | Production DB | uppalcrm-api.onrender.com, uppalcrm-frontend.onrender.com |

---

## 🔄 Standard Development Workflow

### Phase 1: Local Development

```bash
# 1. Create feature branch from main
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 2. Develop and test locally
# - Use .env.local for local database
# - Test thoroughly on your machine
# - Run any automated tests if available

# 3. Commit changes with clear messages
git add .
git commit -m "Clear description of changes"
git push origin feature/your-feature-name
```

**Local Testing Checklist:**
- [ ] Feature works as expected
- [ ] No console errors
- [ ] No breaking changes to existing features
- [ ] Code follows existing patterns
- [ ] Database changes tested locally

---

### Phase 2: Staging Deployment

**CRITICAL: NEVER skip staging, even for "small" changes**

```bash
# 1. Merge feature to staging
git checkout staging
git pull origin staging
git merge main                      # Get latest main first
git merge feature/your-feature-name

# 2. Push to trigger automatic Render deployment
git push origin staging

# 3. Wait for Render to complete deployment
# Check: https://dashboard.render.com
```

**Staging Testing Checklist:**
- [ ] Test the specific feature/fix you developed
- [ ] Test related functionality that might be affected
- [ ] Test with different user roles (admin, regular user, platform admin)
- [ ] Test multi-tenant isolation (create/use test organizations)
- [ ] Check browser console for errors
- [ ] Check Render logs for server errors
- [ ] Test on mobile/tablet if UI changes
- [ ] Verify API endpoints work correctly
- [ ] Check database queries are efficient

**Staging Monitoring Periods:**
- **Database schema changes:** 24-48 hours
- **Core feature changes:** 4-24 hours
- **Bug fixes:** 2-4 hours
- **UI-only changes:** 1-2 hours
- **Configuration changes:** 1-2 hours

---

### Phase 3: Production Deployment

**Only proceed after staging success and monitoring period**

```bash
# 1. Merge staging to main
git checkout main
git pull origin main
git merge staging

# 2. Push to trigger production deployment
git push origin main

# 3. Render will automatically deploy to production
```

**Pre-Production Checklist:**
- [ ] ✅ Staging deployment successful
- [ ] ✅ Staging monitoring period completed
- [ ] ✅ No issues reported in staging
- [ ] Production database backup created (for DB changes)
- [ ] Deployment scheduled (during low-traffic time if major change)
- [ ] Team notified of deployment
- [ ] Rollback plan documented

**Immediate Post-Production Verification (First 5-10 minutes):**
- [ ] Backend health check: `https://uppalcrm-api.onrender.com/health`
- [ ] Frontend loads correctly
- [ ] Login works
- [ ] Test the specific feature deployed
- [ ] Check Render logs for errors
- [ ] No immediate customer complaints

**Production Monitoring Windows:**
- **Database changes:** 24 hours (monitor closely)
- **Core features:** 4-8 hours
- **Bug fixes:** 2-4 hours
- **UI changes:** 1-2 hours

---

## 🚨 Critical Rules

### Rule 1: NEVER Develop Directly on Main or Staging
- Always use feature branches
- Main = production (live clients)
- Staging = testing environment only

### Rule 2: ALWAYS Deploy to Staging First
- Even for "small" changes
- Even for "urgent" hotfixes
- No exceptions

### Rule 3: Database Changes Require Extra Care
```bash
# For database migrations:
# 1. Test migration script locally first
# 2. Deploy to STAGING database
# 3. Monitor staging for 24-48 hours
# 4. Backup PRODUCTION database before deployment
# 5. Deploy to PRODUCTION during low-traffic hours
# 6. Have rollback script ready
# 7. Monitor production closely for 24 hours
```

### Rule 4: Never Force Push to Main or Staging
```bash
# ❌ NEVER DO THIS
git push origin main --force
git push origin staging --force

# ✅ If you need to fix something, create a new commit
git revert <bad-commit-hash>
git push origin main
```

### Rule 5: Test Multi-Tenant Isolation
- Every change must be tested with multiple organizations
- Ensure data doesn't leak between tenants
- Verify organization-specific features work correctly

---

## 🔥 Emergency Hotfix Process

For critical production bugs affecting clients:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-description

# 2. Fix the bug
# - Make minimal changes
# - Test locally thoroughly

# 3. Deploy to staging FIRST (even for emergencies)
git checkout staging
git pull origin staging
git merge hotfix/critical-bug-description
git push origin staging

# 4. Quick but thorough staging test (30-60 minutes minimum)
# - Test the bug fix
# - Test related functionality
# - Check for side effects

# 5. Deploy to production
git checkout main
git pull origin main
git merge hotfix/critical-bug-description
git push origin main

# 6. Merge back to staging to keep in sync
git checkout staging
git pull origin staging
git merge main
git push origin staging

# 7. Delete hotfix branch after deployment
git branch -d hotfix/critical-bug-description
git push origin --delete hotfix/critical-bug-description
```

**Hotfix Checklist:**
- [ ] Bug confirmed and reproducible
- [ ] Impact assessed (how many clients affected?)
- [ ] Fix tested locally
- [ ] Fix tested on staging (minimum 30 minutes)
- [ ] Team notified of emergency deployment
- [ ] Deployed to production
- [ ] Verified fix in production
- [ ] Documented in deployment log

---

## 📋 Database Migration Process

Database changes are high-risk. Follow this process strictly:

### 1. Development Phase
```bash
# Create migration script
# Name it with timestamp and description
# Example: database/migrations/023_add_user_preferences.sql
```

### 2. Local Testing
```bash
# Test on local database
psql -U username -d uppal_crm < database/migrations/023_add_user_preferences.sql

# Verify migration succeeded
# Test application with new schema
```

### 3. Staging Deployment
```bash
# Deploy migration to staging
node scripts/migrate.js staging

# OR use deployment script if available
./deploy-migration-staging.sh
```

**Staging Migration Verification:**
- [ ] Migration script executed without errors
- [ ] Database schema updated correctly
- [ ] Existing data preserved
- [ ] Application works with new schema
- [ ] No performance degradation
- [ ] Multi-tenant data isolated correctly

**Staging Monitoring:** 24-48 hours minimum

### 4. Production Deployment
```bash
# BEFORE running migration:
# 1. Create database backup
# 2. Schedule during low-traffic window (if possible)
# 3. Notify team
# 4. Have rollback script ready

# Deploy to production
node scripts/production-migrate.js

# OR use deployment script
./deploy-migration-production.sh
```

**Production Migration Verification:**
- [ ] Backup created and verified
- [ ] Migration executed successfully
- [ ] No errors in logs
- [ ] Application starts correctly
- [ ] Test basic functionality immediately
- [ ] Monitor performance metrics
- [ ] Watch for customer-reported issues

### 5. Rollback Plan (If Migration Fails)

Create rollback script before deploying:
```sql
-- database/migrations/rollback/023_rollback_user_preferences.sql
BEGIN;

-- Reverse all changes made in migration 023
-- Drop new columns, tables, indexes, etc.
ALTER TABLE users DROP COLUMN IF EXISTS preferences;

COMMIT;
```

---

## 🔄 Rollback Procedures

### Code-Only Rollback (No Database Changes)

If production has issues but database is fine:

```bash
# Option 1: Revert the commit
git checkout main
git revert <bad-commit-hash>
git push origin main
# Render will automatically deploy

# Option 2: Deploy previous version
git log --oneline -10  # Find last good commit
git checkout <good-commit-hash>
git checkout -b rollback-temp
git push origin rollback-temp
# Manually trigger deploy from this branch in Render
```

### Database Rollback (If Migration Has Issues)

```bash
# 1. Rollback code first
git revert <migration-commit-hash>
git push origin main

# 2. Run rollback migration script
node scripts/rollback-migration.js 023

# 3. Verify rollback
# - Check database schema
# - Test application
# - Review logs
```

### Full System Rollback (Worst Case)

```bash
# 1. Identify last known good state
git log --oneline -20

# 2. If database was changed, restore from backup
# Contact database admin or use backup tools

# 3. Rollback code to last good commit
git reset --hard <last-good-commit>
git push origin main --force-with-lease

# 4. Verify system is working
# 5. Investigate what went wrong
# 6. Document incident
```

---

## 📊 Change Risk Assessment

Before deploying, assess the risk level:

### 🟢 Low Risk
- UI text changes
- CSS/styling updates
- Frontend-only changes (no API changes)
- Documentation updates
- Minor bug fixes (no data changes)

**Process:** Standard workflow, 1-2 hour staging test

### 🟡 Medium Risk
- New features (no database changes)
- API endpoint changes
- Authentication/authorization logic
- Multi-file refactoring
- Third-party integration changes

**Process:** Standard workflow, 4-8 hour staging test, monitor production closely

### 🔴 High Risk
- Database schema changes
- Migration scripts
- Core business logic changes
- Multi-tenant isolation changes
- Payment/billing logic
- Data import/export features
- Batch operations on existing data

**Process:**
- Extended testing (24-48 hours staging)
- Database backup required
- Deploy during low-traffic window
- Team on standby
- 24-hour production monitoring
- Rollback plan tested and ready

---

## 📞 Deployment Communication

### Before Major Deployments
- Notify team in Slack/Email
- Include: What's being deployed, when, expected impact
- Ensure team availability during deployment window

### During Deployment
- Update status in team channel
- Report any issues immediately

### After Deployment
- Confirm success or report issues
- Document any problems encountered
- Update deployment log

---

## 📝 Deployment Log

Keep a simple log in `DEPLOYMENT_LOG.md`:

```markdown
## 2026-01-08 - Feature: User Password Reset
- **Deployed by:** Your Name
- **Type:** Medium Risk - New Feature
- **Staging tested:** 4 hours, no issues found
- **Production deployed:** 3:00 PM PST
- **Verification:** All tests passed
- **Status:** ✅ Success
- **Issues:** None
- **Rollback:** Not needed

## 2026-01-05 - Database: Add Custom Fields to Contacts
- **Deployed by:** Your Name
- **Type:** High Risk - Database Schema Change
- **Staging tested:** 48 hours, no issues
- **Production backup:** Created at 2:00 PM
- **Production deployed:** 2:30 PM PST (low traffic time)
- **Verification:** Migration successful, app working
- **Status:** ✅ Success
- **Monitoring:** 24-hour watch active
- **Issues:** None reported
```

---

## 🛠️ Helpful Scripts to Create

### 1. Pre-Deployment Checklist Script

Create `scripts/pre-deploy-check.sh`:
```bash
#!/bin/bash
echo "🔍 Pre-Deployment Checklist"
echo ""
echo "[ ] Tested locally?"
echo "[ ] Tested on staging?"
echo "[ ] Staging monitoring period completed?"
echo "[ ] Database migrations tested (if applicable)?"
echo "[ ] Environment variables updated (if needed)?"
echo "[ ] Breaking changes documented?"
echo "[ ] Rollback plan ready?"
echo "[ ] Team notified?"
echo "[ ] Backup created (if database changes)?"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi
```

### 2. Health Check Script

Create `scripts/health-check.sh`:
```bash
#!/bin/bash
echo "🏥 Health Check"
echo ""

# Backend health
echo "Checking backend..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://uppalcrm-api.onrender.com/health)
if [ $BACKEND_STATUS -eq 200 ]; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend returned status: $BACKEND_STATUS"
fi

# Frontend health
echo "Checking frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://uppalcrm-frontend.onrender.com)
if [ $FRONTEND_STATUS -eq 200 ]; then
    echo "✅ Frontend is healthy"
else
    echo "❌ Frontend returned status: $FRONTEND_STATUS"
fi
```

### 3. Staging Data Refresh Script

Create `scripts/refresh-staging-from-production.sh`:
```bash
#!/bin/bash
# Refresh staging database with anonymized production data
# Run weekly to test with realistic data

echo "⚠️  This will replace staging database with production data"
echo "Production data will be anonymized (emails, names, phone numbers)"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Add your database copy and anonymization logic here
```

---

## 🎯 Best Practices Summary

1. **Always use feature branches** - Never commit directly to main or staging
2. **Test locally first** - Don't use staging as your testing ground
3. **Always deploy to staging** - No exceptions, even for hotfixes
4. **Monitor appropriately** - Bigger changes = longer monitoring
5. **Backup before database changes** - Always
6. **Deploy during low-traffic times** - For high-risk changes
7. **Have rollback plans ready** - Test them before you need them
8. **Communicate deployments** - Keep team informed
9. **Document everything** - Deployment logs help future you
10. **When in doubt, test more** - Better safe than sorry with active clients

---

## 📚 Related Documentation

- `DEPLOYMENT.md` - General deployment guide
- `DEPLOYMENT_GUIDE.md` - Detailed deployment procedures
- `DEPLOYMENT-CHECKLIST.md` - Render deployment checklist
- `STAGING_DEPLOYMENT_CHECKLIST.md` - Staging-specific checklist
- `PRODUCTION_DEPLOYMENT.md` - Production deployment guide
- `render.yaml` - Render configuration
- `scripts/deploy.sh` - Automated deployment script

---

## 🆘 Troubleshooting

### Deployment Failed on Render
1. Check Render dashboard logs
2. Verify build command succeeded
3. Check environment variables are set
4. Verify start command is correct
5. Check for dependency issues

### Staging Tests Failing
1. Check Render logs for errors
2. Verify database migrations ran
3. Check environment variables
4. Compare with local environment
5. Test API endpoints directly

### Production Issues After Deployment
1. Check Render logs immediately
2. Compare with staging environment
3. Verify environment variables match
4. Check database connectivity
5. Consider immediate rollback if critical
6. Document issue for post-mortem

### Database Migration Failed
1. Check migration script syntax
2. Verify database connection
3. Check for conflicting constraints
4. Review transaction rollback
5. Restore from backup if needed
6. Fix migration script and retry

---

**Remember:** Your clients depend on the stability of production. Taking time to test properly in staging always saves time compared to fixing production issues.
