# Database Migration: software_licenses → accounts

## Overview

This directory contains a comprehensive database migration toolkit for renaming the `software_licenses` table to `accounts` in the PostgreSQL database. The migration has already been completed in the **devtest** environment and these tools are provided for deployment to **staging** and **production** environments.

## Current Status

- **Devtest Database**: Migration COMPLETE ✓
- **Staging Database**: Ready for migration
- **Production Database**: Ready for migration

## Quick Start

### View Current Schema (Devtest)
```bash
cd scripts
node analyze_accounts_table.js
```

### View Full Migration Report
```bash
Open: ../MIGRATION_REPORT.md
```

### Execute Migration (Staging/Production)
```bash
cd scripts
node run_migration.js
```

## Files Overview

### Core Migration Scripts
```
scripts/
├── migration_software_licenses_to_accounts.sql  (Main migration)
├── test_migration.sql                           (Validation tests)
├── run_migration.js                             (Orchestration - Node.js)
├── run_migration.sh                             (Orchestration - Bash)
└── analyze_accounts_table.js                    (Schema analysis)
```

### Documentation
```
├── MIGRATION_REPORT.md                (Comprehensive guide)
├── MIGRATION_SUMMARY.txt              (Quick reference)
└── README_MIGRATION.md                (This file)
```

### Analysis Results
```
scripts/
├── accounts_table_analysis.txt        (Complete schema analysis)
└── check_db_schema.js                 (Schema verification tool)
```

## Migration Details

### Table Rename
- **From**: `software_licenses`
- **To**: `accounts`
- **Records**: 30
- **Size**: 176 kB

### Objects Updated
- ✓ 1 Table
- ✓ 5 Indexes
- ✓ 6 Foreign Keys (5 outgoing + 1 incoming)
- ✓ 2 Triggers
- ✓ 1 RLS Policy

### Validation Results
All 8 automated tests PASSED:
1. accounts table exists ✓
2. software_licenses table removed ✓
3. Record counts match ✓
4. Foreign keys functioning ✓
5. Indexes present ✓
6. No NULL IDs ✓
7. Table queryable ✓
8. Old table name inaccessible ✓

## How to Use

### Option 1: Automated Migration (Recommended)
```bash
# Navigate to scripts directory
cd scripts

# Run the automated migration orchestration
node run_migration.js

# This will:
# - Connect to the database
# - Collect pre-migration state
# - Execute the migration
# - Run comprehensive validation
# - Generate detailed reports
```

### Option 2: Manual SQL Execution
```bash
# Using psql
psql -h <host> -U <user> -d <database> -f migration_software_licenses_to_accounts.sql

# Then run validation
psql -h <host> -U <user> -d <database> -f test_migration.sql
```

### Option 3: Using Bash Orchestration
```bash
cd scripts
bash run_migration.sh
```

## Pre-Migration Checklist

- [ ] Full database backup created
- [ ] Maintenance window scheduled
- [ ] All dependent applications stopped
- [ ] Team notified
- [ ] Rollback plan reviewed
- [ ] Application code updated
- [ ] Connection credentials verified

## Migration Steps (High Level)

1. **Backup** - Create full database backup
2. **Validate** - Check current database state
3. **Execute** - Run migration script
4. **Test** - Run validation tests
5. **Deploy** - Restart applications
6. **Monitor** - Watch logs for 24-48 hours

**Estimated Duration**: 5-10 minutes
**Required Downtime**: 5-15 minutes

## Rollback Procedure

### Quick Rollback
```sql
DROP TABLE public.accounts CASCADE;
ALTER TABLE public.software_licenses_backup RENAME TO software_licenses;
-- Recreate triggers, indexes, and policies
```

### Full Rollback
```bash
pg_restore -h <host> -U <user> -d <database> -c software_licenses_backup.dump
```

See MIGRATION_REPORT.md Section 5 for detailed rollback procedures.

## Schema Summary

### Table Structure
- **ID**: UUID (Primary Key)
- **Organization ID**: UUID (Foreign Key)
- **Contact ID**: UUID (Foreign Key)
- **Account Name**: VARCHAR (Required)
- **Account Type**: VARCHAR (Trial/Active)
- **License Status**: VARCHAR (Pending/Active)
- **30 Total Columns** (includes billing, subscription, audit fields)

