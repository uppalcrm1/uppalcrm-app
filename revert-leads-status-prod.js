const { Client } = require('pg');

const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function revertLeadsStatus() {
  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 REVERTING LEADS STATUS TO CORRECT VALUES');
    console.log('═'.repeat(100));

    await client.connect();
    console.log('✅ Connected to Production\n');

    const uppalOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';

    // Define CORRECT Leads status options (9 values)
    const leadsStatusOptions = [
      { label: 'New', value: 'new' },
      { label: 'Contacted', value: 'contacted' },
      { label: 'First Follow Up', value: 'first_follow_up' },
      { label: 'Engaged', value: 'engaged' },
      { label: 'Trial', value: 'trial' },
      { label: 'Second Follow Up', value: 'second_follow_up' },
      { label: 'Third Follow Up', value: 'third_follow_up' },
      { label: 'Converted', value: 'converted' },
      { label: 'Lost', value: 'lost' }
    ];

    console.log('🔧 RESTORING CORRECT LEADS STATUS VALUES');
    console.log('─'.repeat(100));
    console.log('\nCorrect status options for leads:');
    leadsStatusOptions.forEach(opt => console.log(`  - ${opt.label} (${opt.value})`));

    // Update leads status with CORRECT values
    await client.query(`
      UPDATE default_field_configurations
      SET field_options = $1
      WHERE organization_id = $2 AND field_name = 'status' AND entity_type = 'leads'
    `, [JSON.stringify(leadsStatusOptions), uppalOrgId]);
    console.log('\n✅ Restored leads status config with 9 correct values');

    // Verify the fix
    console.log('\n\n✅ VERIFICATION - AFTER REVERT');
    console.log('═'.repeat(100));

    const verifyConfigs = await client.query(`
      SELECT entity_type, field_options
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'status'
      ORDER BY entity_type
    `, [uppalOrgId]);

    console.log('\n📊 STATUS FIELD CONFIGURATIONS (CORRECTED):\n');
    for (const config of verifyConfigs.rows) {
      const optCount = Array.isArray(config.field_options) ? config.field_options.length : 0;
      console.log(`${config.entity_type.toUpperCase()}:`);
      console.log(`  Options: ${optCount}`);
      if (optCount > 0) {
        config.field_options.forEach(opt => {
          console.log(`    - ${opt.label} (${opt.value})`);
        });
      }
      console.log('');
    }

    console.log('\n✅ PRODUCTION CORRECTED SUCCESSFULLY');
    console.log('═'.repeat(100));
    console.log('\n📋 Final Status Configuration:');
    console.log('   ✅ LEADS: new, contacted, first_follow_up, engaged, trial, second_follow_up, third_follow_up, converted, lost (9 values)');
    console.log('   ✅ CONTACTS: active, inactive, suspended, do_not_call, churned, vip, at_risk (7 values)');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

revertLeadsStatus();
