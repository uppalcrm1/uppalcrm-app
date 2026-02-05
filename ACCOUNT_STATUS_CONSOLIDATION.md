# Account Status Consolidation - Implementation Summary

## Overview
Consolidated three fields (`account_type`, `license_status`, `is_trial`) and replaced them with a single `account_status` field with values: `active`, `inactive`, `suspended`, `cancelled`, `on_hold`.

## Database Changes

### Migration File
- **Location:** `database/migrations/020_consolidate_account_status.sql`
- **Actions:**
  1. Added new `account_status` column with default 'active'
  2. Migrated data:
     - `license_status: 'pending'` → `account_status: 'on_hold'`
     - `license_status: 'expired'` → `account_status: 'inactive'`
     - `license_status: 'active'/'suspended'/'cancelled'` → stays same
     - Deleted accounts → `account_status: 'cancelled'`
  3. Dropped `license_status`, `account_type`, `is_trial` columns
  4. Dropped old indexes: `idx_accounts_license_status`, `idx_accounts_account_type`
  5. Created new index: `idx_accounts_account_status`

### To Run Migration
```bash
cd database/migrations
node ../../database/migrationRunner.js  # or npm run migrate
```

## Backend Changes

### Account Controller (`backend/controllers/accountController.js`)
- **softDeleteAccount:** Changed `account_type = 'cancelled'` → `account_status = 'cancelled'`
- **restoreAccount:** Changed `account_type = 'active'` → `account_status = 'active'`
- **getAccounts:** Updated status filter from `account_type` → `account_status`
- **Removed:** `account_type` from SELECT queries (no longer used)

### Routes (`routes/accounts-simple.js`)
- **GET /api/accounts:** Updated filter to use `account_status`
- **GET /api/accounts/stats:**
  - Changed counts: `account_type = 'active'/'trial'` → `account_status = 'active'/'on_hold'`
  - Removed `is_trial` count, renamed `trial_accounts` to count `on_hold` status
- **GET /api/accounts/:id/detail:** Updated related accounts query to select `account_status`
- **POST /api/accounts:**
  - Removed `account_type` and `is_trial` from destructuring
  - Changed `license_status` → `account_status`
  - Updated INSERT statement (2 fewer columns, 1 fewer parameter)
- **PUT /api/accounts/:id:**
  - Updated `allowedFields`: removed `license_status`, `account_type`, `is_trial`
  - Added `account_status`

### Routes (`routes/contacts.js`)
- **Joi validation (createAccount):**
  - Removed `account_type` validation rule
  - Changed `status` to `account_status` with valid values: active, inactive, suspended, cancelled, on_hold
- **Lead-to-account INSERT (lines 774-793):**
  - Removed `account_type` and `license_status` parameters
  - Added `account_status` parameter (set to 'active')
  - Reduced column count from 10 to 8, parameter count from $10 to $9
- **Quick-create accountInfo:**
  - Replaced `account_type: 'business', status: 'active'` with `account_status: 'active'`

### Routes (`routes/leads.js`)
- **Response mapping (line 2490):**
  - Changed `accountType: account.account_type` → `accountStatus: account.account_status`
  - Removed `isTrial: account.is_trial` from response

## Frontend Changes

### CreateAccountModal.jsx
- **Form state:**
  - Removed `account_type`, `is_trial`
  - Changed `license_status: 'pending'` → `account_status: 'active'`
- **Submission payload:** Only includes `account_status` (no separate fields)
- **Status dropdown (lines 481-512):**
  - Changed label: "License Status" → "Account Status"
  - Changed options: Active, Inactive, Suspended, Cancelled, On Hold
  - Removed "Is Trial" checkbox entirely

### EditAccountModal.jsx
- **Form state:**
  - Removed `is_trial`
  - Changed `license_status` → `account_status`
- **Pre-population:** Updated to use `account.account_status`
- **Submission payload:** Sends `account_status` instead of `license_status` and `is_trial`
- **Status dropdown:** Same updates as CreateAccountModal
- **Removed:** Is Trial checkbox block

