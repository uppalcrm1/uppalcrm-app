#!/usr/bin/env node

/**
 * Migration Orchestration Script: software_licenses -> accounts
 * Database: uppalcrm_devtest
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
    host: 'dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'uppalcrm_devtest',
    user: 'uppalcrm_devtest',
    password: 'YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs',
    ssl: { rejectUnauthorized: false }
};

const MIGRATION_SCRIPT = path.join(__dirname, 'migration_software_licenses_to_accounts.sql');
const REPORT_FILE = path.join(__dirname, 'migration_report.txt');
const PRE_STATE_FILE = path.join(__dirname, 'pre_migration_state.txt');
const POST_STATE_FILE = path.join(__dirname, 'post_migration_state.txt');

let reportContent = '';
let preStateContent = '';
let postStateContent = '';

const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m'
};

function logMessage(level, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
    let color = COLORS.reset;

    switch (level) {
        case 'SUCCESS':
            color = COLORS.green;
            break;
        case 'ERROR':
            color = COLORS.red;
            break;
        case 'WARNING':
            color = COLORS.yellow;
            break;
    }

    const output = `${color}[${timestamp}] [${level}] ${message}${COLORS.reset}`;
    console.log(output);
    reportContent += `[${timestamp}] [${level}] ${message}\n`;
}

async function testConnection(client) {
    logMessage('INFO', 'Testing database connection...');
    try {
        const res = await client.query('SELECT 1 as test');
        logMessage('SUCCESS', 'Database connection successful');
        return true;
    } catch (error) {
        logMessage('ERROR', `Database connection failed: ${error.message}`);
        return false;
    }
}

async function collectPreMigrationState(client) {
    logMessage('INFO', 'Collecting pre-migration state...');
    preStateContent += '='.repeat(80) + '\n';
    preStateContent += 'PRE-MIGRATION STATE\n';
    preStateContent += '='.repeat(80) + '\n\n';

    try {
        // Check if software_licenses table exists
        let res = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'software_licenses'
            ) as exists;
        `);
        const tableExists = res.rows[0].exists;
        preStateContent += `1. software_licenses table exists: ${tableExists}\n\n`;
        logMessage('INFO', `  software_licenses table exists: ${tableExists}`);

        if (!tableExists) {
            logMessage('WARNING', '  software_licenses table does not exist - cannot proceed');
            return false;
        }

        // Record count
        res = await client.query('SELECT COUNT(*) as count FROM public.software_licenses');
        const recordCount = res.rows[0].count;
        preStateContent += `2. Record count: ${recordCount}\n\n`;
        logMessage('INFO', `  Records: ${recordCount}`);

        // Foreign keys
        res = await client.query(`
            SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND kcu.table_schema = 'public'
            ORDER BY tc.table_name, tc.constraint_name;
        `);
        preStateContent += `3. Foreign Keys:\n`;
        preStateContent += JSON.stringify(res.rows, null, 2) + '\n\n';
        logMessage('INFO', `  Foreign Keys: ${res.rows.length}`);

        // Indexes
        res = await client.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'software_licenses' AND schemaname = 'public'
            ORDER BY indexname;
        `);
        preStateContent += `4. Indexes:\n`;
        res.rows.forEach(row => preStateContent += `   - ${row.indexname}\n`);
        preStateContent += '\n';
        logMessage('INFO', `  Indexes: ${res.rows.length}`);

        // RLS Policies
        res = await client.query(`
            SELECT policyname FROM pg_policies
            WHERE tablename = 'software_licenses' AND schemaname = 'public'
            ORDER BY policyname;
        `);
        preStateContent += `5. RLS Policies:\n`;
        res.rows.forEach(row => preStateContent += `   - ${row.policyname}\n`);
        preStateContent += '\n';
        logMessage('INFO', `  RLS Policies: ${res.rows.length}`);

        // Triggers
        res = await client.query(`
            SELECT trigger_name FROM information_schema.triggers
            WHERE event_object_schema = 'public' AND event_object_table = 'software_licenses'
            ORDER BY trigger_name;
        `);
        preStateContent += `6. Triggers:\n`;
        res.rows.forEach(row => preStateContent += `   - ${row.trigger_name}\n`);
        preStateContent += '\n';
        logMessage('INFO', `  Triggers: ${res.rows.length}`);

        fs.writeFileSync(PRE_STATE_FILE, preStateContent);
        logMessage('SUCCESS', `Pre-migration state saved to ${PRE_STATE_FILE}`);
        return true;

    } catch (error) {
        logMessage('ERROR', `Error collecting pre-migration state: ${error.message}`);
        return false;
    }
}

async function runMigration(client) {
    logMessage('INFO', 'Executing migration script...');

    try {
        const migrationScript = fs.readFileSync(MIGRATION_SCRIPT, 'utf-8');

        // Execute migration script
        await client.query(migrationScript);

        logMessage('SUCCESS', 'Migration script executed successfully');
        reportContent += '\n' + '='.repeat(80) + '\n';
        reportContent += 'MIGRATION EXECUTION LOG\n';
        reportContent += '='.repeat(80) + '\n';
        reportContent += 'Migration executed successfully\n';
        return true;

    } catch (error) {
        logMessage('ERROR', `Migration script failed: ${error.message}`);
        reportContent += `Migration Error: ${error.message}\n`;
        return false;
    }
}

async function collectPostMigrationState(client) {
    logMessage('INFO', 'Collecting post-migration state...');
    postStateContent += '='.repeat(80) + '\n';
    postStateContent += 'POST-MIGRATION STATE\n';
    postStateContent += '='.repeat(80) + '\n\n';

    try {
        // Check if accounts table exists
        let res = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'accounts'
            ) as exists;
        `);
        const accountsExists = res.rows[0].exists;
        postStateContent += `1. accounts table exists: ${accountsExists}\n\n`;
        logMessage('INFO', `  accounts table exists: ${accountsExists}`);

        if (!accountsExists) {
            logMessage('WARNING', '  accounts table does not exist - migration may have failed');
            return false;
        }

        // Check if old table still exists
        res = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'software_licenses'
                AND table_type = 'BASE TABLE'
            ) as exists;
        `);
        const oldTableExists = res.rows[0].exists;
        postStateContent += `2. software_licenses table still exists: ${oldTableExists}\n\n`;
        logMessage('INFO', `  software_licenses table still exists: ${oldTableExists}`);

        // Record count in accounts
        res = await client.query('SELECT COUNT(*) as count FROM public.accounts');
        const accountsCount = res.rows[0].count;
        postStateContent += `3. Records in accounts: ${accountsCount}\n\n`;
        logMessage('INFO', `  Records in accounts: ${accountsCount}`);

        // Record count in backup
        res = await client.query('SELECT COUNT(*) as count FROM public.software_licenses_backup');
        const backupCount = res.rows[0].count;
        postStateContent += `4. Records in backup: ${backupCount}\n\n`;
        logMessage('INFO', `  Records in backup: ${backupCount}`);

        // Verify match
        postStateContent += `5. Count Match: ${accountsCount === parseInt(backupCount) ? 'YES' : 'NO'}\n\n`;
        logMessage('INFO', `  Count Match: ${accountsCount === parseInt(backupCount) ? 'YES' : 'NO'}`);

        // Foreign keys
        res = await client.query(`
            SELECT
                tc.constraint_name,
                tc.table_name
            FROM information_schema.table_constraints AS tc
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND tc.table_name = 'accounts'
            ORDER BY tc.constraint_name;
        `);
        postStateContent += `6. Foreign Keys on accounts (Expected: 6):\n`;
        res.rows.forEach(row => postStateContent += `   - ${row.constraint_name}\n`);
        postStateContent += `   Total: ${res.rows.length}\n\n`;
        logMessage('INFO', `  Foreign Keys on accounts: ${res.rows.length} (expected 6)`);

        // Indexes
        res = await client.query(`
            SELECT indexname FROM pg_indexes
            WHERE tablename = 'accounts' AND schemaname = 'public'
            AND indexname NOT LIKE '%_pkey'
            ORDER BY indexname;
        `);
        postStateContent += `7. Indexes on accounts (Expected: 5):\n`;
        res.rows.forEach(row => postStateContent += `   - ${row.indexname}\n`);
        postStateContent += `   Total: ${res.rows.length}\n\n`;
        logMessage('INFO', `  Indexes on accounts: ${res.rows.length} (expected 5)`);

        // RLS Policies
        res = await client.query(`
            SELECT policyname FROM pg_policies
            WHERE tablename = 'accounts' AND schemaname = 'public'
            ORDER BY policyname;
        `);
        postStateContent += `8. RLS Policies on accounts:\n`;
        res.rows.forEach(row => postStateContent += `   - ${row.policyname}\n`);
        postStateContent += `   Total: ${res.rows.length}\n\n`;
        logMessage('INFO', `  RLS Policies on accounts: ${res.rows.length}`);

        // Triggers
        res = await client.query(`
            SELECT trigger_name FROM information_schema.triggers
            WHERE event_object_schema = 'public' AND event_object_table = 'accounts'
            ORDER BY trigger_name;
        `);
        postStateContent += `9. Triggers on accounts:\n`;
        res.rows.forEach(row => postStateContent += `   - ${row.trigger_name}\n`);
        postStateContent += `   Total: ${res.rows.length}\n\n`;
        logMessage('INFO', `  Triggers on accounts: ${res.rows.length}`);

        // Sample data
        res = await client.query('SELECT * FROM public.accounts LIMIT 5');
        postStateContent += `10. Sample Data (first 5 rows):\n`;
        postStateContent += JSON.stringify(res.rows, null, 2) + '\n\n';
        logMessage('INFO', `  Sample data retrieved: ${res.rows.length} rows`);

        fs.writeFileSync(POST_STATE_FILE, postStateContent);
        logMessage('SUCCESS', `Post-migration state saved to ${POST_STATE_FILE}`);
        return true;

    } catch (error) {
        logMessage('ERROR', `Error collecting post-migration state: ${error.message}`);
        return false;
    }
}

async function runValidationTests(client) {
    logMessage('INFO', 'Running validation tests...');
    let testResults = '';
    testResults += '='.repeat(80) + '\n';
    testResults += 'VALIDATION TEST RESULTS\n';
    testResults += '='.repeat(80) + '\n\n';

    let passCount = 0;
    let totalTests = 8;

    try {
        // Test 1: accounts table exists
        let res = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'accounts'
            ) as result;
        `);
        const test1Pass = res.rows[0].result;
        testResults += `Test 1 - accounts table exists: ${test1Pass ? 'PASS' : 'FAIL'}\n`;
        logMessage('INFO', `  Test 1 - accounts table exists: ${test1Pass ? 'PASS' : 'FAIL'}`);
        if (test1Pass) passCount++;

        // Test 2: old table removed
        res = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'software_licenses'
                AND table_type = 'BASE TABLE'
            ) as result;
        `);
        const test2Pass = !res.rows[0].result;
        testResults += `Test 2 - software_licenses table removed: ${test2Pass ? 'PASS' : 'FAIL'}\n`;
        logMessage('INFO', `  Test 2 - software_licenses table removed: ${test2Pass ? 'PASS' : 'FAIL'}`);
        if (test2Pass) passCount++;

        // Test 3: record counts match
        res = await client.query(`
            SELECT
                (SELECT COUNT(*) FROM public.accounts)::text as accounts_count,
                (SELECT COUNT(*) FROM public.software_licenses_backup)::text as backup_count;
        `);
        const test3Pass = res.rows[0].accounts_count === res.rows[0].backup_count;
        testResults += `Test 3 - record counts match: ${test3Pass ? 'PASS' : 'FAIL'} (${res.rows[0].accounts_count} records)\n`;
        logMessage('INFO', `  Test 3 - record counts match: ${test3Pass ? 'PASS' : 'FAIL'}`);
        if (test3Pass) passCount++;

        // Test 4: foreign keys exist
        res = await client.query(`
            SELECT COUNT(*)::text as count
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND table_name = 'accounts'
            AND constraint_type = 'FOREIGN KEY';
        `);
        const fkCount = parseInt(res.rows[0].count);
        const test4Pass = fkCount > 0;
        testResults += `Test 4 - foreign keys exist: ${test4Pass ? 'PASS' : 'FAIL'} (${fkCount} found)\n`;
        logMessage('INFO', `  Test 4 - foreign keys exist: ${test4Pass ? 'PASS' : 'FAIL'} (${fkCount})`);
        if (test4Pass) passCount++;

        // Test 5: indexes exist
        res = await client.query(`
            SELECT COUNT(*)::text as count
            FROM pg_indexes
            WHERE tablename = 'accounts' AND schemaname = 'public'
            AND indexname NOT LIKE '%_pkey';
        `);
        const indexCount = parseInt(res.rows[0].count);
        const test5Pass = indexCount > 0;
        testResults += `Test 5 - indexes exist: ${test5Pass ? 'PASS' : 'FAIL'} (${indexCount} found)\n`;
        logMessage('INFO', `  Test 5 - indexes exist: ${test5Pass ? 'PASS' : 'FAIL'} (${indexCount})`);
        if (test5Pass) passCount++;

        // Test 6: no NULL IDs
        res = await client.query(`
            SELECT COUNT(*)::text as count FROM public.accounts WHERE id IS NULL;
        `);
        const nullCount = parseInt(res.rows[0].count);
        const test6Pass = nullCount === 0;
        testResults += `Test 6 - no NULL IDs: ${test6Pass ? 'PASS' : 'FAIL'}\n`;
        logMessage('INFO', `  Test 6 - no NULL IDs: ${test6Pass ? 'PASS' : 'FAIL'}`);
        if (test6Pass) passCount++;

        // Test 7: can query accounts
        res = await client.query('SELECT COUNT(*)::text as count FROM public.accounts;');
        const test7Pass = true;
        testResults += `Test 7 - can query accounts table: ${test7Pass ? 'PASS' : 'FAIL'}\n`;
        logMessage('INFO', `  Test 7 - can query accounts table: ${test7Pass ? 'PASS' : 'FAIL'}`);
        if (test7Pass) passCount++;

        // Test 8: old table name inaccessible
        let test8Pass = false;
        try {
            await client.query('SELECT COUNT(*) FROM public.software_licenses;');
            test8Pass = false;
        } catch (error) {
            if (error.message.includes('does not exist')) {
                test8Pass = true;
            }
        }
        testResults += `Test 8 - old table name inaccessible: ${test8Pass ? 'PASS' : 'FAIL'}\n`;
        logMessage('INFO', `  Test 8 - old table name inaccessible: ${test8Pass ? 'PASS' : 'FAIL'}`);
        if (test8Pass) passCount++;

        testResults += `\nTotal: ${passCount}/${totalTests} tests passed\n`;
        reportContent += testResults;
        logMessage('SUCCESS', `Validation tests completed: ${passCount}/${totalTests} passed`);
        return passCount === totalTests;

    } catch (error) {
        logMessage('ERROR', `Error running validation tests: ${error.message}`);
        return false;
    }
}

async function generateComprehensiveReport() {
    logMessage('INFO', 'Generating comprehensive migration report...');

    try {
        const finalReport = `
${'='.repeat(80)}
COMPREHENSIVE MIGRATION REPORT: software_licenses -> accounts
${'='.repeat(80)}

Migration Timestamp: ${new Date().toISOString()}
Database: uppalcrm_devtest
Target Migration: Rename software_licenses table to accounts

${'='.repeat(80)}
PRE-MIGRATION STATE
${'='.repeat(80)}
${preStateContent}

${'='.repeat(80)}
POST-MIGRATION STATE
${'='.repeat(80)}
${postStateContent}

${'='.repeat(80)}
MIGRATION EXECUTION LOG
${'='.repeat(80)}
${reportContent}

${'='.repeat(80)}
ROLLBACK INSTRUCTIONS
${'='.repeat(80)}
To rollback this migration:
1. Run: DROP TABLE public.accounts CASCADE;
2. Run: ALTER TABLE public.software_licenses_backup RENAME TO software_licenses;
3. Recreate any dropped objects (triggers, policies, etc.)

${'='.repeat(80)}
`;

        fs.writeFileSync(REPORT_FILE, finalReport);
        logMessage('SUCCESS', `Comprehensive report saved to ${REPORT_FILE}`);

    } catch (error) {
        logMessage('ERROR', `Error generating report: ${error.message}`);
    }
}

async function main() {
    console.log('\n' + '='.repeat(80));
    console.log('DATABASE MIGRATION ORCHESTRATION: software_licenses -> accounts');
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();
    const client = new Client(DB_CONFIG);

    try {
        // Connect to database
        await client.connect();
        logMessage('SUCCESS', 'Connected to database');

        // Test connection
        if (!await testConnection(client)) {
            process.exit(1);
        }

        // Collect pre-migration state
        if (!await collectPreMigrationState(client)) {
            logMessage('ERROR', 'Failed to collect pre-migration state');
            process.exit(1);
        }

        // Run migration
        if (!await runMigration(client)) {
            logMessage('ERROR', 'Migration failed');
            process.exit(1);
        }

        // Collect post-migration state
        if (!await collectPostMigrationState(client)) {
            logMessage('WARNING', 'Some post-migration state collection failed');
        }

        // Run validation tests
        const allTestsPassed = await runValidationTests(client);

        // Generate comprehensive report
        await generateComprehensiveReport();

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(80));
        console.log('MIGRATION EXECUTION SUMMARY');
        console.log('='.repeat(80));
        console.log(`Duration: ${duration} seconds`);
        console.log(`Status: ${allTestsPassed ? 'SUCCESS' : 'CHECK VALIDATION RESULTS'}`);
        console.log(`Report saved to: ${REPORT_FILE}`);
        console.log('='.repeat(80) + '\n');

        process.exit(allTestsPassed ? 0 : 1);

    } catch (error) {
        logMessage('FATAL', `Fatal error: ${error.message}`);
        process.exit(1);

    } finally {
        await client.end();
        logMessage('INFO', 'Database connection closed');
    }
}

main();
