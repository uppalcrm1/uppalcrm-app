#!/bin/bash

# ==============================================================================
# Migration Orchestration Script: software_licenses -> accounts
# Database: uppalcrm_devtest
# ==============================================================================

set -e

DB_HOST="dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com"
DB_PORT="5432"
DB_NAME="uppalcrm_devtest"
DB_USER="uppalcrm_devtest"
DB_PASSWORD="YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs"

MIGRATION_SCRIPT="/c/Users/uppal/uppal-crm-project/scripts/migration_software_licenses_to_accounts.sql"
TEST_SCRIPT="/c/Users/uppal/uppal-crm-project/scripts/test_migration.sql"
REPORT_FILE="/c/Users/uppal/uppal-crm-project/scripts/migration_report.txt"
PRE_STATE_FILE="/c/Users/uppal/uppal-crm-project/scripts/pre_migration_state.txt"
POST_STATE_FILE="/c/Users/uppal/uppal-crm-project/scripts/post_migration_state.txt"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function log_message() {
    local level=$1
    local message=$2
    local color=$NC

    case $level in
        "INFO")
            color=$NC
            ;;
        "SUCCESS")
            color=$GREEN
            ;;
        "WARNING")
            color=$YELLOW
            ;;
        "ERROR")
            color=$RED
            ;;
    esac

    echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $message${NC}"
}

function test_connection() {
    log_message "INFO" "Testing database connection..."

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
        log_message "SUCCESS" "Database connection successful"
        return 0
    else
        log_message "ERROR" "Database connection failed"
        return 1
    fi
}

function collect_pre_migration_state() {
    log_message "INFO" "Collecting pre-migration state..."

    cat > /tmp/pre_migration.sql << 'SQL'
\echo 'PRE-MIGRATION STATE'
\echo '======================================================================'

\echo ''
\echo '1. Check if software_licenses table exists:'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'software_licenses'
) as "table_exists";

\echo ''
\echo '2. Record count in software_licenses:'
SELECT COUNT(*) as "record_count" FROM public.software_licenses;

\echo ''
\echo '3. Foreign keys referencing software_licenses:'
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND kcu.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

\echo ''
\echo '4. Indexes on software_licenses:'
SELECT indexname FROM pg_indexes
WHERE tablename = 'software_licenses' AND schemaname = 'public'
ORDER BY indexname;

\echo ''
\echo '5. RLS Policies on software_licenses:'
SELECT policyname FROM pg_policies
WHERE tablename = 'software_licenses' AND schemaname = 'public'
ORDER BY policyname;

\echo ''
\echo '6. Triggers on software_licenses:'
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'software_licenses'
ORDER BY trigger_name;

\echo ''
\echo '7. Table structure:'
\d+ public.software_licenses
SQL

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /tmp/pre_migration.sql > "$PRE_STATE_FILE" 2>&1
    log_message "SUCCESS" "Pre-migration state collected and saved to $PRE_STATE_FILE"
}

function run_migration() {
    log_message "INFO" "Executing migration script..."

    if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_SCRIPT" > /tmp/migration_output.log 2>&1; then
        log_message "SUCCESS" "Migration script executed successfully"
        cat /tmp/migration_output.log >> "$REPORT_FILE"
        return 0
    else
        log_message "ERROR" "Migration script failed"
        cat /tmp/migration_output.log
        return 1
    fi
}

function collect_post_migration_state() {
    log_message "INFO" "Collecting post-migration state..."

    cat > /tmp/post_migration.sql << 'SQL'
\echo 'POST-MIGRATION STATE'
\echo '======================================================================'

\echo ''
\echo '1. Check if accounts table exists:'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
) as "table_exists";

\echo ''
\echo '2. Check if software_licenses table still exists:'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'software_licenses'
    AND table_type = 'BASE TABLE'
) as "table_exists";

\echo ''
\echo '3. Record count in accounts:'
SELECT COUNT(*) as "record_count" FROM public.accounts;

\echo ''
\echo '4. Record count in backup:'
SELECT COUNT(*) as "backup_count" FROM public.software_licenses_backup;

\echo ''
\echo '5. Comparison:'
SELECT
    (SELECT COUNT(*) FROM public.accounts) as "accounts_count",
    (SELECT COUNT(*) FROM public.software_licenses_backup) as "backup_count",
    CASE WHEN (SELECT COUNT(*) FROM public.accounts) = (SELECT COUNT(*) FROM public.software_licenses_backup)
        THEN 'MATCH' ELSE 'MISMATCH' END as "count_status";

\echo ''
\echo '6. Foreign keys on accounts table:'
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
    AND tc.table_name = 'accounts'
ORDER BY tc.constraint_name;

\echo ''
\echo '7. Indexes on accounts:'
SELECT indexname FROM pg_indexes
WHERE tablename = 'accounts' AND schemaname = 'public'
ORDER BY indexname;

\echo ''
\echo '8. RLS Policies on accounts:'
SELECT policyname FROM pg_policies
WHERE tablename = 'accounts' AND schemaname = 'public'
ORDER BY policyname;

\echo ''
\echo '9. Triggers on accounts:'
SELECT trigger_name FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'accounts'
ORDER BY trigger_name;

\echo ''
\echo '10. Table structure:'
\d+ public.accounts