### AccountDetailsPanel.jsx
- **Status display:** Changed from `account.license_status` → `account.account_status`
- **Removed:** Entire Account Type block (lines 36-41)

### AccountDetail.jsx
- **getStatusColor function:** Now handles all 5 statuses with distinct colors:
  - `active` → green
  - `inactive` → gray
  - `on_hold` → yellow
  - `suspended` → orange
  - `cancelled` → red
- **Badge display:** Changed `license_status` → `account_status`
- **Related accounts:** Updated field reference from `license_status` → `account_status`

### AccountsPage.jsx
- **STATUS_OPTIONS (lines 65-71):** Updated to:
  - All (empty string)
  - Active
  - Inactive
  - Suspended
  - Cancelled
  - On Hold
- **Filter logic:** Changed `account.status` → `account.account_status`

### AccountManagement.jsx
- **Removed:** `ACCOUNT_TYPES` constant entirely
- **Updated:** `ACCOUNT_STATUSES` constant to include cancelled and on_hold
- **Account card (line 108):** Removed display of `account.account_type`
- **Status badge:** Changed `account.status` → `account.account_status`
- **CreateAccountModal form:**
  - Removed `account_type` dropdown
  - Changed `defaultValues.status` → `defaultValues.account_status`
  - Updated `account_status` dropdown with all 5 status options

## Verification Checklist

- [ ] Run migration: `node database/migrationRunner.js`
- [ ] Verify columns dropped and `account_status` added
- [ ] Verify data migration: Check sample accounts for correct status mapping
- [ ] Backend test: Create new account via POST /api/accounts
- [ ] Backend test: Update account via PUT /api/accounts/:id
- [ ] Backend test: Soft delete account via POST /api/accounts/:id/delete
- [ ] Backend test: Restore account via POST /api/accounts/:id/restore
- [ ] Frontend test: Create new account in UI
  - Verify only "Account Status" dropdown appears
  - Verify no "Is Trial" checkbox
  - Verify no "Account Type" field
- [ ] Frontend test: Edit existing account
  - Verify Account Status pre-populates correctly
  - Verify form submission works
- [ ] Frontend test: View AccountDetail page
  - Verify single status badge
  - Verify no separate Account Type field
  - Verify correct color based on status
- [ ] Frontend test: AccountsPage filter
  - Verify dropdown shows new status values
  - Verify filtering works correctly
- [ ] Frontend test: Soft delete and restore
  - Verify status changes to "cancelled" on delete
  - Verify status changes to "active" on restore

## Data Values Mapping (Old → New)

| Old Field | Old Value | New Field | New Value |
|-----------|-----------|-----------|-----------|
| account_type | active | account_status | active |
| account_type | trial | account_status | on_hold |
| account_type | cancelled | account_status | cancelled |
| license_status | pending | account_status | on_hold |
| license_status | active | account_status | active |
| license_status | suspended | account_status | suspended |
| license_status | expired | account_status | inactive |
| license_status | cancelled | account_status | cancelled |
| is_trial | true/false | (removed) | (mapped to on_hold via account_type) |
| (soft deleted) | - | account_status | cancelled |

## Key Design Decisions

1. **Single Source of Truth:** Using one field eliminates confusion and ensures consistent status tracking
2. **Five Statuses:** Cover all use cases: active (running), on_hold (trial/pending), inactive (expired), suspended (paused), cancelled (deleted)
3. **Data Preservation:** Migration preserves all historical data with logical mappings
4. **Index Optimization:** Dropped unused indexes, added index on frequently-filtered field
5. **API Consistency:** All endpoints now use `account_status` for filtering and response data

## Notes

- The `billing_term_months` field is unchanged and continues to track billing periods
- The `next_renewal_date` field is unchanged and continues to store renewal dates
- Soft delete functionality works the same way, but uses `account_status = 'cancelled'` instead of account_type
- All timestamps (`created_at`, `updated_at`, `deleted_at`) remain unchanged