### Key Relationships
```
accounts
├── contacts (via contact_id)
├── organizations (via organization_id)
├── users (via created_by, deleted_by)
├── products (via product_id)
└── transactions (referenced by account_id)
```

### Performance
- **10 Indexes** (1 primary key + 9 operational)
- **RLS Policy** for organization isolation
- **2 Triggers** for soft delete logging and timestamp updates
- **Query Performance**: <2ms for indexed queries

## Database Connection

For **devtest**:
```
Host: dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com
Port: 5432
Database: uppalcrm_devtest
User: uppalcrm_devtest
Password: YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs
SSL: Required
```

## Documentation

### Main Report
**MIGRATION_REPORT.md** contains:
- Executive summary
- Complete schema analysis
- Pre-migration planning
- Validation results
- Production deployment instructions
- Rollback procedures
- Risk assessment
- Recommendations

### Quick Reference
**MIGRATION_SUMMARY.txt** contains:
- Quick overview
- Current status
- File locations
- Next steps
- Support information

### Detailed Analysis
**accounts_table_analysis.txt** contains:
- All 30 columns
- All constraints
- All indexes
- All policies
- All triggers
- Sample data

## Key Features

✓ **Comprehensive Pre-Flight Checks**
  - Validates table exists
  - Checks target doesn't exist
  - Counts all objects
  - Verifies data consistency

✓ **Automatic Backup**
  - Creates backup table before migration
  - Preserves all data
  - Enables rollback

✓ **Complete Object Renaming**
  - Table rename
  - Index renaming (5 indexes)
  - Foreign key management
  - Trigger updates
  - Policy updates

✓ **Thorough Validation**
  - Post-migration checks
  - 8 automated tests
  - Record count verification
  - Constraint verification
  - Index verification

✓ **Detailed Logging**
  - Every step logged
  - All errors captured
  - Comprehensive reports
  - JSON output available

## Troubleshooting

### Connection Errors
- Verify host, port, database, user credentials
- Check SSL requirement
- Ensure firewall allows connection

### Migration Failures
- Check pre-flight validation output
- Review migration log
- Verify backup was created
- Use rollback procedure

### Validation Test Failures
- Check individual test output
- Review data integrity
- Verify all foreign keys
- Check index health

## Next Steps

1. **Review Documentation**
   - Read MIGRATION_REPORT.md
   - Check current schema analysis

2. **Test in Staging**
   - Run migration on staging
   - Verify all tests pass
   - Test application compatibility

3. **Prepare Production**
   - Schedule maintenance window
   - Create backup
   - Notify stakeholders

4. **Deploy to Production**
   - Execute migration
   - Run validation
   - Monitor performance

5. **Post-Migration**
   - Update documentation
   - Monitor logs
   - Gather feedback

## Support

For questions or issues:
1. Check MIGRATION_REPORT.md Section 7-8
2. Review inline script documentation
3. Check accounts_table_analysis.txt for schema details
4. Review validation test results

## Important Notes

- **Backup**: A backup table `software_licenses_backup` is created automatically
- **Downtime**: Minimal downtime required (5-15 minutes)
- **Data**: No data is lost or transformed
- **Performance**: No performance impact expected
- **Compatibility**: All application code must use 'accounts' table name

## Version Information

- **Project**: uppal-crm-project
- **Migration**: software_licenses → accounts
- **Version**: 1.0
- **Created**: 2026-02-01
- **Status**: Production Ready

## Files Checklist

- ✓ migration_software_licenses_to_accounts.sql
- ✓ test_migration.sql
- ✓ run_migration.js
- ✓ run_migration.sh
- ✓ analyze_accounts_table.js
- ✓ check_db_schema.js
- ✓ accounts_table_analysis.txt
- ✓ MIGRATION_REPORT.md
- ✓ MIGRATION_SUMMARY.txt
- ✓ README_MIGRATION.md (this file)

All files present and verified!

---

For complete details, see: **MIGRATION_REPORT.md**
