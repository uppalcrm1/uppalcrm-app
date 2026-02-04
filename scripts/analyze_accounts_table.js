#!/usr/bin/env node

const { Client } = require('pg');
const fs = require('fs');

const DB_CONFIG = {
    host: 'dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'uppalcrm_devtest',
    user: 'uppalcrm_devtest',
    password: 'YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs',
    ssl: { rejectUnauthorized: false }
};

let report = '';

function addToReport(content) {
    console.log(content);
    report += content + '\n';
}

async function main() {
    const client = new Client(DB_CONFIG);

    try {
        await client.connect();
        addToReport('='.repeat(80));
        addToReport('COMPREHENSIVE ACCOUNTS TABLE ANALYSIS');
        addToReport('='.repeat(80));
        addToReport('');

        // Table structure
        addToReport('1. TABLE STRUCTURE');
        addToReport('-'.repeat(80));
        let res = await client.query(`
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'accounts'
            ORDER BY ordinal_position;
        `);

        if (res.rows.length > 0) {
            addToReport('Columns:');
            res.rows.forEach(row => {
                const nullable = row.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
                const defaultVal = row.column_default ? ` DEFAULT ${row.column_default}` : '';
                addToReport(`  - ${row.column_name} ${row.data_type} ${nullable}${defaultVal}`);
            });
        }
        addToReport('');

        // Record count
        addToReport('2. RECORD COUNT');
        addToReport('-'.repeat(80));
        res = await client.query('SELECT COUNT(*) as count FROM public.accounts;');
        addToReport(`Total records: ${res.rows[0].count}`);
        addToReport('');

        // Primary key
        addToReport('3. PRIMARY KEY');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT
                constraint_name,
                column_name
            FROM information_schema.key_column_usage
            WHERE table_schema = 'public'
                AND table_name = 'accounts'
                AND constraint_name LIKE '%_pkey'
            ORDER BY ordinal_position;
        `);

        if (res.rows.length > 0) {
            res.rows.forEach(row => {
                addToReport(`  ${row.constraint_name}: ${row.column_name}`);
            });
        } else {
            addToReport('  No primary key found');
        }
        addToReport('');

        // Foreign keys
        addToReport('4. FOREIGN KEYS (Incoming)');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT DISTINCT
                t1.relname as table_name,
                a1.attname as column_name,
                c.conname as constraint_name
            FROM pg_class t1
            JOIN pg_attribute a1 ON a1.attrelid = t1.oid
            JOIN pg_constraint c ON c.conrelid = t1.oid AND a1.attnum = ANY(c.conkey)
            JOIN pg_class t2 ON c.confrelid = t2.oid
            WHERE t2.relname = 'accounts' AND c.contype = 'f'
            ORDER BY constraint_name;
        `);

        if (res.rows.length > 0) {
            addToReport(`Found ${res.rows.length} foreign keys pointing to accounts table:`);
            res.rows.forEach(row => {
                addToReport(`  - ${row.constraint_name}: ${row.table_name}.${row.column_name}`);
            });
        } else {
            addToReport('  No foreign keys found');
        }
        addToReport('');

        // Foreign keys (Outgoing)
        addToReport('5. FOREIGN KEYS (Outgoing)');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT
                tc.constraint_name,
                kcu.column_name,
                ccu.table_name as foreign_table,
                ccu.column_name as foreign_column
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
                AND tc.table_name = 'accounts'
            ORDER BY tc.constraint_name;
        `);

        if (res.rows.length > 0) {
            addToReport(`Found ${res.rows.length} outgoing foreign keys:`);
            res.rows.forEach(row => {
                addToReport(`  - ${row.constraint_name}: accounts.${row.column_name} -> ${row.foreign_table}.${row.foreign_column}`);
            });
        } else {
            addToReport('  No outgoing foreign keys found');
        }
        addToReport('');

        // Indexes
        addToReport('6. INDEXES');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'accounts' AND schemaname = 'public'
            ORDER BY indexname;
        `);

        if (res.rows.length > 0) {
            addToReport(`Found ${res.rows.length} indexes:`);
            res.rows.forEach(row => {
                addToReport(`  - ${row.indexname}`);
                addToReport(`    Definition: ${row.indexdef}`);
            });
        } else {
            addToReport('  No indexes found');
        }
        addToReport('');

        // Unique constraints
        addToReport('7. UNIQUE CONSTRAINTS');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT
                constraint_name,
                column_name
            FROM information_schema.key_column_usage
            WHERE table_schema = 'public'
                AND table_name = 'accounts'
                AND constraint_name LIKE '%_unique%' OR constraint_name NOT LIKE '%_pkey%'
            ORDER BY constraint_name;
        `);

        if (res.rows.length > 0) {
            addToReport(`Found ${res.rows.length} unique constraints`);
        } else {
            addToReport('  No unique constraints found');
        }
        addToReport('');

        // RLS Policies
        addToReport('8. ROW LEVEL SECURITY (RLS) POLICIES');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT policyname, permissive, roles, qual, with_check
            FROM pg_policies
            WHERE tablename = 'accounts' AND schemaname = 'public'
            ORDER BY policyname;
        `);

        if (res.rows.length > 0) {
            addToReport(`Found ${res.rows.length} RLS policies:`);
            res.rows.forEach(row => {
                const rolesStr = Array.isArray(row.roles) ? row.roles.join(', ') : row.roles || 'All roles';
                addToReport(`  - ${row.policyname} (${row.permissive ? 'PERMISSIVE' : 'RESTRICTIVE'})`);
                addToReport(`    Roles: ${rolesStr}`);
                addToReport(`    Using: ${row.qual || 'N/A'}`);
                addToReport(`    With Check: ${row.with_check || 'N/A'}`);
            });
        } else {
            addToReport('  No RLS policies found');
        }
        addToReport('');

        // Triggers
        addToReport('9. TRIGGERS');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT
                trigger_name,
                event_manipulation,
                action_orientation,
                action_statement
            FROM information_schema.triggers
            WHERE event_object_schema = 'public' AND event_object_table = 'accounts'
            ORDER BY trigger_name;
        `);

        if (res.rows.length > 0) {
            addToReport(`Found ${res.rows.length} triggers:`);
            res.rows.forEach(row => {
                addToReport(`  - ${row.trigger_name}`);
                addToReport(`    Event: ${row.event_manipulation}`);
                addToReport(`    Orientation: ${row.action_orientation}`);
                addToReport(`    Statement: ${row.action_statement.substring(0, 100)}...`);
            });
        } else {
            addToReport('  No triggers found');
        }
        addToReport('');

        // Table comment
        addToReport('10. TABLE METADATA');
        addToReport('-'.repeat(80));
        res = await client.query(`
            SELECT
                obj_description((SELECT oid FROM pg_class WHERE relname = 'accounts' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')), 'pg_class') as comment,
                pg_size_pretty(pg_total_relation_size('accounts'::regclass)) as size;
        `);

        if (res.rows[0].comment) {
            addToReport(`Comment: ${res.rows[0].comment}`);
        }
        addToReport(`Size: ${res.rows[0].size}`);
        addToReport('');

        // Sample data
        addToReport('11. SAMPLE DATA (First 10 rows)');
        addToReport('-'.repeat(80));
        res = await client.query('SELECT * FROM public.accounts ORDER BY id LIMIT 10;');
        if (res.rows.length > 0) {
            addToReport(JSON.stringify(res.rows, null, 2));
        } else {
            addToReport('  No data found');
        }
        addToReport('');

        // Relationships
        addToReport('12. TABLE RELATIONSHIPS');
        addToReport('-'.repeat(80));
        addToReport('Tables that reference accounts:');
        res = await client.query(`
            SELECT DISTINCT
                t1.relname as table_name
            FROM pg_class t1
            JOIN pg_constraint c ON c.conrelid = t1.oid
            JOIN pg_class t2 ON c.confrelid = t2.oid
            WHERE t2.relname = 'accounts' AND c.contype = 'f'
            ORDER BY table_name;
        `);

        if (res.rows.length > 0) {
            res.rows.forEach(row => {
                addToReport(`  - ${row.table_name}`);
            });
        } else {
            addToReport('  No tables reference accounts');
        }
        addToReport('');

        // Save report
        const reportFile = 'C:\\Users\\uppal\\uppal-crm-project\\scripts\\accounts_table_analysis.txt';
        fs.writeFileSync(reportFile, report);
        addToReport('='.repeat(80));
        addToReport(`Report saved to: ${reportFile}`);
        addToReport('='.repeat(80));

    } catch (error) {
        addToReport(`ERROR: ${error.message}`);
    } finally {
        await client.end();
    }
}

main();
