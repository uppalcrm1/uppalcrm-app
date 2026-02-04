# Account Status Consolidation - Testing Plan

## Pre-Migration Verification

Before running the migration, verify the current database state:

```sql
-- Check current accounts table structure
\d accounts

-- Sample data to verify mapping will work
SELECT id, account_name, account_type, license_status, is_trial
FROM accounts
LIMIT 5;

-- Count of each status before migration
SELECT account_type, license_status, is_trial, COUNT(*)
FROM accounts
GROUP BY account_type, license_status, is_trial;
```

## Migration Execution

### Step 1: Run the Migration
```bash
cd database/migrations
node ../../database/migrationRunner.js
# Or if you have npm scripts:
npm run migrate
```

### Step 2: Verify Migration Success
```sql
-- Check new column exists
\d accounts

-- Verify data migration
SELECT id, account_name, account_status, COUNT(*)
FROM accounts
GROUP BY account_status, id, account_name
ORDER BY account_status;

-- Check specific mappings
SELECT account_name, account_status
FROM accounts
WHERE account_status = 'on_hold'
LIMIT 5;  -- Should show accounts that were 'pending'

SELECT account_name, account_status
FROM accounts
WHERE account_status = 'inactive'
LIMIT 5;  -- Should show accounts that were 'expired'

-- Verify old columns are gone
SELECT * FROM accounts LIMIT 0;  -- Check column list
```

## Backend API Testing

### Test 1: Create Account
**Endpoint:** POST /api/accounts
**Request Body:**
```json
{
  "contact_id": "uuid-here",
  "account_name": "Test Account",
  "edition": "Gold",
  "device_name": "Test Device",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "term": "1",
  "price": "50",
  "account_status": "active",
  "notes": "Test account"
}
```
**Expected Result:**
- Account created successfully
- Response includes `account_status: "active"`
- No `account_type` or `license_status` in response

### Test 2: Get Accounts
**Endpoint:** GET /api/accounts?status=active
**Expected Result:**
- Returns only accounts with `account_status: "active"`
- All accounts have `account_status` field
- No `account_type` or `license_status` fields

### Test 3: Get Account Stats
**Endpoint:** GET /api/accounts/stats
**Expected Result:**
```json
{
  "success": true,
  "stats": {
    "total_accounts": N,
    "active_accounts": M,
    "trial_accounts": K,  // Counts on_hold status
    "total_revenue": $
  }
}
```

### Test 4: Update Account
**Endpoint:** PUT /api/accounts/:id
**Request Body:**
```json
{
  "account_status": "suspended"
}
```
**Expected Result:**
- Account status updated successfully
- Response includes updated `account_status: "suspended"`

### Test 5: Soft Delete Account
**Endpoint:** POST /api/accounts/:id/delete
**Request Body:**
```json
{
  "reason": "Customer requested cancellation"
}
```
**Expected Result:**
- Account deleted successfully
- `deleted_at` timestamp set
- `account_status` set to "cancelled"

### Test 6: Restore Account
**Endpoint:** POST /api/accounts/:id/restore
**Expected Result:**
- Account restored successfully
- `deleted_at` cleared
- `account_status` set to "active"

## Frontend UI Testing

### Test 1: Create Account Modal
**Steps:**
1. Navigate to Contacts page
2. Click on a contact
3. Open "Create Account" modal
4. Fill in form fields

**Verify:**
- [ ] Only "Account Status" dropdown appears (not "License Status" or "Account Type")
- [ ] No "Is Trial" checkbox is visible
- [ ] Account Status options are: Active, Inactive, Suspended, Cancelled, On Hold
- [ ] Default value is "Active"
- [ ] Form submits successfully
- [ ] Account created with correct status

### Test 2: Edit Account Modal
**Steps:**
1. Navigate to Accounts page
2. Click on an account
3. Click "Edit Account" button

**Verify:**
- [ ] Account Status field pre-populates with current status
- [ ] Dropdown shows all 5 status options
- [ ] Can change status
- [ ] Form submits successfully

### Test 3: Account Detail Page
**Steps:**
1. Navigate to Accounts page
2. Click on an account

**Verify:**
- [ ] Status badge shows correctly (no Account Type field below)
- [ ] Color matches status:
  - Green for "Active"
  - Gray for "Inactive"
  - Yellow for "On Hold"
  - Orange for "Suspended"
  - Red for "Cancelled"
- [ ] Related accounts section shows account_status (not license_status)
- [ ] Delete and Restore buttons work correctly

### Test 4: Accounts List Page
**Steps:**
1. Navigate to Accounts page

**Verify:**
- [ ] Status filter dropdown shows:
  - All
  - Active
  - Inactive
  - Suspended
  - Cancelled
  - On Hold
- [ ] Filtering works for each status
- [ ] Accounts display correct status values

### Test 5: Contact Account Management
**Steps:**
1. Navigate to Contacts page
2. Click on a contact
3. Scroll to "Software Accounts" section

**Verify:**
- [ ] No Account Type displayed
- [ ] Status badge shows with correct color
- [ ] Create Account modal works
- [ ] Edit Account modal works

## Data Validation Tests

### Test 1: Status Values
Run this query after migration:
```sql
SELECT DISTINCT account_status FROM accounts;
-- Should only return: active, inactive, suspended, cancelled, on_hold
```

### Test 2: No NULL Values
```sql
SELECT COUNT(*) FROM accounts WHERE account_status IS NULL;
-- Should return 0
```

### Test 3: Deleted Accounts
```sql
SELECT account_status, COUNT(*)
FROM accounts
WHERE deleted_at IS NOT NULL
GROUP BY account_status;
-- All deleted accounts should have status = 'cancelled'
```

### Test 4: Non-Deleted Accounts
```sql
SELECT COUNT(*)
FROM accounts
WHERE deleted_at IS NOT NULL AND account_status != 'cancelled';
-- Should return 0
```

## Regression Testing

### Test 1: Transactions Still Work
- Create a new account
- Create a transaction for it
- Verify next_renewal_date updates correctly

### Test 2: Account History
- Create account
- Update account status
- Verify changes appear in audit log/history

### Test 3: Lead Conversion
- Create a lead
- Convert to account
- Verify new account has correct status

### Test 4: Contact-Account Relationships
- Create multiple accounts for one contact
- Verify all accounts display correctly
- Verify filtering works across all accounts

## Rollback Plan (If Needed)

If critical issues are found:

1. Stop application
2. Restore database from backup
3. Revert code changes using git
4. Address issues
5. Re-deploy

```bash
# Code rollback
git revert <commit-hash>  # Or git checkout <original-branch>

# Database rollback (if backup available)
pg_restore -d crm_db /path/to/backup.sql
```

## Success Criteria

✅ All tests pass:
- [ ] Database migration completes without errors
- [ ] All 6 backend API tests pass
- [ ] All 5 frontend UI tests pass
- [ ] All 4 data validation tests pass
- [ ] All 4 regression tests pass
- [ ] No console errors in browser
- [ ] No server errors in logs
- [ ] Performance is acceptable (no noticeable slowdown)

## Known Limitations

None identified - this is a data consolidation refactor with no functional changes.

## Post-Deployment Monitoring

- Monitor API response times (should be same or better)
- Monitor database query times (should be same or better)
- Monitor error logs for any exceptions
- Get user feedback on UI/UX
- Track any issues reported
