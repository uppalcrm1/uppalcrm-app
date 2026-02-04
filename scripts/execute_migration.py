#!/usr/bin/env python3
"""
Comprehensive Migration Execution and Testing Script
Database: uppalcrm_devtest
Purpose: Execute and test the software_licenses -> accounts migration
"""

import psycopg2
import os
import sys
import time
from datetime import datetime
from typing import Dict, List, Tuple, Optional

# Database connection details
DB_CONFIG = {
    'host': 'dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com',
    'port': 5432,
    'database': 'uppalcrm_devtest',
    'user': 'uppalcrm_devtest',
    'password': 'YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs'
}

# Test counters
tests_passed = 0
tests_failed = 0
tests_total = 0

# Report file
timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
report_file = f"migration_test_report_{timestamp}.txt"

class MigrationTester:
    def __init__(self):
        self.conn = None
        self.cursor = None
        self.start_time = None
        self.pre_migration_data = {}

    def connect(self) -> bool:
        """Connect to the database"""
        try:
            self.conn = psycopg2.connect(**DB_CONFIG)
            self.cursor = self.conn.cursor()
            return True
        except Exception as e:
            self.log_failure(f"Failed to connect to database: {e}")
            return False

    def disconnect(self):
        """Disconnect from database"""
        if self.cursor:
            self.cursor.close()
        if self.conn:
            self.conn.close()

    def execute_query(self, query: str) -> Optional[List]:
        """Execute a query and return results"""
        try:
            self.cursor.execute(query)
            return self.cursor.fetchall()
        except Exception as e:
            print(f"Query error: {e}")
            return None

    def execute_script(self, script_path: str) -> bool:
        """Execute a SQL script"""
        try:
            with open(script_path, 'r') as f:
                script = f.read()

            # Split by GO or semicolon for multiple statements
            statements = script.split(';')

            for statement in statements:
                statement = statement.strip()
                if statement:
                    try:
                        self.cursor.execute(statement)
                    except Exception as e:
                        # Log but continue with other statements
                        print(f"Statement error: {e}")

            self.conn.commit()
            return True
        except Exception as e:
            self.conn.rollback()
            self.log_failure(f"Failed to execute script: {e}")
            return False

    def log(self, message: str):
        """Log message to both console and file"""
        print(message)
        with open(report_file, 'a') as f:
            f.write(message + '\n')

    def log_section(self, title: str):
        """Log a section header"""
        msg = f"\n{'='*70}\n{title}\n{'='*70}"
        self.log(msg)

    def log_success(self, message: str):
        """Log a successful test"""
        global tests_passed, tests_total
        self.log(f"[PASS] {message}")
        tests_passed += 1
        tests_total += 1

    def log_failure(self, message: str):
        """Log a failed test"""
        global tests_failed, tests_total
        self.log(f"[FAIL] {message}")
        tests_failed += 1
        tests_total += 1

    def log_info(self, message: str):
        """Log info message"""
        global tests_total
        self.log(f"[INFO] {message}")
        tests_total += 1

    def log_warning(self, message: str):
        """Log warning message"""
        self.log(f"[WARN] {message}")

    def test_connection(self) -> bool:
        """Test database connection"""
        self.log_section("TEST 1: DATABASE CONNECTION")

        try:
            result = self.execute_query("SELECT version();")
            if result:
                self.log_success("Successfully connected to devtest database")
                self.log(f"[INFO] PostgreSQL Version: {result[0][0]}")
                return True
            else:
                self.log_failure("Failed to connect to database")
                return False
        except Exception as e:
            self.log_failure(f"Connection test failed: {e}")
            return False

    def check_pre_migration_state(self) -> bool:
        """Check the state before migration"""
        self.log_section("TEST 2: PRE-MIGRATION STATE INSPECTION")

        # Check if software_licenses table exists
        result = self.execute_query("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'software_licenses'
            );
        """)

        if result and result[0][0]:
            self.log_success("software_licenses table exists")

            # Get pre-migration stats
            result = self.execute_query("SELECT COUNT(*) FROM public.software_licenses;")
            if result:
                count = result[0][0]
                self.pre_migration_data['record_count'] = count
                self.log(f"[INFO] Record count: {count}")

            # Get FK count
            result = self.execute_query("""
                SELECT COUNT(*) FROM information_schema.table_constraints
                WHERE table_schema = 'public' AND table_name = 'software_licenses'
                AND constraint_type = 'FOREIGN KEY';
            """)
            if result:
                self.pre_migration_data['fk_count'] = result[0][0]
                self.log(f"[INFO] Foreign keys: {result[0][0]}")

            # Get index count
            result = self.execute_query("""
                SELECT COUNT(*) FROM pg_indexes
                WHERE tablename = 'software_licenses' AND schemaname = 'public'
                AND indexname NOT LIKE '%_pkey';
            """)
            if result:
                self.pre_migration_data['index_count'] = result[0][0]
                self.log(f"[INFO] Indexes: {result[0][0]}")

            return True
        else:
            self.log_warning("software_licenses table does NOT exist - migration may have been run already")
            return False

    def check_accounts_not_exists(self) -> bool:
        """Check that accounts table doesn't exist yet"""
        result = self.execute_query("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'accounts'
            );
        """)

        if result and not result[0][0]:
            self.log_success("accounts table does not exist yet (safe to migrate)")
            return True
        else:
            self.log_warning("accounts table already exists")
            return False

    def execute_migration(self) -> bool:
        """Execute the migration script"""
        self.log_section("TEST 3: EXECUTING MIGRATION SCRIPT")

        script_path = './scripts/migration_software_licenses_to_accounts_v2.sql'

        if not os.path.exists(script_path):
            self.log_failure(f"Migration script not found: {script_path}")
            return False

        self.log(f"[INFO] Executing migration script: {script_path}")
        self.start_time = time.time()

        try:
            with open(script_path, 'r') as f:
                script = f.read()

            # Execute the entire script
            self.cursor.execute(script)
            self.conn.commit()

            elapsed = time.time() - self.start_time
            self.log_success(f"Migration script executed successfully in {elapsed:.2f} seconds")
            return True
        except Exception as e:
            self.conn.rollback()
            self.log_failure(f"Migration execution failed: {e}")
            return False

    def check_post_migration_state(self) -> bool:
        """Check the state after migration"""
        self.log_section("TEST 4: POST-MIGRATION STATE INSPECTION")

        # Check if accounts table exists
        result = self.execute_query("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'accounts'
            );
        """)

        if not (result and result[0][0]):
            self.log_failure("accounts table does not exist after migration")
            return False

        self.log_success("accounts table exists and is accessible")

        # Check if software_licenses still exists
        result = self.execute_query("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'software_licenses'
                AND table_type = 'BASE TABLE'
            );
        """)

        if result and result[0][0]:
            self.log_failure("software_licenses table still exists - rename may have failed")
            return False

        self.log_success("software_licenses table no longer exists")

        # Check if backup exists
        result = self.execute_query("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'software_licenses_backup'
            );
        """)

        if result and result[0][0]:
            self.log_success("Backup table (software_licenses_backup) exists")
        else:
            self.log_warning("Backup table does not exist")

        return True

    def verify_data_integrity(self) -> bool:
        """Verify data integrity"""
        self.log_section("TEST 5: DATA INTEGRITY VERIFICATION")

        # Get post-migration record count
        result = self.execute_query("SELECT COUNT(*) FROM public.accounts;")
        if not result:
            self.log_failure("Could not get post-migration record count")
            return False

        post_count = result[0][0]
        self.log(f"[INFO] Post-migration record count: {post_count}")

        # Compare with backup
        result = self.execute_query("SELECT COUNT(*) FROM public.software_licenses_backup;")
        if result:
            backup_count = result[0][0]
            if post_count == backup_count:
                self.log_success(f"Record count matches: {post_count} == {backup_count}")
            else:
                self.log_failure(f"Record count mismatch: {post_count} != {backup_count}")
                return False

        # Compare with pre-migration count
        if 'record_count' in self.pre_migration_data:
            if post_count == self.pre_migration_data['record_count']:
                self.log_success(f"Record count preserved: {post_count}")
            else:
                self.log_failure(f"Record count changed: {self.pre_migration_data['record_count']} -> {post_count}")

        # Check for duplicates
        result = self.execute_query("""
            SELECT COUNT(*) FROM (
                SELECT id FROM public.accounts GROUP BY id HAVING COUNT(*) > 1
            ) t;
        """)

        if result and result[0][0] == 0:
            self.log_success("No duplicate records found")
        else:
            self.log_failure(f"Found {result[0][0]} duplicate records")

        # Check for NULL ids
        result = self.execute_query("SELECT COUNT(*) FROM public.accounts WHERE id IS NULL;")
        if result and result[0][0] == 0:
            self.log_success("No NULL values in id column")
        else:
            self.log_failure(f"Found {result[0][0]} NULL values in id column")

        return True

    def verify_foreign_keys(self) -> bool:
        """Verify foreign keys"""
        self.log_section("TEST 6: FOREIGN KEY VERIFICATION")

        result = self.execute_query("""
            SELECT COUNT(*) FROM information_schema.table_constraints
            WHERE table_schema = 'public' AND table_name = 'accounts'
            AND constraint_type = 'FOREIGN KEY';
        """)

        if not result:
            self.log_failure("Could not count foreign keys")
            return False

        fk_count = result[0][0]
        self.log(f"[INFO] Foreign keys found: {fk_count}")

        if fk_count == 6:
            self.log_success(f"Expected 6 foreign keys, found {fk_count}")
        else:
            self.log_failure(f"Expected 6 foreign keys, found {fk_count}")

        # List FKs
        result = self.execute_query("""
            SELECT constraint_name, table_name, column_name
            FROM information_schema.key_column_usage
            WHERE table_schema = 'public' AND table_name = 'accounts'
            ORDER BY constraint_name;
        """)

        if result:
            self.log("[INFO] Foreign key details:")
            for row in result:
                self.log(f"    - {row[0]}: {row[1]}.{row[2]}")

        return fk_count == 6

    def verify_indexes(self) -> bool:
        """Verify indexes"""
        self.log_section("TEST 7: INDEX VERIFICATION")

        result = self.execute_query("""
            SELECT COUNT(*) FROM pg_indexes
            WHERE tablename = 'accounts' AND schemaname = 'public'
            AND indexname NOT LIKE '%_pkey';
        """)

        if not result:
            self.log_failure("Could not count indexes")
            return False

        index_count = result[0][0]
        self.log(f"[INFO] Indexes found: {index_count}")

        if index_count == 5:
            self.log_success(f"Expected 5 indexes, found {index_count}")
        else:
            self.log_failure(f"Expected 5 indexes, found {index_count}")

        # List indexes
        result = self.execute_query("""
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'accounts' AND schemaname = 'public'
            ORDER BY indexname;
        """)

        if result:
            self.log("[INFO] Index names:")
            for row in result:
                self.log(f"    - {row[0]}")

        return index_count == 5

    def verify_policies_and_triggers(self) -> bool:
        """Verify RLS policies and triggers"""
        self.log_section("TEST 8: POLICY AND TRIGGER VERIFICATION")

        # Check RLS policies
        result = self.execute_query("""
            SELECT COUNT(*) FROM pg_policies
            WHERE tablename = 'accounts' AND schemaname = 'public';
        """)

        if result:
            policy_count = result[0][0]
            self.log(f"[INFO] RLS policies found: {policy_count}")

            if policy_count > 0:
                self.log_success(f"RLS policies exist ({policy_count})")

                # List policies
                result = self.execute_query("""
                    SELECT policyname FROM pg_policies
                    WHERE tablename = 'accounts' AND schemaname = 'public'
                    ORDER BY policyname;
                """)

                if result:
                    self.log("[INFO] Policy names:")
                    for row in result:
                        self.log(f"    - {row[0]}")
            else:
                self.log_warning("No RLS policies found")

        # Check triggers
        result = self.execute_query("""
            SELECT COUNT(*) FROM information_schema.triggers
            WHERE event_object_schema = 'public' AND event_object_table = 'accounts';
        """)

        if result:
            trigger_count = result[0][0]
            self.log(f"[INFO] Triggers found: {trigger_count}")

            if trigger_count > 0:
                self.log_success(f"Triggers exist ({trigger_count})")

                # List triggers
                result = self.execute_query("""
                    SELECT trigger_name FROM information_schema.triggers
                    WHERE event_object_schema = 'public' AND event_object_table = 'accounts'
                    ORDER BY trigger_name;
                """)

                if result:
                    self.log("[INFO] Trigger names:")
                    for row in result:
                        self.log(f"    - {row[0]}")
            else:
                self.log_warning("No triggers found")

        return True

    def verify_functional_tests(self) -> bool:
        """Run functional tests"""
        self.log_section("TEST 9: FUNCTIONAL VERIFICATION")

        # Test 1: Can read from accounts
        try:
            result = self.execute_query("SELECT COUNT(*) FROM public.accounts;")
            if result:
                self.log_success(f"Can read from accounts table ({result[0][0]} records)")
            else:
                self.log_failure("Cannot read from accounts table")
                return False
        except Exception as e:
            self.log_failure(f"Read from accounts failed: {e}")
            return False

        # Test 2: Cannot read from old table
        try:
            self.cursor.execute("SELECT COUNT(*) FROM public.software_licenses;")
            self.log_failure("software_licenses query should have failed but didn't")
            return False
        except psycopg2.errors.UndefinedTable:
            self.log_success("software_licenses query correctly raises UndefinedTable error")
        except Exception as e:
            self.log_success(f"software_licenses query correctly fails: {type(e).__name__}")

        # Test 3: Get sample data
        try:
            result = self.execute_query("SELECT COUNT(*) as columns FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts';")
            if result:
                self.log_success(f"accounts table has {result[0][0]} columns")

            # Get first row
            result = self.execute_query("SELECT * FROM public.accounts LIMIT 1;")
            if result:
                self.log("[INFO] Sample data retrieved successfully")
        except Exception as e:
            self.log_failure(f"Cannot retrieve sample data: {e}")

        return True

    def run_all_tests(self) -> int:
        """Run all tests"""
        # Clear report file
        open(report_file, 'w').close()

        self.log_section(f"MIGRATION TEST SUITE - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Connect to database
        if not self.connect():
            return 1

        try:
            # Run tests
            if not self.test_connection():
                return 1

            if not self.check_pre_migration_state():
                self.log_warning("Pre-migration check incomplete - table may have been migrated already")

            if not self.check_accounts_not_exists():
                self.log_warning("accounts table already exists")

            if not self.execute_migration():
                return 1

            if not self.check_post_migration_state():
                return 1

            if not self.verify_data_integrity():
                return 1

            if not self.verify_foreign_keys():
                return 1

            if not self.verify_indexes():
                return 1

            self.verify_policies_and_triggers()
            self.verify_functional_tests()

            # Summary
            self.log_section("TEST SUMMARY")
            self.log(f"Total Tests: {tests_total}")
            self.log(f"Passed: {tests_passed}")
            self.log(f"Failed: {tests_failed}")
            self.log("")

            if tests_failed == 0:
                self.log("[SUCCESS] ALL TESTS PASSED")
                return 0
            else:
                self.log(f"[FAILURE] {tests_failed} TEST(S) FAILED")
                return 1

        finally:
            self.disconnect()
            self.log(f"\n[INFO] Report saved to: {report_file}")

if __name__ == '__main__':
    tester = MigrationTester()
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)
