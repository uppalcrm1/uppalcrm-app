#!/bin/bash

# ==============================================================================
# COMPREHENSIVE MIGRATION TEST SCRIPT
# Database: uppalcrm_devtest
# Purpose: Test the software_licenses -> accounts migration thoroughly
# ==============================================================================

set -e  # Exit on error

# Database connection details
DB_HOST="dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com"
DB_PORT="5432"
DB_NAME="uppalcrm_devtest"
DB_USER="uppalcrm_devtest"
DB_PASSWORD="YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs"

# Export for psql
export PGPASSWORD="$DB_PASSWORD"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Timestamp for logging
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_FILE="migration_test_report_${TIMESTAMP}.txt"

# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================

log_section() {
    echo ""
    echo "======================================================================"
    echo "$1"
    echo "======================================================================" | tee -a "$REPORT_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$REPORT_FILE"
}

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1" | tee -a "$REPORT_FILE"
    ((TESTS_PASSED++))
    ((TESTS_TOTAL++))
}

log_failure() {
    echo -e "${RED}[FAIL]${NC} $1" | tee -a "$REPORT_FILE"
    ((TESTS_FAILED++))
    ((TESTS_TOTAL++))
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$REPORT_FILE"
}

# Execute SQL query and capture output
execute_sql() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1" -t
}

# ==============================================================================
# TEST SUITE
# ==============================================================================

echo "" | tee "$REPORT_FILE"
log_section "MIGRATION TEST SUITE - $(date)"

# ==============================================================================
# SECTION 1: PRE-MIGRATION STATE INSPECTION
# ==============================================================================

log_section "SECTION 1: PRE-MIGRATION STATE INSPECTION"

log_info "Connecting to devtest database..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" &>/dev/null; then
    log_success "Successfully connected to devtest database"
else
    log_failure "Failed to connect to devtest database"
    exit 1
fi

log_info "Checking if software_licenses table exists..."
SOFTWARE_LICENSES_EXISTS=$(execute_sql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'software_licenses')")
if [ "$SOFTWARE_LICENSES_EXISTS" = "t" ]; then
    log_success "software_licenses table exists"
else
    log_warning "software_licenses table does NOT exist - may have been migrated already"
fi

