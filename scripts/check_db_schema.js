#!/usr/bin/env node

const { Client } = require('pg');

const DB_CONFIG = {
    host: 'dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'uppalcrm_devtest',
    user: 'uppalcrm_devtest',
    password: 'YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs',
    ssl: { rejectUnauthorized: false }
};

async function main() {
    const client = new Client(DB_CONFIG);

    try {
        await client.connect();
        console.log('Connected to database\n');

        // List all tables
        console.log('=== ALL TABLES IN PUBLIC SCHEMA ===\n');
        const res = await client.query(`
            SELECT
                table_name,
                table_type
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
        `);

        if (res.rows.length === 0) {
            console.log('No tables found in public schema');
        } else {
            res.rows.forEach(row => {
                console.log(`- ${row.table_name} (${row.table_type})`);
            });
        }

        console.log('\n=== CHECKING FOR ACCOUNTS TABLE ===\n');
        const accountsRes = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'accounts'
            ) as exists;
        `);
        console.log(`accounts table exists: ${accountsRes.rows[0].exists}`);

        console.log('\n=== CHECKING FOR SOFTWARE_LICENSES TABLE ===\n');
        const slRes = await client.query(`
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'software_licenses'
            ) as exists;
        `);
        console.log(`software_licenses table exists: ${slRes.rows[0].exists}`);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await client.end();
    }
}

main();