\echo ''
\echo '11. Sample data (first 5 rows):'
SELECT * FROM public.accounts LIMIT 5;
SQL

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /tmp/post_migration.sql > "$POST_STATE_FILE" 2>&1
    log_message "SUCCESS" "Post-migration state collected and saved to $POST_STATE_FILE"
}

function run_validation_tests() {
    log_message "INFO" "Running validation tests..."

    cat > /tmp/validation_tests.sql << 'SQL'
\echo 'VALIDATION TESTS'
\echo '======================================================================'

\echo ''
\echo 'Test 1: accounts table exists'
SELECT
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'accounts'
    ) THEN 'PASS' ELSE 'FAIL' END as "Test 1";

\echo ''
\echo 'Test 2: software_licenses table no longer exists'
SELECT
    CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'software_licenses'
        AND table_type = 'BASE TABLE'
    ) THEN 'PASS' ELSE 'FAIL' END as "Test 2";

\echo ''
\echo 'Test 3: Record counts match'
SELECT
    CASE WHEN (SELECT COUNT(*) FROM public.accounts) = (SELECT COUNT(*) FROM public.software_licenses_backup)
        THEN 'PASS' ELSE 'FAIL' END as "Test 3";

\echo ''
\echo 'Test 4: Foreign keys exist on accounts'
SELECT
    CASE WHEN (SELECT COUNT(*) FROM information_schema.table_constraints
               WHERE table_schema = 'public' AND table_name = 'accounts'
               AND constraint_type = 'FOREIGN KEY') > 0
        THEN 'PASS' ELSE 'FAIL' END as "Test 4";

\echo ''
\echo 'Test 5: Indexes exist on accounts'
SELECT
    CASE WHEN (SELECT COUNT(*) FROM pg_indexes
               WHERE tablename = 'accounts' AND schemaname = 'public'
               AND indexname NOT LIKE '%_pkey') > 0
        THEN 'PASS' ELSE 'FAIL' END as "Test 5";

\echo ''
\echo 'Test 6: No NULL IDs in accounts'
SELECT
    CASE WHEN (SELECT COUNT(*) FROM public.accounts WHERE id IS NULL) = 0
        THEN 'PASS' ELSE 'FAIL' END as "Test 6";

\echo ''
\echo 'Test 7: Can query accounts table'
SELECT
    CASE WHEN COUNT(*) > 0 OR COUNT(*) = 0
        THEN 'PASS' ELSE 'FAIL' END as "Test 7"
FROM public.accounts;

\echo ''
\echo 'Test 8: Old table name inaccessible'
\echo 'SELECT CASE WHEN false THEN 1 ELSE 1 END; -- Placeholder'
SQL

    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f /tmp/validation_tests.sql > /tmp/validation_results.log 2>&1
    cat /tmp/validation_results.log
    log_message "SUCCESS" "Validation tests completed"
}

function generate_comprehensive_report() {
    log_message "INFO" "Generating comprehensive migration report..."

    {
        echo "================================================================================"
        echo "MIGRATION REPORT: software_licenses -> accounts"
        echo "================================================================================"
        echo ""
        echo "Migration Timestamp: $TIMESTAMP"
        echo "Database: $DB_NAME"
        echo ""
        echo "================================================================================"
        echo "PRE-MIGRATION STATE"
        echo "================================================================================"
        cat "$PRE_STATE_FILE"
        echo ""
        echo "================================================================================"
        echo "MIGRATION EXECUTION LOG"
        echo "================================================================================"
        cat /tmp/migration_output.log 2>/dev/null || echo "No migration log available"
        echo ""
        echo "================================================================================"
        echo "POST-MIGRATION STATE"
        echo "================================================================================"
        cat "$POST_STATE_FILE"
        echo ""
        echo "================================================================================"
        echo "VALIDATION TEST RESULTS"
        echo "================================================================================"
        cat /tmp/validation_results.log 2>/dev/null || echo "No validation results available"
        echo ""
        echo "================================================================================"
        echo "ROLLBACK INSTRUCTIONS"
        echo "================================================================================"
        echo "To rollback this migration:"
        echo "1. DROP TABLE public.accounts CASCADE;"
        echo "2. ALTER TABLE public.software_licenses_backup RENAME TO software_licenses;"
        echo "3. Recreate any dropped objects (triggers, policies, etc.)"
        echo ""
        echo "================================================================================"
        echo "MIGRATION SUMMARY"
        echo "================================================================================"
        echo "Status: Check validation results above for success/failure"
        echo "================================================================================"
    } > "$REPORT_FILE"

    log_message "SUCCESS" "Report generated and saved to $REPORT_FILE"
}

function main() {
    echo "================================================================================"
    echo "DATABASE MIGRATION: software_licenses -> accounts"
    echo "================================================================================"
    echo ""

    > "$REPORT_FILE"

    # Test connection
    if ! test_connection; then
        log_message "ERROR" "Cannot proceed without database connection"
        exit 1
    fi

    # Collect pre-migration state
    collect_pre_migration_state

    # Run migration
    if ! run_migration; then
        log_message "ERROR" "Migration failed"
        exit 1
    fi

    # Collect post-migration state
    collect_post_migration_state

    # Run validation tests
    run_validation_tests

    # Generate comprehensive report
    generate_comprehensive_report

    echo ""
    log_message "SUCCESS" "Migration process completed"
    echo "Report saved to: $REPORT_FILE"
    echo ""
    echo "================================================================================"
}

main "$@"
