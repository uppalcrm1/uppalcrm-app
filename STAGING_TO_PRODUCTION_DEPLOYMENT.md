# 🚀 Staging to Production Deployment - Billing Term Standardization

## Overview
This document outlines the changes ready to be deployed from staging to production.

## Changes Summary

### Commits to Deploy (2 commits)
1. **9342866** - feat: Standardize billing term field across all components
2. **cfe7ffd** - fix: Update 'Billing Term' labels to 'Term' for consistency

### Files Changed (8 files, +128/-100 lines)
- `database/migrations/015_add_billing_term_months.sql`
- `frontend/src/components/CreateAccountModal.jsx`
- `frontend/src/components/CreateTransactionModal.jsx`
- `frontend/src/components/EditTransactionModal.jsx`
- `frontend/src/components/LeadConversionModal.jsx`
- `routes/accounts-simple.js`
- `routes/customFields.js`
- `routes/leads.js`

## What's Being Deployed

### Frontend Changes
- **CreateAccountModal.jsx**: Updated billing term field display
- **CreateTransactionModal.jsx**: Changed "Billing Term" label to "Term"
- **EditTransactionModal.jsx**: Changed "Billing Term" label to "Term"
- **LeadConversionModal.jsx**: Standardized billing term handling

### Backend Changes
- **routes/accounts-simple.js**: Updated billing term processing
- **routes/leads.js**: Updated lead conversion with billing term handling
- **routes/customFields.js**: 
  - Updated field label from "Billing Term" to "Term"
  - Added missing '24' (Biennial) option to term field options

### Database Changes
- **015_add_billing_term_months.sql**: Migration updates for billing term field

## Deployment Steps

### Option 1: Using Deployment Script (Recommended)

```bash
cd /home/runner/work/uppalcrm-app/uppalcrm-app
./scripts/deploy.sh production
```

The script will:
1. Prompt for confirmation (safety check)
2. Checkout main branch
3. Pull latest from main
4. Merge staging into main
5. Push to main (triggers automatic deployment)

### Option 2: Manual Deployment

```bash
# 1. Switch to main branch
git checkout main

# 2. Pull latest changes
git pull origin main

# 3. Merge staging into main
git merge staging --no-edit

# 4. Push to production
git push origin main
```

## Pre-Deployment Checklist

- [ ] Staging has been tested thoroughly
- [ ] All functionality works as expected on staging
- [ ] No breaking changes identified
- [ ] Database migrations (if any) have been reviewed
- [ ] Backup of production database is available (if needed)

## Post-Deployment Verification

After deployment, verify:

1. **Frontend Changes**
   - [ ] Visit https://uppalcrm-frontend.onrender.com
   - [ ] Check CreateTransactionModal - label shows "Term" not "Billing Term"
   - [ ] Check EditTransactionModal - label shows "Term" not "Billing Term"
   - [ ] Verify "24" (Biennial) option appears in term dropdown
   - [ ] Test lead conversion with billing term selection

2. **Backend Changes**
   - [ ] Test account creation with billing term
   - [ ] Test transaction creation with term field
   - [ ] Test lead conversion with term field
   - [ ] Verify custom fields API returns correct term options

3. **General Health**
   - [ ] Check application logs for errors
   - [ ] Verify all pages load correctly
   - [ ] Test critical user flows

## Rollback Plan

If issues occur after deployment:

```bash
# Find the last good commit before the merge
git log --oneline -5

# Reset to the commit before the merge
git reset --hard <commit-before-merge>

# Force push (use with caution)
git push origin main --force-with-lease
```

## Environment Details

| Environment | Branch | URL |
|-------------|--------|-----|
| **Staging** | `staging` | https://uppalcrm-frontend-staging.onrender.com |
| **Production** | `main` | https://uppalcrm-frontend.onrender.com |

## Expected Impact

- **User-Facing**: Minor UI label change from "Billing Term" to "Term"
- **Functionality**: No breaking changes - same functionality, clearer naming
- **Performance**: No performance impact expected
- **Database**: Minor schema update (if migration runs)

## Support

If you encounter any issues during deployment:
1. Check the deployment logs in Render dashboard
2. Verify all environment variables are correctly set
3. Review application logs for errors
4. Contact development team if rollback is needed

---

**Status**: Ready for Production Deployment ✅  
**Risk Level**: Low  
**Estimated Deployment Time**: 2-3 minutes  
**Estimated Testing Time**: 10-15 minutes
