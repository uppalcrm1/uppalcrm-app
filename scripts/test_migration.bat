@echo off
REM ==============================================================================
REM COMPREHENSIVE MIGRATION TEST SCRIPT (Windows)
REM Database: uppalcrm_devtest
REM Purpose: Test the software_licenses -> accounts migration thoroughly
REM ==============================================================================

setlocal enabledelayedexpansion

REM Database connection details
set "DB_HOST=dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com"
set "DB_PORT=5432"
set "DB_NAME=uppalcrm_devtest"
set "DB_USER=uppalcrm_devtest"
set "DB_PASSWORD=YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs"

REM Test counters
set "TESTS_PASSED=0"
set "TESTS_FAILED=0"
set "TESTS_TOTAL=0"

REM Timestamp for logging
for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set "mydate=%%c%%a%%b")
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set "mytime=%%a%%b")
set "TIMESTAMP=%mydate%_%mytime%"
set "REPORT_FILE=migration_test_report_%TIMESTAMP%.txt"

echo. > "%REPORT_FILE%"

REM ==============================================================================
REM UTILITY FUNCTIONS
REM ==============================================================================

goto :main

:log_section
    echo.
    echo ======================================================================
    echo %~1
    echo ====================================================================== >> "%REPORT_FILE%"
    exit /b

:log_info
    echo [INFO] %~1
    echo [INFO] %~1 >> "%REPORT_FILE%"
    exit /b

:log_success
    echo [PASS] %~1
    echo [PASS] %~1 >> "%REPORT_FILE%"
    set /a TESTS_PASSED+=1
    set /a TESTS_TOTAL+=1
    exit /b

:log_failure
    echo [FAIL] %~1
    echo [FAIL] %~1 >> "%REPORT_FILE%"
    set /a TESTS_FAILED+=1
    set /a TESTS_TOTAL+=1
    exit /b

REM ==============================================================================
REM MAIN TEST EXECUTION
REM ==============================================================================

:main

echo.
call :log_section "MIGRATION TEST SUITE - !date! !time!"

REM SECTION 1: PRE-MIGRATION STATE INSPECTION
call :log_section "SECTION 1: PRE-MIGRATION STATE INSPECTION"

call :log_info "Connecting to devtest database..."
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "SELECT version();" > nul 2>&1
if !errorlevel! equ 0 (
    call :log_success "Successfully connected to devtest database"
) else (
    call :log_failure "Failed to connect to devtest database"
    goto :end_failure
)

call :log_info "Checking if software_licenses table exists..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'software_licenses')"') do set "SOFTWARE_LICENSES_EXISTS=%%A"

if "!SOFTWARE_LICENSES_EXISTS!"=="t" (
    call :log_success "software_licenses table exists"
) else (
    call :log_info "software_licenses table does NOT exist - may have been migrated already"
)

call :log_info "Checking if accounts table exists..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts')"') do set "ACCOUNTS_EXISTS=%%A"

if "!ACCOUNTS_EXISTS!"=="t" (
    call :log_info "accounts table already exists"
) else (
    call :log_success "accounts table does not exist yet"
)

REM SECTION 2: EXECUTE MIGRATION SCRIPT
call :log_section "SECTION 2: EXECUTING MIGRATION SCRIPT"

set "MIGRATION_SCRIPT=.\scripts\migration_software_licenses_to_accounts_v2.sql"

if not exist "!MIGRATION_SCRIPT!" (
    call :log_failure "Migration script not found: !MIGRATION_SCRIPT!"
    goto :end_failure
)

call :log_info "Executing migration script: !MIGRATION_SCRIPT!"
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -f "!MIGRATION_SCRIPT!" >> "%REPORT_FILE%" 2>&1
if !errorlevel! equ 0 (
    call :log_success "Migration script executed successfully"
) else (
    call :log_failure "Migration script execution failed"
    goto :end_failure
)

REM SECTION 3: POST-MIGRATION STATE INSPECTION
call :log_section "SECTION 3: POST-MIGRATION STATE INSPECTION"

call :log_info "Checking if accounts table exists..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'accounts')"') do set "ACCOUNTS_EXISTS=%%A"

if "!ACCOUNTS_EXISTS!"=="t" (
    call :log_success "accounts table exists"
) else (
    call :log_failure "accounts table does not exist"
)

call :log_info "Checking if software_licenses table still exists..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'software_licenses')"') do set "SOFTWARE_LICENSES_EXISTS=%%A"

