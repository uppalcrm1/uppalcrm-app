# Super Admin Panel Guide

## Overview
The Super Admin panel is your control center for managing all organizations in the CRM platform.

## Current Database State (After Fixes)

### Organizations: 1 Total
- **Uppal Solutions Ltd** (uppal-solutions)
  - Status: TRIAL (is_trial=true)
  - Users: 2/10 active users
  - Trial expires: October 29, 2025 (30 days from creation)
  - Created: September 29, 2025

### Trial Signups: 4 Total
1. **Uppal Solutions Ltd** - admin@uppalsolutions.com (STATUS: converted/provisioned ✅ LINKED)
2. TechCorp Solutions - john.smith@techcorp.com (STATUS: pending ⏳ NOT LINKED)
3. InnovatePlus - sarah@innovateplus.com (STATUS: pending ⏳ NOT LINKED)
4. Growth Ventures - mike@growthventures.com (STATUS: pending ⏳ NOT LINKED)

---

## What You Should See in Each Tab

### 1. Dashboard (`/super-admin/dashboard`)

**Stats Overview:**
- Total Signups: 4
- Active Organizations: 1
- Trial Signups Provisioned: 1
- Pending Reviews: 3

**Trial Status Breakdown:**
- Pending: 3
- Contacted: 0
- Provisioned: 1 (Uppal Solutions Ltd)
- Rejected: 0
- Provision Rate: 25%

**Quick Stats:**
- Trial Organizations: 1
- Paid Organizations: 0

**Recent Signups:**
- Shows the 5 most recent trial signups

---

### 2. Trial Signups Tab (`/super-admin/signups`)

**Purpose:** Manage ALL organizations until they become paid

**What You See:**
- **Uppal Solutions Ltd** - Status: Provisioned
  - Shows trial expiry countdown (26 days remaining)
  - Button: **"Upgrade to Paid"** (green)
  - Button: "Extend +30 Days" (blue)
  - Trial info banner showing expiration date

- **TechCorp Solutions, InnovatePlus, Growth Ventures** - Status: Pending
  - Buttons to change status: Pending → Contacted → Provisioned
  - "Convert to Org" button to provision them as trial orgs

**Actions Available:**
- Change signup status (Pending/Contacted/Qualified/Provisioned/Rejected)
- Provision trial org (creates organization from signup)
- Extend trial period (+30 days)
- **Upgrade to Paid** (moves org to Organizations tab)
- View contact info and notes

---

### 3. Organizations Tab (`/super-admin/organizations`)

**Purpose:** Show ONLY paid organizations

**What You See:**
- **Currently EMPTY**
- Message: "No paid organizations yet. Trial organizations appear in the Trial Signups tab until upgraded to paid"

**Stats Shown:**
- Total Paid Organizations: 0
- Active Paid Orgs: 0
- Total Users: 0

**After Upgrading "Uppal Solutions Ltd":**
- Will show 1 organization card
- Badge: **PAID** (green)
- Users: 2 / 10
- **Eye icon** button → View Details
- Trash icon → Delete org

---

### 4. Organization Detail Page (`/super-admin/organizations/:id`)

**Access:** Click eye icon on any paid organization

**What Shows:**

#### Header
- Organization name
- Back button
- **PAID** badge (or TRIAL badge if accessed from trial org)

#### Subscription Overview
- Status: Active Subscription
- Monthly Price: $150/month (10 users × $15)
- Full access enabled

#### Pricing Breakdown
- Price per user: $15/month
- Number of users: 10 users
- Total Monthly Cost: $150
- Payment Method: Manual Payment (Invoice)
- Current Period Start: (date)
- Current Period End: (date)

#### Current Usage (with progress bars)
- **Active Users:** 2 of 10 (20% used)
- **Contacts:** 0 (Unlimited)
- **Leads:** 0 (Unlimited)
- **Storage:** - (Unlimited)

#### Organization Information
- Organization Slug: uppal-solutions
- Domain: (if set)
- Created At: Sep 29, 2025
- Last Updated: Sep 29, 2025

#### Admin Users
- List of all admin users with:
  - Name and email
  - Created date
  - Last login time

---

## Workflows

