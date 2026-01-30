const { Client } = require('pg');

const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function analyzeValueFields() {
  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 ANALYZING VALUE FIELDS IN CONTACTS TABLE');
    console.log('═'.repeat(100));

    await client.connect();
    console.log('✅ Connected to Production\n');

    const uppalOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';

    // Get schema info for these fields
    console.log('📋 FIELD DEFINITIONS IN CONTACTS TABLE');
    console.log('─'.repeat(100));

    const contactsColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'contacts' AND column_name IN ('lifetime_value', 'customer_value', 'total_purchases')
      ORDER BY column_name
    `);

    console.log('\nColumns found:\n');
    contactsColumns.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(20)} | Type: ${col.data_type.padEnd(10)} | Nullable: ${col.is_nullable}`);
    });

    // Get data statistics
    console.log('\n\n📊 DATA STATISTICS');
    console.log('─'.repeat(100));

    const stats = await client.query(`
      SELECT
        COUNT(*) as total_contacts,
        COUNT(lifetime_value) as lifetime_value_filled,
        COUNT(customer_value) as customer_value_filled,
        COUNT(total_purchases) as total_purchases_filled,
        ROUND(AVG(lifetime_value)::numeric, 2) as avg_lifetime_value,
        ROUND(AVG(customer_value)::numeric, 2) as avg_customer_value,
        ROUND(AVG(total_purchases)::numeric, 2) as avg_total_purchases,
        MIN(lifetime_value) as min_lifetime_value,
        MAX(lifetime_value) as max_lifetime_value,
        MIN(customer_value) as min_customer_value,
        MAX(customer_value) as max_customer_value,
        MIN(total_purchases) as min_total_purchases,
        MAX(total_purchases) as max_total_purchases
      FROM contacts
      WHERE organization_id = $1
    `, [uppalOrgId]);

    const data = stats.rows[0];

    console.log(`\nTotal Contacts: ${data.total_contacts}\n`);

    console.log('LIFETIME_VALUE:');
    console.log(`  Records filled: ${data.lifetime_value_filled}/${data.total_contacts} (${((data.lifetime_value_filled/data.total_contacts)*100).toFixed(1)}%)`);
    console.log(`  Average: ${data.avg_lifetime_value}`);
    console.log(`  Range: ${data.min_lifetime_value} - ${data.max_lifetime_value}`);

    console.log('\nCUSTOMER_VALUE:');
    console.log(`  Records filled: ${data.customer_value_filled}/${data.total_contacts} (${((data.customer_value_filled/data.total_contacts)*100).toFixed(1)}%)`);
    console.log(`  Average: ${data.avg_customer_value}`);
    console.log(`  Range: ${data.min_customer_value} - ${data.max_customer_value}`);

    console.log('\nTOTAL_PURCHASES:');
    console.log(`  Records filled: ${data.total_purchases_filled}/${data.total_contacts} (${((data.total_purchases_filled/data.total_contacts)*100).toFixed(1)}%)`);
    console.log(`  Average: ${data.avg_total_purchases}`);
    console.log(`  Range: ${data.min_total_purchases} - ${data.max_total_purchases}`);

    // Compare with Leads table
    console.log('\n\n🔍 COMPARISON WITH LEADS TABLE');
    console.log('─'.repeat(100));

    const leadsColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'leads' AND column_name IN ('lifetime_value', 'customer_value', 'total_purchases', 'value')
      ORDER BY column_name
    `);

    console.log('\nColumns in Leads table:');
    if (leadsColumns.rows.length === 0) {
      console.log('  None of these columns found in leads');
    } else {
      leadsColumns.rows.forEach(col => {
        console.log(`  - ${col.column_name}`);
      });
    }

    const leadsValue = await client.query(`
      SELECT
        COUNT(*) as total_leads,
        COUNT(value) as value_filled,
        ROUND(AVG(value)::numeric, 2) as avg_value,
        MIN(value) as min_value,
        MAX(value) as max_value
      FROM leads
      WHERE organization_id = $1
    `, [uppalOrgId]);

    const leadsData = leadsValue.rows[0];

    console.log('\nLEADS.VALUE:');
    console.log(`  Total leads: ${leadsData.total_leads}`);
    console.log(`  Records filled: ${leadsData.value_filled}/${leadsData.total_leads} (${((leadsData.value_filled/leadsData.total_leads)*100).toFixed(1)}%)`);
    console.log(`  Average: ${leadsData.avg_value}`);
    console.log(`  Range: ${leadsData.min_value} - ${leadsData.max_value}`);

    // Sample records with all three fields
    console.log('\n\n📋 SAMPLE CONTACTS WITH ALL THREE FIELDS');
    console.log('─'.repeat(100));

    const samples = await client.query(`
      SELECT
        id,
        first_name,
        last_name,
        lifetime_value,
        customer_value,
        total_purchases,
        status
      FROM contacts
      WHERE organization_id = $1
        AND lifetime_value IS NOT NULL
        AND customer_value IS NOT NULL
      LIMIT 5
    `, [uppalOrgId]);

    if (samples.rows.length > 0) {
      console.log('\nContacts with values populated:\n');
      samples.rows.forEach((row, i) => {
        console.log(`${i + 1}. ${row.first_name} ${row.last_name}`);
        console.log(`   lifetime_value: ${row.lifetime_value}`);
        console.log(`   customer_value: ${row.customer_value}`);
        console.log(`   total_purchases: ${row.total_purchases}`);
        console.log(`   status: ${row.status}\n`);
      });
    } else {
      console.log('\nNo contacts with both lifetime_value and customer_value populated');
    }

    // Analysis
    console.log('\n\n💡 ANALYSIS & RECOMMENDATIONS');
    console.log('═'.repeat(100));

    console.log(`\n📊 Field Usage Summary:`);
    console.log(`\n1. LIFETIME_VALUE: ${data.lifetime_value_filled} contacts (${((data.lifetime_value_filled/data.total_contacts)*100).toFixed(1)}%)`);
    console.log(`   → Total monetary value of all transactions from this contact over lifetime`);

    console.log(`\n2. CUSTOMER_VALUE: ${data.customer_value_filled} contacts (${((data.customer_value_filled/data.total_contacts)*100).toFixed(1)}%)`);
    console.log(`   → Appears to be same or similar to lifetime_value`);

    console.log(`\n3. TOTAL_PURCHASES: ${data.total_purchases_filled} contacts (${((data.total_purchases_filled/data.total_contacts)*100).toFixed(1)}%)`);
    console.log(`   → Count of how many times this contact made a purchase`);

    console.log(`\n4. LEADS.VALUE: ${leadsData.value_filled} leads (${((leadsData.value_filled/leadsData.total_leads)*100).toFixed(1)}%)`);
    console.log(`   → Potential deal value (estimated value before conversion)`);

    console.log(`\n🎯 RECOMMENDATION FOR THE "value" FIELD CONFIG:`);
    if (data.customer_value_filled > 0 || data.lifetime_value_filled > 0) {
      console.log(`   → Map "value" config to "lifetime_value" or "customer_value"`);
      console.log(`   → lifetime_value seems more appropriate (actual revenue vs estimated)`);
    } else {
      console.log(`   → None of the value fields are in use`);
      console.log(`   → Safe to delete the "value" config for contacts`);
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeValueFields();
