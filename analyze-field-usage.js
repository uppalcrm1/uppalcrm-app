const { Client } = require('pg');

const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function analyzeFieldUsage() {
  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔍 ANALYZING FIELD CONFIGURATION USAGE');
    console.log('═'.repeat(80));

    await client.connect();
    console.log('✅ Connected\n');

    const uppalOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    const fieldsToCheck = ['status', 'company', 'source'];

    for (const fieldName of fieldsToCheck) {
      console.log(`\n📋 FIELD: ${fieldName.toUpperCase()}`);
      console.log('═'.repeat(80));

      // Get all configs for this field
      const configs = await client.query(`
        SELECT id, field_name, field_options, entity_type,
               show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view
        FROM default_field_configurations
        WHERE organization_id = $1 AND field_name = $2
        ORDER BY id
      `, [uppalOrgId, fieldName]);

      console.log(`\nConfigurations found: ${configs.rows.length}\n`);

      for (let i = 0; i < configs.rows.length; i++) {
        const config = configs.rows[i];
        const optCount = Array.isArray(config.field_options) ? config.field_options.length : 0;
        const isEmpty = optCount === 0 ? '⚠️ EMPTY' : `✅ ${optCount} options`;

        console.log(`Config ${i + 1}:`);
        console.log(`  ID: ${config.id}`);
        console.log(`  Entity Type: ${config.entity_type || 'NULL'}`);
        console.log(`  Options: ${isEmpty}`);
        if (optCount > 0) {
          const values = config.field_options.map(o => o.value || o.label).join(', ');
          console.log(`  Values: ${values.substring(0, 60)}${values.length > 60 ? '...' : ''}`);
        }
        console.log(`  Show in Create: ${config.show_in_create_form}`);
        console.log(`  Show in Edit: ${config.show_in_edit_form}`);
        console.log(`  Show in Detail: ${config.show_in_detail_view}`);
        console.log(`  Show in List: ${config.show_in_list_view}`);
        console.log('');
      }

      // Check actual column usage in tables
      console.log(`Data in database for "${fieldName}":`);
      console.log('─'.repeat(80));

      // Check leads table
      let leadsCount = 0;
      let leadsNonNull = 0;
      try {
        const leadCheck = await client.query(`
          SELECT COUNT(*) as total, COUNT(${fieldName}) as non_null
          FROM leads
          WHERE organization_id = $1
        `, [uppalOrgId]);

        leadsCount = leadCheck.rows[0].total;
        leadsNonNull = leadCheck.rows[0].non_null;
        console.log(`Leads table:`);
        console.log(`  Total leads: ${leadsCount}`);
        console.log(`  With "${fieldName}" set: ${leadsNonNull}`);
      } catch (e) {
        console.log(`Leads table:`);
        console.log(`  Column "${fieldName}" not found ❌`);
      }

      // Check contacts table
      let contactsCount = 0;
      let contactsNonNull = 0;
      try {
        const contactCheck = await client.query(`
          SELECT COUNT(*) as total, COUNT(${fieldName}) as non_null
          FROM contacts
          WHERE organization_id = $1
        `, [uppalOrgId]);

        contactsCount = contactCheck.rows[0].total;
        contactsNonNull = contactCheck.rows[0].non_null;
        console.log(`\nContacts table:`);
        console.log(`  Total contacts: ${contactsCount}`);
        console.log(`  With "${fieldName}" set: ${contactsNonNull}`);
      } catch (e) {
        console.log(`\nContacts table:`);
        console.log(`  Column "${fieldName}" not found ❌`);
      }

      // Summary
      console.log('\n📊 SUMMARY:');
      if (leadsCount > 0 && contactsCount > 0) {
        console.log(`✅ Field "${fieldName}" is used in BOTH leads and contacts`);
        if (configs.rows.length > 1) {
          console.log(`⚠️  Has ${configs.rows.length} configs - may need different setups per entity type`);
        }
      } else if (leadsCount > 0) {
        console.log(`✅ Field "${fieldName}" is used ONLY in leads table`);
        if (configs.rows.length > 1) {
          console.log(`⚠️  ${configs.rows.length} configs but only 1 entity - likely duplicates`);
        }
      } else if (contactsCount > 0) {
        console.log(`✅ Field "${fieldName}" is used ONLY in contacts table`);
        if (configs.rows.length > 1) {
          console.log(`⚠️  ${configs.rows.length} configs but only 1 entity - likely duplicates`);
        }
      } else {
        console.log(`❌ Field "${fieldName}" is NOT used in either leads or contacts`);
        console.log(`⚠️  ${configs.rows.length} orphaned config(s) - should be deleted`);
      }
    }

    console.log('\n\n🎯 RECOMMENDATION');
    console.log('═'.repeat(80));
    console.log('Based on the analysis above, determine if duplicates are:');
    console.log('  1️⃣  Intentional (different configs for leads vs contacts)');
    console.log('  2️⃣  Accidental (true duplicates to be removed)');
    console.log('  3️⃣  Orphaned (unused configs to be deleted)');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

analyzeFieldUsage();