### Workflow 1: New Trial Signup → Provisioned Trial Org

1. Someone fills out trial signup form
2. Appears in **Trial Signups** tab with status "Pending"
3. Super Admin changes status: Pending → Contacted → Qualified
4. Super Admin clicks **"Convert to Org"**
5. System creates trial organization automatically
6. Status changes to "Provisioned"
7. Stays in **Trial Signups** tab (still a trial!)
8. Shows trial expiry countdown and extend button

### Workflow 2: Trial → Paid Conversion

1. Trial org appears in **Trial Signups** tab
2. Super Admin clicks **"Upgrade to Paid"** button
3. System sets is_trial=false
4. Org DISAPPEARS from **Trial Signups** tab
5. Org APPEARS in **Organizations (Paid)** tab
6. Can now click eye icon to view detailed billing info

### Workflow 3: Extend Trial Period

1. Find provisioned trial in **Trial Signups** tab
2. Click **"Extend +30 Days"** button
3. Trial expiration date extends by 30 days
4. Trial countdown updates

---

## Data Consistency Rules

✅ **Trial Organizations (is_trial=true):**
- Appear ONLY in Trial Signups tab
- Have trial_status = 'active' or 'expired'
- Have trial_expires_at date set
- Must have linked trial_signup record

✅ **Paid Organizations (is_trial=false):**
- Appear ONLY in Organizations tab
- Have trial_status = NULL
- No trial_expires_at
- May or may not have trial_signup record (historical)

---

## Maintenance Scripts

### Check Organization Count
```bash
node scripts/check-organizations.js
```
Shows all orgs with their status, trial info, user counts.

### Audit Data Consistency
```bash
node scripts/audit-and-fix-data.js
```
Interactive tool to:
- Find orphaned orgs (no trial signup)
- Find inconsistent trial flags
- Choose fix strategy (A/B/C/D/E)
- Apply fixes automatically

### Fix Specific Issues
```bash
node scripts/fix-orphaned-org.js
```
Creates missing trial_signup for "Uppal Solutions Ltd"

### Run Trial Columns Migration
```bash
node scripts/run-trial-migration.js
```
Adds is_trial, trial_status, trial_expires_at columns if missing.

---

## Troubleshooting

### Issue: Dashboard shows different count than Trial Signups
**Solution:** Run `node scripts/audit-and-fix-data.js` and check for orphaned orgs

### Issue: Organization appears in both tabs
**Solution:** Check is_trial flag. Backend filters by is_trial=false for paid orgs.

### Issue: Trial org shows as PAID
**Solution:** Check subscription_plan field. Should be 'trial' not 'STARTER' or 'free'.

### Issue: 500 error on org detail page
**Solution:** Run `node scripts/run-trial-migration.js` to ensure all trial columns exist.

---

## Production Deployment Checklist

Before deploying to production:

1. ✅ Run trial columns migration on production DB:
   ```bash
   node scripts/run-trial-migration.js
   ```

2. ✅ Audit existing data:
   ```bash
   node scripts/audit-and-fix-data.js
   ```

3. ✅ Choose fix option (recommend Option D: Smart Fix)

4. ✅ Verify all pages load:
   - Dashboard shows correct stats
   - Trial Signups shows all trial orgs
   - Organizations shows only paid orgs
   - Org detail page works without errors

5. ✅ Test workflow:
   - Create test trial signup
   - Provision it to trial org
   - Verify appears in Trial Signups
   - Upgrade to paid
   - Verify moves to Organizations
   - Click eye icon to view details

---

## Current Status Summary

**Local Database (After All Fixes):**
- ✅ All trial columns added (is_trial, trial_status, trial_expires_at)
- ✅ "Uppal Solutions Ltd" properly configured as trial
- ✅ Trial signup record created and linked
- ✅ Data consistency achieved

**What You'll See:**
- Dashboard: 1 trial org, 4 signups, 1 provisioned
- Trial Signups: 4 signups (1 provisioned, 3 pending)
- Organizations: 0 (empty until you upgrade Uppal Solutions to paid)

**Next Steps:**
1. Deploy migration to production
2. Run audit script on production
3. Fix any production inconsistencies
4. Test all workflows end-to-end
