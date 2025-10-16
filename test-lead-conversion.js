#!/usr/bin/env node

/**
 * Test script for lead conversion functionality
 * This will test if the contacts and accounts tables were created
 * and if the lead conversion endpoint works
 */

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

// Use production database connection
const pool = new Pool(process.env.DATABASE_URL ? {
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
} : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'uppal_crm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  ssl: false
});

const API_URL = process.env.API_URL || 'http://localhost:3004/api';

console.log('🧪 Testing Lead Conversion Implementation\n');

async function testDatabaseTables() {
  console.log('📋 Step 1: Checking if tables were created...\n');

  const client = await pool.connect();

  try {
    // Check contacts table
    const contactsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'contacts'
      );
    `);

    const contactsExists = contactsCheck.rows[0].exists;
    console.log(contactsExists ? '✅ contacts table exists' : '❌ contacts table NOT FOUND');

    // Check accounts table
    const accountsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'accounts'
      );
    `);

    const accountsExists = accountsCheck.rows[0].exists;
    console.log(accountsExists ? '✅ accounts table exists' : '❌ accounts table NOT FOUND');

    // Check lead_contact_relationships table
    const relationshipsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'lead_contact_relationships'
      );
    `);

    const relationshipsExists = relationshipsCheck.rows[0].exists;
    console.log(relationshipsExists ? '✅ lead_contact_relationships table exists' : '❌ lead_contact_relationships table NOT FOUND');

    // Check if leads table has new columns
    if (contactsExists) {
      const columnsCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'leads'
        AND column_name IN ('linked_contact_id', 'relationship_type', 'interest_type', 'converted_date')
        ORDER BY column_name
      `);

      const leadsColumns = columnsCheck.rows.map(r => r.column_name);
      console.log('\n📊 Lead conversion columns added to leads table:');
      ['linked_contact_id', 'relationship_type', 'interest_type', 'converted_date'].forEach(col => {
        console.log(leadsColumns.includes(col) ? `  ✅ ${col}` : `  ❌ ${col} NOT FOUND`);
      });
    }

    // Get table structure
    if (contactsExists) {
      console.log('\n📋 Contacts table structure:');
      const contactsCols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'contacts'
        ORDER BY ordinal_position
      `);
      contactsCols.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : ''}`);
      });
    }

    if (accountsExists) {
      console.log('\n📋 Accounts table structure:');
      const accountsCols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'accounts'
        ORDER BY ordinal_position
      `);
      accountsCols.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(required)' : ''}`);
      });
    }

    return contactsExists && accountsExists && relationshipsExists;

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    return false;
  } finally {
    client.release();
  }
}

async function testConversionEndpoint() {
  console.log('\n\n📋 Step 2: Testing conversion endpoint availability...\n');

  try {
    // Try to access the endpoint without auth (should return 401)
    const response = await axios.post(`${API_URL}/leads/test-lead-id/convert`, {}, {
      validateStatus: () => true // Don't throw on any status
    });

    if (response.status === 401) {
      console.log('✅ Conversion endpoint exists (returned 401 Unauthorized as expected)');
      return true;
    } else if (response.status === 404) {
      console.log('❌ Conversion endpoint NOT FOUND (404)');
      return false;
    } else {
      console.log(`⚠️  Conversion endpoint returned unexpected status: ${response.status}`);
      console.log('   Message:', response.data?.message || 'No message');
      return false;
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Cannot connect to API server');
    } else {
      console.log('❌ Endpoint test failed:', error.message);
    }
    return false;
  }
}

async function getTestCredentials() {
  console.log('\n\n📋 Step 3: Getting test credentials...\n');

  const client = await pool.connect();

  try {
    // Get first organization
    const orgResult = await client.query(`
      SELECT id, name, slug
      FROM organizations
      ORDER BY created_at ASC
      LIMIT 1
    `);

    if (orgResult.rows.length === 0) {
      console.log('❌ No organizations found in database');
      return null;
    }

    const org = orgResult.rows[0];
    console.log(`✅ Found test organization: ${org.name} (${org.slug})`);

    // Get first user in that org
    const userResult = await client.query(`
      SELECT id, email, first_name, last_name
      FROM users
      WHERE organization_id = $1
      ORDER BY created_at ASC
      LIMIT 1
    `, [org.id]);

    if (userResult.rows.length === 0) {
      console.log('❌ No users found in organization');
      return null;
    }

    const user = userResult.rows[0];
    console.log(`✅ Found test user: ${user.email}`);

    // Get a lead that hasn't been converted yet
    const leadResult = await client.query(`
      SELECT id, first_name, last_name, email, status
      FROM leads
      WHERE organization_id = $1
      AND (status != 'converted' OR status IS NULL)
      AND linked_contact_id IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [org.id]);

    if (leadResult.rows.length === 0) {
      console.log('⚠️  No unconverted leads found');
      console.log('   You can test by creating a lead first through the UI');
      return { org, user, lead: null };
    }

    const lead = leadResult.rows[0];
    console.log(`✅ Found unconverted lead: ${lead.first_name} ${lead.last_name} (${lead.email})`);

    return { org, user, lead };

  } catch (error) {
    console.error('❌ Failed to get test credentials:', error.message);
    return null;
  } finally {
    client.release();
  }
}

async function runTests() {
  try {
    // Test 1: Check database tables
    const tablesExist = await testDatabaseTables();

    if (!tablesExist) {
      console.log('\n❌ Database tables not created properly. Migration may have failed.');
      process.exit(1);
    }

    // Test 2: Check endpoint
    await testConversionEndpoint();

    // Test 3: Get credentials for manual testing
    const credentials = await getTestCredentials();

    if (credentials && credentials.lead) {
      console.log('\n\n📝 Manual Testing Instructions:');
      console.log('━'.repeat(60));
      console.log('\n1. Login to CRM with:');
      console.log(`   Email: ${credentials.user.email}`);
      console.log(`   Organization: ${credentials.org.slug}`);
      console.log('\n2. Go to Leads page and find:');
      console.log(`   Lead: ${credentials.lead.first_name} ${credentials.lead.last_name}`);
      console.log(`   Email: ${credentials.lead.email}`);
      console.log('\n3. Click "Convert to Contact" button');
      console.log('\n4. Fill in conversion form and submit');
      console.log('\n5. Check if contact appears in Contacts page');
      console.log('\n━'.repeat(60));
    }

    console.log('\n\n✅ All automated tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run tests
runTests();
