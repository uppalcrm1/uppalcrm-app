#!/usr/bin/env python3
"""
Migration Orchestration Script: software_licenses -> accounts
Database: uppalcrm_devtest
"""

import psycopg2
import psycopg2.extras
import sys
import json
from datetime import datetime
from typing import Tuple, List, Dict, Any

# Database connection details
DB_HOST = "dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com"
DB_PORT = 5432
DB_NAME = "uppalcrm_devtest"
DB_USER = "uppalcrm_devtest"
DB_PASSWORD = "YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs"

# Report data structure
REPORT = {
    "migration_timestamp": datetime.now().isoformat(),
    "database": DB_NAME,
    "migration_type": "Rename software_licenses to accounts",
    "pre_migration_state": {},
    "migration_log": [],
    "post_migration_state": {},
    "validation_tests": {},
    "data_counts": {},
    "issues": [],
    "success": False,
}

def log_message(message: str, level: str = "INFO") -> None:
    """Log a message with timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] [{level}] {message}")
    REPORT["migration_log"].append({"timestamp": timestamp, "level": level, "message": message})

def connect_to_db() -> psycopg2.extensions.connection:
    """Establish database connection."""
    try:
        log_message("Attempting to connect to database...")
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            sslmode='require'
        )
        log_message("Successfully connected to database", "SUCCESS")
        return conn
    except Exception as e:
        log_message(f"Failed to connect to database: {str(e)}", "ERROR")
        raise

def get_pre_migration_state(conn: psycopg2.extensions.connection) -> Dict[str, Any]:
    """Collect pre-migration state of the database."""
    log_message("Collecting pre-migration state...")
    state = {}

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Check if software_licenses table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'software_licenses'
                ) as exists;
            """)
            state["software_licenses_exists"] = cur.fetchone()["exists"]
            log_message(f"  software_licenses table exists: {state['software_licenses_exists']}")

            # Record count
            if state["software_licenses_exists"]:
                cur.execute("SELECT COUNT(*) as count FROM public.software_licenses;")
                state["record_count_before"] = cur.fetchone()["count"]
                log_message(f"  Records in software_licenses: {state['record_count_before']}")

                # Get foreign keys
                cur.execute("""
                    SELECT constraint_name, table_name, column_name
                    FROM information_schema.key_column_usage
                    WHERE table_schema = 'public'
                    AND table_name IN (
                        SELECT table_name FROM information_schema.tables
                        WHERE table_schema = 'public'
                    )
                    AND column_name IN (
                        SELECT column_name FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'software_licenses'
                    )
                    ORDER BY constraint_name;
                """)
                state["foreign_keys_before"] = [dict(row) for row in cur.fetchall()]
                log_message(f"  Foreign keys found: {len(state['foreign_keys_before'])}")

                # Get indexes
                cur.execute("""
                    SELECT indexname FROM pg_indexes
                    WHERE tablename = 'software_licenses' AND schemaname = 'public'
                    AND indexname NOT LIKE '%_pkey'
                    ORDER BY indexname;
                """)
                state["indexes_before"] = [row[0] for row in cur.fetchall()]
                log_message(f"  Indexes found: {len(state['indexes_before'])}")

                # Get RLS policies
                cur.execute("""
                    SELECT policyname FROM pg_policies
                    WHERE tablename = 'software_licenses' AND schemaname = 'public'
                    ORDER BY policyname;
                """)
                state["rls_policies_before"] = [row[0] for row in cur.fetchall()]
                log_message(f"  RLS policies found: {len(state['rls_policies_before'])}")

                # Get triggers
                cur.execute("""
                    SELECT trigger_name FROM information_schema.triggers
                    WHERE event_object_schema = 'public'
                    AND event_object_table = 'software_licenses'
                    ORDER BY trigger_name;
                """)
                state["triggers_before"] = [row[0] for row in cur.fetchall()]
                log_message(f"  Triggers found: {len(state['triggers_before'])}")

    except Exception as e:
        log_message(f"Error collecting pre-migration state: {str(e)}", "ERROR")
        raise

    REPORT["pre_migration_state"] = state
    return state

