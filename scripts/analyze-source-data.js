/**
 * Pre-Migration Analysis Script for Source Field
 *
 * This script analyzes existing source field values across all tables
 * to help understand the data before migrating to the new system.
 *
 * Usage: node scripts/analyze-source-data.js
 */

const { Pool } = require('pg');

// Get database connection string from environment
const connectionString = process.env.DATABASE_URL || process.env.DB_CONNECTION_STRING;

if (!connectionString) {
  console.error('❌ Error: DATABASE_URL environment variable is not set');
  console.log('💡 Set it with: export DATABASE_URL="postgresql://user:password@host:port/database"');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function analyzeSourceData() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('        Source Field Data Analysis');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Analyze Leads
    console.log('📊 LEADS TABLE');
    console.log('───────────────────────────────────────────────────────────');
    const leadsQuery = `
      SELECT
        source,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM leads
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY count DESC
    `;
    const leads = await pool.query(leadsQuery);

    if (leads.rows.length > 0) {
      console.table(leads.rows);
      const totalLeads = leads.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      console.log(`Total leads with source: ${totalLeads}`);

      const nullLeadsQuery = `SELECT COUNT(*) as count FROM leads WHERE source IS NULL`;
      const nullLeads = await pool.query(nullLeadsQuery);
      console.log(`Leads without source: ${nullLeads.rows[0].count}\n`);
    } else {
      console.log('No leads with source values found.\n');
    }

    // Analyze Contacts
    console.log('📊 CONTACTS TABLE');
    console.log('───────────────────────────────────────────────────────────');
    const contactsQuery = `
      SELECT
        source,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM contacts
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY count DESC
    `;
    const contacts = await pool.query(contactsQuery);

    if (contacts.rows.length > 0) {
      console.table(contacts.rows);
      const totalContacts = contacts.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      console.log(`Total contacts with source: ${totalContacts}`);

      const nullContactsQuery = `SELECT COUNT(*) as count FROM contacts WHERE source IS NULL`;
      const nullContacts = await pool.query(nullContactsQuery);
      console.log(`Contacts without source: ${nullContacts.rows[0].count}\n`);
    } else {
      console.log('No contacts with source values found.\n');
    }

    // Analyze Transactions
    console.log('📊 TRANSACTIONS TABLE');
    console.log('───────────────────────────────────────────────────────────');
    const transactionsQuery = `
      SELECT
        source,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
      FROM transactions
      WHERE source IS NOT NULL
      GROUP BY source
      ORDER BY count DESC
    `;
    const transactions = await pool.query(transactionsQuery);

    if (transactions.rows.length > 0) {
      console.table(transactions.rows);
      const totalTransactions = transactions.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
      console.log(`Total transactions with source: ${totalTransactions}`);

      const nullTransactionsQuery = `SELECT COUNT(*) as count FROM transactions WHERE source IS NULL`;
      const nullTransactions = await pool.query(nullTransactionsQuery);
      console.log(`Transactions without source: ${nullTransactions.rows[0].count}\n`);
    } else {
      console.log('No transactions with source values found.\n');
    }

    // Check Accounts table (likely no source column yet)
    console.log('📊 ACCOUNTS TABLE');
    console.log('───────────────────────────────────────────────────────────');
    try {
      const accountsQuery = `
        SELECT
          source,
          COUNT(*) as count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
        FROM accounts
        WHERE source IS NOT NULL
        GROUP BY source
        ORDER BY count DESC
      `;
      const accounts = await pool.query(accountsQuery);

      if (accounts.rows.length > 0) {
        console.table(accounts.rows);
        const totalAccounts = accounts.rows.reduce((sum, row) => sum + parseInt(row.count), 0);
        console.log(`Total accounts with source: ${totalAccounts}`);

        const nullAccountsQuery = `SELECT COUNT(*) as count FROM accounts WHERE source IS NULL`;
        const nullAccounts = await pool.query(nullAccountsQuery);
        console.log(`Accounts without source: ${nullAccounts.rows[0].count}\n`);
      } else {
        console.log('No accounts with source values found.\n');
      }
    } catch (error) {
      console.log('⚠️  Accounts table does not have a source column yet (expected).\n');
    }

    // Summary - Unique source values across all tables
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📋 SUMMARY - All Unique Source Values');
    console.log('═══════════════════════════════════════════════════════════');

    const allSourcesQuery = `
      SELECT DISTINCT source, 'leads' as source_table FROM leads WHERE source IS NOT NULL
      UNION
      SELECT DISTINCT source, 'contacts' as source_table FROM contacts WHERE source IS NOT NULL
      UNION
      SELECT DISTINCT source, 'transactions' as source_table FROM transactions WHERE source IS NOT NULL
      ORDER BY source
    `;
    const allSources = await pool.query(allSourcesQuery);

    if (allSources.rows.length > 0) {
      console.log('\nAll unique source values found:');
      console.table(allSources.rows);

      // Get list of unique values
      const uniqueValues = [...new Set(allSources.rows.map(row => row.source))];
      console.log('\n📝 Unique source values to map:');
      uniqueValues.forEach(value => {
        console.log(`  • ${value}`);
      });

      console.log('\n💡 Recommended standardized options:');
      console.log('  • website → Website');
      console.log('  • referral → Referral');
      console.log('  • social-media → Social Media');
      console.log('  • cold-call → Cold Call');
      console.log('  • email → Email');
      console.log('  • advertisement → Advertisement');
      console.log('  • trade-show → Trade Show');
      console.log('  • other → Other');
    } else {
      console.log('No source values found in any table.\n');
    }

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Analysis Complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log('Next steps:');
    console.log('1. Review the data above to understand existing source values');
    console.log('2. Run the migration: psql $DATABASE_URL -f database/migrations/023_add_source_system_field.sql');
    console.log('3. Test the Field Configuration UI to manage source options');
    console.log('4. (Optional) Run normalize-source-values.js to standardize existing data\n');

  } catch (error) {
    console.error('❌ Error analyzing source data:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeSourceData();