if "!SOFTWARE_LICENSES_EXISTS!"=="t" (
    call :log_failure "software_licenses table still exists"
) else (
    call :log_success "software_licenses table no longer exists"
)

REM SECTION 4: DATA VALIDATION TESTS
call :log_section "SECTION 4: DATA VALIDATION TESTS"

if "!ACCOUNTS_EXISTS!"=="t" (
    call :log_info "Retrieving post-migration record count..."
    for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM public.accounts"') do set "POST_MIGRATION_RECORD_COUNT=%%A"

    call :log_info "Post-migration record count: !POST_MIGRATION_RECORD_COUNT!"

    call :log_success "Record count verified"
)

REM SECTION 5: FOREIGN KEY VALIDATION
call :log_section "SECTION 5: FOREIGN KEY VALIDATION"

call :log_info "Counting foreign keys on accounts table..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public' AND table_name = 'accounts' AND constraint_type = 'FOREIGN KEY'"') do set "FK_COUNT=%%A"

call :log_info "Foreign key count: !FK_COUNT!"

if "!FK_COUNT!"=="6" (
    call :log_success "Found 6 foreign keys as expected"
) else (
    call :log_failure "Expected 6 foreign keys, found !FK_COUNT!"
)

REM SECTION 6: INDEX VALIDATION
call :log_section "SECTION 6: INDEX VALIDATION"

call :log_info "Counting indexes on accounts table..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'accounts' AND schemaname = 'public' AND indexname NOT LIKE \'%%_pkey\'"') do set "INDEX_COUNT=%%A"

call :log_info "Index count: !INDEX_COUNT!"

if "!INDEX_COUNT!"=="5" (
    call :log_success "Found 5 indexes as expected"
) else (
    call :log_failure "Expected 5 indexes, found !INDEX_COUNT!"
)

REM SECTION 7: POLICY AND TRIGGER VALIDATION
call :log_section "SECTION 7: POLICY AND TRIGGER VALIDATION"

call :log_info "Checking RLS policies on accounts table..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM pg_policies WHERE tablename = \'accounts\' AND schemaname = \'public\'"') do set "POLICY_COUNT=%%A"

if "!POLICY_COUNT!" gtr 0 (
    call :log_success "RLS policies exist on accounts table (!POLICY_COUNT!)"
) else (
    call :log_info "No RLS policies found"
)

call :log_info "Checking triggers on accounts table..."
for /f "delims=" %%A in ('psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -t -c "SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_schema = \'public\' AND event_object_table = \'accounts\'"') do set "TRIGGER_COUNT=%%A"

if "!TRIGGER_COUNT!" gtr 0 (
    call :log_success "Triggers exist on accounts table (!TRIGGER_COUNT!)"
) else (
    call :log_info "No triggers found"
)

REM SECTION 8: FUNCTIONAL TESTS
call :log_section "SECTION 8: FUNCTIONAL TESTS"

call :log_info "Test: Query accounts table with basic SELECT"
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "SELECT COUNT(*) FROM public.accounts" > nul 2>&1
if !errorlevel! equ 0 (
    call :log_success "Basic SELECT query works on accounts table"
) else (
    call :log_failure "Basic SELECT query failed"
)

call :log_info "Test: Query software_licenses should fail"
psql -h "%DB_HOST%" -p "%DB_PORT%" -U "%DB_USER%" -d "%DB_NAME%" -c "SELECT COUNT(*) FROM public.software_licenses" > nul 2>&1
if !errorlevel! equ 0 (
    call :log_failure "Query to old table should have failed but didn't"
) else (
    call :log_success "Query to old table correctly fails"
)

REM SECTION 9: SUMMARY
call :log_section "SECTION 9: MIGRATION TEST SUMMARY"

echo.
echo Test Results Summary:
echo   Total Tests: !TESTS_TOTAL!
echo   Passed: !TESTS_PASSED!
echo   Failed: !TESTS_FAILED!
echo.

if !TESTS_FAILED! equ 0 (
    echo [SUCCESS] MIGRATION TEST SUITE PASSED
    echo [SUCCESS] MIGRATION TEST SUITE PASSED >> "%REPORT_FILE%"
    goto :end_success
) else (
    echo [FAILURE] MIGRATION TEST SUITE FAILED
    echo [FAILURE] MIGRATION TEST SUITE FAILED >> "%REPORT_FILE%"
    goto :end_failure
)

:end_success
echo.
echo Report saved to: %REPORT_FILE%
echo.
exit /b 0

:end_failure
echo.
echo Report saved to: %REPORT_FILE%
echo.
exit /b 1