def get_post_migration_state(conn: psycopg2.extensions.connection) -> Dict[str, Any]:
    """Collect post-migration state of the database."""
    log_message("Collecting post-migration state...")
    state = {}

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Check if accounts table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'accounts'
                ) as exists;
            """)
            state["accounts_exists"] = cur.fetchone()["exists"]
            log_message(f"  accounts table exists: {state['accounts_exists']}")

            # Check if old table still exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'software_licenses'
                    AND table_type = 'BASE TABLE'
                ) as exists;
            """)
            state["software_licenses_still_exists"] = cur.fetchone()["exists"]
            log_message(f"  software_licenses table still exists: {state['software_licenses_still_exists']}")

            # Record count
            if state["accounts_exists"]:
                cur.execute("SELECT COUNT(*) as count FROM public.accounts;")
                state["record_count_after"] = cur.fetchone()["count"]
                log_message(f"  Records in accounts: {state['record_count_after']}")

                # Get foreign keys
                cur.execute("""
                    SELECT constraint_name, table_name
                    FROM information_schema.table_constraints
                    WHERE table_schema = 'public'
                    AND table_name = 'accounts'
                    AND constraint_type = 'FOREIGN KEY'
                    ORDER BY constraint_name;
                """)
                state["foreign_keys_after"] = [dict(row) for row in cur.fetchall()]
                log_message(f"  Foreign keys on accounts: {len(state['foreign_keys_after'])}")

                # Get indexes
                cur.execute("""
                    SELECT indexname FROM pg_indexes
                    WHERE tablename = 'accounts' AND schemaname = 'public'
                    AND indexname NOT LIKE '%_pkey'
                    ORDER BY indexname;
                """)
                state["indexes_after"] = [row[0] for row in cur.fetchall()]
                log_message(f"  Indexes on accounts: {len(state['indexes_after'])}")

                # Get RLS policies
                cur.execute("""
                    SELECT policyname FROM pg_policies
                    WHERE tablename = 'accounts' AND schemaname = 'public'
                    ORDER BY policyname;
                """)
                state["rls_policies_after"] = [row[0] for row in cur.fetchall()]
                log_message(f"  RLS policies on accounts: {len(state['rls_policies_after'])}")

                # Get triggers
                cur.execute("""
                    SELECT trigger_name FROM information_schema.triggers
                    WHERE event_object_schema = 'public'
                    AND event_object_table = 'accounts'
                    ORDER BY trigger_name;
                """)
                state["triggers_after"] = [row[0] for row in cur.fetchall()]
                log_message(f"  Triggers on accounts: {len(state['triggers_after'])}")

                # Get backup table count
                cur.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'software_licenses_backup'
                    ) as exists;
                """)
                if cur.fetchone()["exists"]:
                    cur.execute("SELECT COUNT(*) as count FROM public.software_licenses_backup;")
                    state["backup_record_count"] = cur.fetchone()["count"]
                    log_message(f"  Records in backup: {state['backup_record_count']}")

    except Exception as e:
        log_message(f"Error collecting post-migration state: {str(e)}", "ERROR")
        raise

    REPORT["post_migration_state"] = state
    return state

def execute_migration_script(conn: psycopg2.extensions.connection, script_path: str) -> bool:
    """Execute the migration script."""
    log_message("Starting migration execution...")

    try:
        with open(script_path, 'r') as f:
            migration_script = f.read()

        with conn.cursor() as cur:
            cur.execute(migration_script)
            conn.commit()

        log_message("Migration script executed successfully", "SUCCESS")
        return True

    except Exception as e:
        log_message(f"Error executing migration script: {str(e)}", "ERROR")
        conn.rollback()
        REPORT["issues"].append(f"Migration script execution failed: {str(e)}")
        return False

def run_validation_tests(conn: psycopg2.extensions.connection) -> Dict[str, bool]:
    """Run comprehensive validation tests."""
    log_message("Running validation tests...")
    tests = {}

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            # Test 1: accounts table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'accounts'
                ) as result;
            """)
            tests["accounts_table_exists"] = cur.fetchone()["result"]
            log_message(f"  Test 1 - accounts table exists: {tests['accounts_table_exists']}")

            # Test 2: old table doesn't exist
            cur.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'software_licenses'
                    AND table_type = 'BASE TABLE'
                ) as result;
            """)
            tests["old_table_removed"] = not cur.fetchone()["result"]
            log_message(f"  Test 2 - software_licenses table removed: {tests['old_table_removed']}")

            # Test 3: record counts match
            cur.execute("""
                SELECT
                    (SELECT COUNT(*) FROM public.accounts) as accounts_count,
                    (SELECT COUNT(*) FROM public.software_licenses_backup) as backup_count;
            """)
            row = cur.fetchone()
            tests["record_count_match"] = row["accounts_count"] == row["backup_count"]
            REPORT["data_counts"]["accounts"] = row["accounts_count"]
            REPORT["data_counts"]["backup"] = row["backup_count"]
            log_message(f"  Test 3 - record counts match: {tests['record_count_match']} ({row['accounts_count']} records)")

            # Test 4: can query accounts table
            try:
                cur.execute("SELECT COUNT(*) as count FROM public.accounts;")
                tests["query_accounts_works"] = True
                log_message(f"  Test 4 - can query accounts table: True")
            except:
                tests["query_accounts_works"] = False
                log_message(f"  Test 4 - can query accounts table: False", "WARNING")

            # Test 5: old table name doesn't work
            try:
                cur.execute("SELECT COUNT(*) as count FROM public.software_licenses;")
                tests["old_table_inaccessible"] = False
                log_message(f"  Test 5 - old table is inaccessible: False", "WARNING")
            except:
                tests["old_table_inaccessible"] = True
                conn.rollback()  # Reset transaction after expected error
                log_message(f"  Test 5 - old table is inaccessible: True")

            # Test 6: no NULL IDs
            cur.execute("""
                SELECT COUNT(*) as count FROM public.accounts WHERE id IS NULL;
            """)
            null_count = cur.fetchone()["count"]
            tests["no_null_ids"] = null_count == 0
            log_message(f"  Test 6 - no NULL IDs: {tests['no_null_ids']}")

            # Test 7: foreign keys count
            cur.execute("""
                SELECT COUNT(*) as count
                FROM information_schema.table_constraints
                WHERE table_schema = 'public'
                AND table_name = 'accounts'
                AND constraint_type = 'FOREIGN KEY';
            """)
            fk_count = cur.fetchone()["count"]
            tests["foreign_keys_exist"] = fk_count > 0
            log_message(f"  Test 7 - foreign keys exist: {tests['foreign_keys_exist']} ({fk_count} found)")

            # Test 8: indexes exist
            cur.execute("""
                SELECT COUNT(*) as count
                FROM pg_indexes
                WHERE tablename = 'accounts' AND schemaname = 'public'
                AND indexname NOT LIKE '%_pkey';
            """)
            index_count = cur.fetchone()["count"]
            tests["indexes_exist"] = index_count > 0
            log_message(f"  Test 8 - indexes exist: {tests['indexes_exist']} ({index_count} found)")

    except Exception as e:
        log_message(f"Error running validation tests: {str(e)}", "ERROR")
        REPORT["issues"].append(f"Validation test error: {str(e)}")

    REPORT["validation_tests"] = tests
    return tests

def generate_report(output_file: str) -> None:
    """Generate and save the comprehensive report."""
    log_message("Generating comprehensive report...")

    # Determine overall success
    all_tests_passed = all(REPORT["validation_tests"].values())
    REPORT["success"] = all_tests_passed and len(REPORT["issues"]) == 0

    report_content = f"""
{'='*80}
MIGRATION REPORT: software_licenses -> accounts
{'='*80}

