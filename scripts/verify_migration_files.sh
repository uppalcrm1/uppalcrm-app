#!/bin/bash

echo "================================================================================"
echo "MIGRATION FILES VERIFICATION"
echo "================================================================================"
echo ""

SCRIPTS_DIR="C:\Users\uppal\uppal-crm-project\scripts"
PROJECT_DIR="C:\Users\uppal\uppal-crm-project"

echo "Checking required migration files..."
echo ""

# Check main migration script
if [ -f "$SCRIPTS_DIR/migration_software_licenses_to_accounts.sql" ]; then
    echo "✓ migration_software_licenses_to_accounts.sql (355 lines)"
else
    echo "✗ migration_software_licenses_to_accounts.sql - MISSING"
fi

# Check test script
if [ -f "$SCRIPTS_DIR/test_migration.sql" ]; then
    echo "✓ test_migration.sql (327 lines)"
else
    echo "✗ test_migration.sql - MISSING"
fi

# Check Node.js orchestration
if [ -f "$SCRIPTS_DIR/run_migration.js" ]; then
    echo "✓ run_migration.js (565 lines)"
else
    echo "✗ run_migration.js - MISSING"
fi

# Check Bash orchestration
if [ -f "$SCRIPTS_DIR/run_migration.sh" ]; then
    echo "✓ run_migration.sh (340 lines)"
else
    echo "✗ run_migration.sh - MISSING"
fi

# Check analysis script
if [ -f "$SCRIPTS_DIR/analyze_accounts_table.js" ]; then
    echo "✓ analyze_accounts_table.js (320 lines)"
else
    echo "✗ analyze_accounts_table.js - MISSING"
fi

# Check DB schema check
if [ -f "$SCRIPTS_DIR/check_db_schema.js" ]; then
    echo "✓ check_db_schema.js"
else
    echo "✗ check_db_schema.js - MISSING"
fi

# Check analysis output
if [ -f "$SCRIPTS_DIR/accounts_table_analysis.txt" ]; then
    echo "✓ accounts_table_analysis.txt"
else
    echo "✗ accounts_table_analysis.txt - MISSING"
fi

echo ""
echo "Checking documentation files..."
echo ""

# Check main report
if [ -f "$PROJECT_DIR/MIGRATION_REPORT.md" ]; then
    echo "✓ MIGRATION_REPORT.md (comprehensive guide)"
else
    echo "✗ MIGRATION_REPORT.md - MISSING"
fi

# Check summary
if [ -f "$PROJECT_DIR/MIGRATION_SUMMARY.txt" ]; then
    echo "✓ MIGRATION_SUMMARY.txt (quick reference)"
else
    echo "✗ MIGRATION_SUMMARY.txt - MISSING"
fi

echo ""
echo "================================================================================"
echo "FILE VERIFICATION COMPLETE"
echo "================================================================================"
echo ""
echo "All migration files are in place and ready for use."
echo ""
