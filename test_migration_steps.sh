#!/bin/bash

# Test connection first
export PGPASSWORD="YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs"

DB_HOST="dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com"
DB_PORT="5432"
DB_NAME="uppalcrm_devtest"
DB_USER="uppalcrm_devtest"

echo "Step 1: Testing database connection..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT version();" 2>&1

echo ""
echo "Step 2: Checking pre-migration state..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'PSQL_EOF'
\set ON_ERROR_STOP off

echo 'Checking for software_licenses table...'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'software_licenses'
) as "software_licenses_exists";

echo 'Checking for accounts table...'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
) as "accounts_exists";

echo 'Pre-migration record count (if table exists)...'
SELECT COUNT(*) as "record_count" FROM public.software_licenses;

echo 'Foreign keys on software_licenses...'
SELECT COUNT(*) as "fk_count"
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'software_licenses'
AND constraint_type = 'FOREIGN KEY';

echo 'Indexes on software_licenses...'
SELECT COUNT(*) as "index_count"
FROM pg_indexes
WHERE tablename = 'software_licenses' AND schemaname = 'public'
AND indexname NOT LIKE '%_pkey';

PSQL_EOF

echo ""
echo "Step 3: Executing migration script..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f ./scripts/migration_software_licenses_to_accounts_v2.sql 2>&1 | head -100

echo ""
echo "Step 4: Checking post-migration state..."
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'PSQL_EOF'
\set ON_ERROR_STOP off

echo 'Checking for accounts table (should exist)...'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'accounts'
) as "accounts_exists";

echo 'Checking for software_licenses table (should NOT exist)...'
SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'software_licenses'
) as "software_licenses_exists";

echo 'Post-migration record count on accounts...'
SELECT COUNT(*) as "record_count" FROM public.accounts;

echo 'Foreign keys on accounts...'
SELECT COUNT(*) as "fk_count"
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = 'accounts'
AND constraint_type = 'FOREIGN KEY';

echo 'Indexes on accounts...'
SELECT COUNT(*) as "index_count"
FROM pg_indexes
WHERE tablename = 'accounts' AND schemaname = 'public'
AND indexname NOT LIKE '%_pkey';

PSQL_EOF