MIGRATION DETAILS
{'-'*80}
Timestamp: {REPORT['migration_timestamp']}
Database: {REPORT['database']}
Migration Type: {REPORT['migration_type']}
Status: {'SUCCESS' if REPORT['success'] else 'FAILED'}

PRE-MIGRATION STATE
{'-'*80}
Software Licenses Table Exists: {REPORT['pre_migration_state'].get('software_licenses_exists', 'N/A')}
Record Count: {REPORT['pre_migration_state'].get('record_count_before', 'N/A')}
Foreign Keys: {len(REPORT['pre_migration_state'].get('foreign_keys_before', []))}
Indexes: {len(REPORT['pre_migration_state'].get('indexes_before', []))}
RLS Policies: {len(REPORT['pre_migration_state'].get('rls_policies_before', []))}
Triggers: {len(REPORT['pre_migration_state'].get('triggers_before', []))}

POST-MIGRATION STATE
{'-'*80}
Accounts Table Exists: {REPORT['post_migration_state'].get('accounts_exists', 'N/A')}
Software Licenses Table Still Exists: {REPORT['post_migration_state'].get('software_licenses_still_exists', 'N/A')}
Record Count: {REPORT['post_migration_state'].get('record_count_after', 'N/A')}
Foreign Keys: {len(REPORT['post_migration_state'].get('foreign_keys_after', []))}
Indexes: {len(REPORT['post_migration_state'].get('indexes_after', []))}
RLS Policies: {len(REPORT['post_migration_state'].get('rls_policies_after', []))}
Triggers: {len(REPORT['post_migration_state'].get('triggers_after', []))}
Backup Table Record Count: {REPORT['post_migration_state'].get('backup_record_count', 'N/A')}

