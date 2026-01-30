const { Client } = require('pg');

const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function deleteContactsValueConfig() {
  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🗑️  DELETING CONTACTS VALUE FIELD CONFIGURATION');
    console.log('═'.repeat(100));

    await client.connect();
    console.log('✅ Connected to Production\n');

    const uppalOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';

    // Check before deletion
    console.log('📋 BEFORE DELETION');
    console.log('─'.repeat(100));

    const beforeCheck = await client.query(`
      SELECT id, field_name, entity_type, field_options
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'value'
      ORDER BY entity_type
    `, [uppalOrgId]);

    console.log(`\nFound ${beforeCheck.rows.length} "value" field configurations:\n`);
    for (const config of beforeCheck.rows) {
      console.log(`${config.entity_type.toUpperCase()}: ID=${config.id}`);
    }

    // Identify contacts value config
    const contactsValueConfig = beforeCheck.rows.find(c => c.entity_type === 'contacts');

    if (!contactsValueConfig) {
      console.log('\n⚠️  No "value" configuration found for contacts entity');
      console.log('Nothing to delete.');
    } else {
      console.log('\n\n🗑️  DELETING CONTACTS VALUE CONFIG');
      console.log('─'.repeat(100));

      const deleteResult = await client.query(`
        DELETE FROM default_field_configurations
        WHERE organization_id = $1 AND field_name = 'value' AND entity_type = 'contacts'
        RETURNING id, field_name, entity_type
      `, [uppalOrgId]);

      console.log(`\n✅ Deleted ${deleteResult.rowCount} configuration(s)`);
      if (deleteResult.rows.length > 0) {
        deleteResult.rows.forEach(row => {
          console.log(`   - ${row.entity_type}: ${row.field_name} (ID: ${row.id})`);
        });
      }

      // Verify deletion
      console.log('\n\n✅ AFTER DELETION');
      console.log('─'.repeat(100));

      const afterCheck = await client.query(`
        SELECT id, field_name, entity_type
        FROM default_field_configurations
        WHERE organization_id = $1 AND field_name = 'value'
        ORDER BY entity_type
      `, [uppalOrgId]);

      console.log(`\nRemaining "value" configurations: ${afterCheck.rows.length}\n`);
      for (const config of afterCheck.rows) {
        console.log(`${config.entity_type.toUpperCase()}: ${config.field_name}`);
      }

      console.log('\n\n✅ FINAL STATUS');
      console.log('═'.repeat(100));

      console.log('\n📊 Value Field Configurations Summary:');
      console.log(`   Leads: ✅ (legitimate - potential deal value)`);
      console.log(`   Contacts: ✅ Deleted (non-existent column)`);
      console.log(`   Use lifetime_value for contacts instead`);

      console.log('\n🎯 Next Steps:');
      console.log('   1. Sync deletion to Staging');
      console.log('   2. Sync deletion to Devtest');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

deleteContactsValueConfig();
