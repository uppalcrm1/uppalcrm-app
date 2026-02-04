# Software Licenses to Accounts Migration - Complete Guide

## Overview

This document provides comprehensive instructions for executing the migration that renames the `software_licenses` table to `accounts` in the uppalcrm_devtest database.

## Prerequisites

1. PostgreSQL client (`psql`) installed on your system
2. Network access to the devtest database:
   - Host: `dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com`
   - Port: `5432`
   - Database: `uppalcrm_devtest`
   - User: `uppalcrm_devtest`
   - Password: `YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs`

## Files Provided

1. **migration_software_licenses_to_accounts_v2.sql** - The main migration script
   - Pre-flight validation checks
   - Backup creation
   - Foreign key management
   - Table rename
   - Index updates
   - Trigger/policy updates
   - Post-migration validation

2. **test_migration_comprehensive.sh** - Bash test suite (for Linux/Mac)

3. **test_migration.bat** - Windows batch test suite

4. **execute_migration.py** - Python-based comprehensive test runner

## Step-by-Step Migration Process

### Step 1: Pre-Migration Inspection

Run these SQL commands to check the current state:

```sql
-- Check if software_licenses table exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'software_licenses'
) as "software_licenses_exists";

-- Check if accounts table already exists
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
) as "accounts_exists";

-- Count records in software_licenses
SELECT COUNT(*) as "record_count" FROM public.software_licenses;

-- List foreign keys referencing software_licenses
SELECT
    constraint_name,
    table_name,
    column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
ORDER BY constraint_name;

-- List indexes
SELECT
    indexname
FROM pg_indexes
WHERE tablename = 'software_licenses' AND schemaname = 'public'
ORDER BY indexname;

-- Check RLS policies
SELECT policyname FROM pg_policies
WHERE tablename = 'software_licenses' AND schemaname = 'public';

-- Check triggers
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'software_licenses';
```

### Step 2: Execute the Migration Script

Connect to the devtest database and run the migration script:

#### Option A: Using psql (Recommended)

```bash
# Linux/Mac
psql -h dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com \
     -p 5432 \
     -U uppalcrm_devtest \
     -d uppalcrm_devtest \
     -f scripts/migration_software_licenses_to_accounts_v2.sql

# Windows (command line)
psql -h dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com ^
     -p 5432 ^
     -U uppalcrm_devtest ^
     -d uppalcrm_devtest ^
     -f scripts/migration_software_licenses_to_accounts_v2.sql
```

#### Option B: Using psql with password file

Create a `.pgpass` file with your credentials, then use:

```bash
psql -h dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com \
     -p 5432 \
     -U uppalcrm_devtest \
     -d uppalcrm_devtest \
     -f scripts/migration_software_licenses_to_accounts_v2.sql
```

### Step 3: Monitor Migration Progress

The migration script will output:

1. **Connection Check** - Verifies database access
2. **Pre-flight Validation** - Checks table existence, FKs, indexes, policies
3. **Backup Creation** - Creates `software_licenses_backup` table
4. **Drop FKs** - Removes 6 dependent foreign keys
5. **Rename Table** - Renames `software_licenses` to `accounts`
6. **Recreate FKs** - Re-adds all 6 foreign keys pointing to `accounts`
7. **Rename Indexes** - Updates index names (5 total)
8. **Update Policies** - Renames RLS policies
9. **Update Triggers** - Renames triggers
10. **Post-Migration Validation** - Verifies all changes

Each section will show `[OK]`, `[INFO]`, or `[SKIPPED]` messages.

### Step 4: Post-Migration Validation

After the migration completes, run these commands to verify:

```sql
-- Verify accounts table exists and has data
SELECT COUNT(*) as "record_count" FROM public.accounts;

-- Verify old table is gone
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'software_licenses'
) as "software_licenses_exists";

-- Verify backup exists
SELECT COUNT(*) as "backup_count" FROM public.software_licenses_backup;

-- List foreign keys on accounts (should be 6)
SELECT
    constraint_name,
    table_name,
    column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public' AND table_name = 'accounts'
ORDER BY constraint_name;

-- List indexes on accounts (should be 5, excluding primary key)
SELECT
    indexname
FROM pg_indexes
WHERE tablename = 'accounts' AND schemaname = 'public'
AND indexname NOT LIKE '%_pkey'
ORDER BY indexname;

-- Check RLS policies
SELECT policyname FROM pg_policies
WHERE tablename = 'accounts' AND schemaname = 'public';

-- Check triggers
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'accounts';

-- Test sample query
SELECT * FROM public.accounts LIMIT 5;
```

## Migration Details

### What Gets Renamed

1. **Table**: `software_licenses` → `accounts`
2. **Indexes** (5 total):
   - `idx_software_licenses_org_contact` → `idx_accounts_org_contact`
   - `idx_software_licenses_device` → `idx_accounts_device`
   - `idx_software_licenses_status` → `idx_accounts_status`
   - `idx_software_licenses_expiry` → `idx_accounts_expiry`
   - `idx_software_licenses_key` → `idx_accounts_key`