DATA VALIDATION
{'-'*80}
Records in accounts: {REPORT['data_counts'].get('accounts', 'N/A')}
Records in backup: {REPORT['data_counts'].get('backup', 'N/A')}

VALIDATION TESTS
{'-'*80}
"""

    for test_name, result in REPORT["validation_tests"].items():
        status = "PASS" if result else "FAIL"
        report_content += f"{test_name.replace('_', ' ').title()}: {status}\n"

    if REPORT["issues"]:
        report_content += f"""
ISSUES ENCOUNTERED
{'-'*80}
"""
        for issue in REPORT["issues"]:
            report_content += f"- {issue}\n"

    report_content += f"""
MIGRATION LOG
{'-'*80}
"""
    for log_entry in REPORT["migration_log"]:
        report_content += f"[{log_entry['timestamp']}] [{log_entry['level']}] {log_entry['message']}\n"

    report_content += f"""
ROLLBACK INSTRUCTIONS
{'-'*80}
To rollback this migration:
1. Run: DROP TABLE public.accounts CASCADE;
2. Run: ALTER TABLE public.software_licenses_backup RENAME TO software_licenses;
3. Recreate any dropped objects (triggers, policies, etc.)

{'='*80}
"""

    with open(output_file, 'w') as f:
        f.write(report_content)

    log_message(f"Report saved to {output_file}", "SUCCESS")

    # Also save JSON version
    json_file = output_file.replace('.txt', '.json')
    with open(json_file, 'w') as f:
        json.dump(REPORT, f, indent=2, default=str)
    log_message(f"JSON report saved to {json_file}", "SUCCESS")

def main():
    """Main orchestration function."""
    print(f"\n{'='*80}")
    print("DATABASE MIGRATION ORCHESTRATION: software_licenses -> accounts")
    print(f"{'='*80}\n")

    start_time = datetime.now()
    conn = None

    try:
        # Step 1: Connect to database
        conn = connect_to_db()

        # Step 2: Get pre-migration state
        pre_state = get_pre_migration_state(conn)

        if not pre_state.get("software_licenses_exists"):
            log_message("software_licenses table does not exist. Aborting migration.", "ERROR")
            REPORT["issues"].append("Source table software_licenses does not exist")
            return False

        # Step 3: Execute migration
        migration_success = execute_migration_script(conn, "/c/Users/uppal/uppal-crm-project/scripts/migration_software_licenses_to_accounts.sql")

        if not migration_success:
            log_message("Migration script execution failed. Aborting.", "ERROR")
            return False

        # Step 4: Get post-migration state
        conn = connect_to_db()  # Reconnect to ensure fresh state
        post_state = get_post_migration_state(conn)

        # Step 5: Run validation tests
        validation_results = run_validation_tests(conn)

        # Step 6: Generate report
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        REPORT["migration_duration_seconds"] = duration

        output_file = "/c/Users/uppal/uppal-crm-project/scripts/migration_report.txt"
        generate_report(output_file)

        # Step 7: Print summary
        print(f"\n{'='*80}")
        print("MIGRATION EXECUTION SUMMARY")
        print(f"{'='*80}")
        print(f"Duration: {duration:.2f} seconds")
        print(f"Status: {'SUCCESS' if REPORT['success'] else 'FAILED'}")
        print(f"Validation Tests: {sum(validation_results.values())}/{len(validation_results)} passed")
        print(f"Issues Found: {len(REPORT['issues'])}")
        print(f"\nReport saved to: {output_file}")
        print(f"{'='*80}\n")

        return REPORT["success"]

    except Exception as e:
        log_message(f"Fatal error during migration: {str(e)}", "FATAL")
        REPORT["issues"].append(f"Fatal error: {str(e)}")
        return False

    finally:
        if conn:
            conn.close()
            log_message("Database connection closed")

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