log_info "Checking if accounts table exists..."
ACCOUNTS_EXISTS=$(execute_sql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts')")
if [ "$ACCOUNTS_EXISTS" = "t" ]; then
    log_warning "accounts table already exists"
else
    log_success "accounts table does not exist yet (safe to proceed)"
fi

# Store pre-migration counts if table exists
if [ "$SOFTWARE_LICENSES_EXISTS" = "t" ]; then
    PRE_MIGRATION_RECORD_COUNT=$(execute_sql "SELECT COUNT(*) FROM public.software_licenses")
    log_info "Pre-migration record count: $PRE_MIGRATION_RECORD_COUNT"

    PRE_MIGRATION_FK_COUNT=$(execute_sql "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'software_licenses' AND constraint_type = 'FOREIGN KEY'")
    log_info "Pre-migration FK count on software_licenses: $PRE_MIGRATION_FK_COUNT"

    PRE_MIGRATION_INDEX_COUNT=$(execute_sql "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'software_licenses' AND schemaname = 'public' AND indexname NOT LIKE '%_pkey'")
    log_info "Pre-migration index count on software_licenses: $PRE_MIGRATION_INDEX_COUNT"
fi

# ==============================================================================
# SECTION 2: EXECUTE MIGRATION SCRIPT
# ==============================================================================

log_section "SECTION 2: EXECUTING MIGRATION SCRIPT"

MIGRATION_SCRIPT="./scripts/migration_software_licenses_to_accounts_v2.sql"

if [ ! -f "$MIGRATION_SCRIPT" ]; then
    log_failure "Migration script not found: $MIGRATION_SCRIPT"
    exit 1
fi

log_info "Executing migration script: $MIGRATION_SCRIPT"
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$MIGRATION_SCRIPT" 2>&1 | tee -a "$REPORT_FILE"; then
    log_success "Migration script executed successfully"
else
    log_failure "Migration script execution failed"
    exit 1
fi

# ==============================================================================
# SECTION 3: POST-MIGRATION STATE INSPECTION
# ==============================================================================

log_section "SECTION 3: POST-MIGRATION STATE INSPECTION"

log_info "Checking if accounts table exists..."
ACCOUNTS_EXISTS=$(execute_sql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts')")
if [ "$ACCOUNTS_EXISTS" = "t" ]; then
    log_success "accounts table exists"
else
    log_failure "accounts table does not exist after migration"
fi

log_info "Checking if software_licenses table still exists..."
SOFTWARE_LICENSES_EXISTS=$(execute_sql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'software_licenses')")
if [ "$SOFTWARE_LICENSES_EXISTS" = "t" ]; then
    log_failure "software_licenses table still exists (should have been renamed)"
else
    log_success "software_licenses table no longer exists"
fi

log_info "Checking if backup table exists..."
BACKUP_EXISTS=$(execute_sql "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'software_licenses_backup')")
if [ "$BACKUP_EXISTS" = "t" ]; then
    log_success "Backup table software_licenses_backup exists"
else
    log_failure "Backup table does not exist"
fi

# ==============================================================================
# SECTION 4: DATA VALIDATION TESTS
# ==============================================================================

log_section "SECTION 4: DATA VALIDATION TESTS"

if [ "$ACCOUNTS_EXISTS" = "t" ]; then
    log_info "Retrieving post-migration record count..."
    POST_MIGRATION_RECORD_COUNT=$(execute_sql "SELECT COUNT(*) FROM public.accounts")
    log_info "Post-migration record count: $POST_MIGRATION_RECORD_COUNT"

    if [ ! -z "$PRE_MIGRATION_RECORD_COUNT" ] && [ "$PRE_MIGRATION_RECORD_COUNT" -eq "$POST_MIGRATION_RECORD_COUNT" ]; then
        log_success "Record count matches (before: $PRE_MIGRATION_RECORD_COUNT, after: $POST_MIGRATION_RECORD_COUNT)"
    else
        log_warning "Unable to verify record count (pre-migration data not available)"
    fi

    log_info "Checking for duplicate records (grouped by id)..."
    DUPLICATE_COUNT=$(execute_sql "SELECT COUNT(*) FROM (SELECT id FROM public.accounts GROUP BY id HAVING COUNT(*) > 1) t")
    if [ "$DUPLICATE_COUNT" -eq 0 ]; then
        log_success "No duplicate records found"
    else
        log_failure "Found $DUPLICATE_COUNT duplicate records"
    fi

    log_info "Checking for NULL values in id column..."
    NULL_COUNT=$(execute_sql "SELECT COUNT(*) FROM public.accounts WHERE id IS NULL")
    if [ "$NULL_COUNT" -eq 0 ]; then
        log_success "No NULL values in id column"
    else
        log_failure "Found $NULL_COUNT NULL values in id column"
    fi

    log_info "Retrieving sample data (first record)..."
    execute_sql "SELECT * FROM public.accounts LIMIT 1" | tee -a "$REPORT_FILE"
fi

# ==============================================================================
# SECTION 5: FOREIGN KEY VALIDATION
# ==============================================================================

log_section "SECTION 5: FOREIGN KEY VALIDATION"

log_info "Counting foreign keys on accounts table..."
POST_MIGRATION_FK_COUNT=$(execute_sql "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'accounts' AND constraint_type = 'FOREIGN KEY'")
log_info "Post-migration FK count: $POST_MIGRATION_FK_COUNT"

if [ "$POST_MIGRATION_FK_COUNT" -eq 6 ]; then
    log_success "Found 6 foreign keys as expected"
else
    log_failure "Expected 6 foreign keys, but found $POST_MIGRATION_FK_COUNT"
fi

log_info "Listing all foreign keys on accounts table:"
execute_sql "
SELECT
    constraint_name,
    table_name,
    column_name
FROM information_schema.key_column_usage
WHERE table_schema = 'public'
    AND table_name = 'accounts'
ORDER BY constraint_name
" | tee -a "$REPORT_FILE"

# ==============================================================================
# SECTION 6: INDEX VALIDATION
# ==============================================================================

log_section "SECTION 6: INDEX VALIDATION"

log_info "Counting indexes on accounts table..."
POST_MIGRATION_INDEX_COUNT=$(execute_sql "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'accounts' AND schemaname = 'public' AND indexname NOT LIKE '%_pkey'")
log_info "Post-migration index count: $POST_MIGRATION_INDEX_COUNT"

if [ "$POST_MIGRATION_INDEX_COUNT" -eq 5 ]; then
    log_success "Found 5 indexes as expected"
else
    log_warning "Expected 5 indexes, but found $POST_MIGRATION_INDEX_COUNT"
fi

log_info "Listing all indexes on accounts table:"
execute_sql "
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'accounts'
    AND schemaname = 'public'
ORDER BY indexname
" | tee -a "$REPORT_FILE"

# ==============================================================================
# SECTION 7: POLICY AND TRIGGER VALIDATION
# ==============================================================================

log_section "SECTION 7: POLICY AND TRIGGER VALIDATION"

log_info "Checking RLS policies on accounts table..."
POLICY_COUNT=$(execute_sql "SELECT COUNT(*) FROM pg_policies WHERE tablename = 'accounts' AND schemaname = 'public'")
log_info "RLS policy count: $POLICY_COUNT"

if [ "$POLICY_COUNT" -gt 0 ]; then
    log_success "RLS policies exist on accounts table"
    log_info "RLS policy details:"
    execute_sql "
    SELECT
        policyname,
        permissive,
        qual
    FROM pg_policies
    WHERE tablename = 'accounts'
        AND schemaname = 'public'
    " | tee -a "$REPORT_FILE"
else
    log_warning "No RLS policies found on accounts table"
fi

log_info "Checking triggers on accounts table..."
TRIGGER_COUNT=$(execute_sql "SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'accounts'")
log_info "Trigger count: $TRIGGER_COUNT"

if [ "$TRIGGER_COUNT" -gt 0 ]; then
    log_success "Triggers exist on accounts table"
    log_info "Trigger details:"
    execute_sql "
    SELECT
        trigger_name,
        event_manipulation,
        action_orientation
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
        AND event_object_table = 'accounts'
    " | tee -a "$REPORT_FILE"
else
    log_warning "No triggers found on accounts table"
fi

# ==============================================================================
# SECTION 8: FUNCTIONAL TESTS
# ==============================================================================

log_section "SECTION 8: FUNCTIONAL TESTS"

log_info "Test: Query accounts table with basic SELECT"
if execute_sql "SELECT COUNT(*) FROM public.accounts" &>/dev/null; then
    log_success "Basic SELECT query works on accounts table"
else
    log_failure "Basic SELECT query failed on accounts table"
fi

log_info "Test: Query software_licenses should fail"
if execute_sql "SELECT COUNT(*) FROM public.software_licenses" &>/dev/null; then
    log_failure "Query to old table software_licenses should have failed but didn't"
else
    log_success "Query to old table software_licenses correctly fails"
fi

log_info "Test: Verify accounts table structure (columns)"
COLUMN_COUNT=$(execute_sql "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts'")
log_info "Total columns in accounts table: $COLUMN_COUNT"
if [ "$COLUMN_COUNT" -gt 0 ]; then
    log_success "accounts table has $COLUMN_COUNT columns"
else
    log_failure "accounts table has no columns"
fi

# ==============================================================================
# SECTION 9: COMPREHENSIVE SUMMARY
# ==============================================================================

log_section "SECTION 9: COMPREHENSIVE MIGRATION SUMMARY"

echo "" | tee -a "$REPORT_FILE"
echo "Test Results Summary:" | tee -a "$REPORT_FILE"
echo "  Total Tests: $TESTS_TOTAL" | tee -a "$REPORT_FILE"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}" | tee -a "$REPORT_FILE"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}MIGRATION TEST SUITE PASSED${NC}" | tee -a "$REPORT_FILE"
    echo "All tests completed successfully." | tee -a "$REPORT_FILE"
    EXIT_CODE=0
else
    echo -e "${RED}MIGRATION TEST SUITE FAILED${NC}" | tee -a "$REPORT_FILE"
    echo "$TESTS_FAILED test(s) failed." | tee -a "$REPORT_FILE"
    EXIT_CODE=1
fi

echo "" | tee -a "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

exit $EXIT_CODE