3. **RLS Policies**: Names updated to reflect new table
4. **Triggers**: Names updated (e.g., `update_software_licenses_updated_at` → `update_accounts_updated_at`)
5. **Table Comment**: Updated to indicate rename

### Foreign Keys Recreated (6 total)

The migration drops and recreates these foreign keys:

1. `trials.converted_to_license_id` → `accounts(id)`
2. `license_transfers.license_id` → `accounts(id)`
3. `downloads_activations.license_id` → `accounts(id)`
4. `billing_payments.license_id` → `accounts(id)`
5. `renewals_subscriptions.license_id` → `accounts(id)`
6. `renewal_alerts.license_id` → `accounts(id)`

### Data Preservation

- All existing data is preserved
- Record count before/after is verified
- Backup table `software_licenses_backup` is created
- No data is deleted

## Rollback Procedure

If the migration fails or needs to be rolled back:

### Automatic Rollback

If the migration encounters an error, the entire transaction will be rolled back automatically due to `\set ON_ERROR_STOP on` being enabled.

### Manual Rollback (if needed)

If you need to manually restore from backup:

```sql
-- Drop the new accounts table
DROP TABLE IF EXISTS public.accounts CASCADE;

-- Restore from backup
CREATE TABLE public.accounts AS SELECT * FROM public.software_licenses_backup;

-- Recreate indexes, foreign keys, policies, and triggers
-- (Use the schema definition files to restore structure)

-- Remove backup
DROP TABLE public.software_licenses_backup;
```

## Testing the Migration

### Using Bash (Linux/Mac)

```bash
chmod +x scripts/test_migration_comprehensive.sh
./scripts/test_migration_comprehensive.sh
```

### Using Batch (Windows)

```batch
scripts\test_migration.bat
```

### Using Python

```bash
# Requires psycopg2: pip install psycopg2-binary
python3 scripts/execute_migration.py
```

## Expected Migration Duration

- Small database (<10MB): 2-5 seconds
- Medium database (10MB-100MB): 5-15 seconds
- Large database (>100MB): 15-60+ seconds

## Post-Migration Tasks

After successful migration:

1. **Update Application Code**
   - Change all references from `software_licenses` to `accounts` in:
     - Backend controllers
     - API routes
     - Database queries
     - Documentation

2. **Update Database Documentation**
   - Update schema documentation
   - Update API documentation
   - Update database diagrams

3. **Test Application**
   - Run full test suite
   - Test all license-related API endpoints
   - Verify reporting and analytics

4. **Clean Up**
   - Keep `software_licenses_backup` for 30 days before deletion
   - Update migration log
   - Archive this migration script

## Troubleshooting

### Error: "Table software_licenses does not exist"

The table may have already been migrated. Check:
```sql
SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts');
```

If `accounts` exists, migration is complete.

### Error: "Target table accounts already exists"

Migration cannot proceed. Either:
- The migration was already run successfully
- There's an existing `accounts` table

Check with:
```sql
SELECT * FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts';
```

### Error: "Foreign key constraint failed"

This means a dependent table is referencing invalid data. Check the backup:
```sql
SELECT * FROM public.software_licenses_backup WHERE id IS NULL;
```

### Connection Refused

Verify database connectivity:
```bash
# Linux/Mac
ping dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com

# Or test with psql
psql -h dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com -U uppalcrm_devtest -d uppalcrm_devtest -c "SELECT 1"
```

## Success Criteria

Migration is considered successful when:

✓ accounts table exists
✓ software_licenses table no longer exists
✓ All records are preserved (count matches backup)
✓ All 6 foreign keys are present
✓ All 5 indexes are present
✓ RLS policies are functional
✓ Triggers are functional
✓ No duplicate records
✓ No NULL primary keys
✓ Application continues to work with new table name

## Documentation

See also:
- `SOFTWARE_LICENSES_COMPREHENSIVE_REPORT.md` - Complete reference of all references
- `MIGRATION_SUMMARY.txt` - High-level migration notes
- `backend/database/license_schema.sql` - Original schema definition

## Questions or Issues?

If you encounter any issues:

1. Check the error message in the migration output
2. Review the "Troubleshooting" section above
3. Check database logs:
   ```sql
   SELECT * FROM pg_stat_statements WHERE query LIKE '%accounts%' LIMIT 10;
   ```
4. Review the backup table to ensure data integrity:
   ```sql
   SELECT COUNT(*) FROM public.software_licenses_backup;
   ```

## Migration Checklist

- [ ] Pre-migration inspection completed
- [ ] Backup created (software_licenses_backup)
- [ ] Migration script executed
- [ ] All validation checks passed
- [ ] Post-migration queries verified
- [ ] Application code updated
- [ ] Tests passed
- [ ] Documentation updated
- [ ] Backup retained (30 days recommended)
- [ ] Cleanup performed

---

**Generated**: 2026-02-01
**Migration Version**: 2.0
**Status**: Ready for execution
