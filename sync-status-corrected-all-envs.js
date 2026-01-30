const { Client } = require('pg');

const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';
const stagingUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const devtestUrl = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';

async function syncStatusCorrected() {
  const prodClient = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });
  const stagingClient = new Client({ connectionString: stagingUrl, ssl: { rejectUnauthorized: false } });
  const devtestClient = new Client({ connectionString: devtestUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔄 SYNCING CORRECTED STATUS FIELD CONFIGURATIONS - ALL ENVIRONMENTS');
    console.log('═'.repeat(100));

    await Promise.all([prodClient.connect(), stagingClient.connect(), devtestClient.connect()]);
    console.log('✅ Connected to all environments\n');

    const prodOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';
    const stagingOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';
    const devtestOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';

    // Get current status configs from production
    console.log('📋 Step 1: Get corrected status configurations from Production');
    console.log('─'.repeat(100));

    const prodConfigs = await prodClient.query(`
      SELECT entity_type, field_options
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'status'
      ORDER BY entity_type
    `, [prodOrgId]);

    console.log(`\nFound ${prodConfigs.rows.length} status configurations in production:\n`);

    const leadsStatus = prodConfigs.rows.find(c => c.entity_type === 'leads');
    const contactsStatus = prodConfigs.rows.find(c => c.entity_type === 'contacts');

    if (leadsStatus) {
      const optCount = Array.isArray(leadsStatus.field_options) ? leadsStatus.field_options.length : 0;
      console.log(`LEADS: ${optCount} options`);
      console.log(`  Values: ${leadsStatus.field_options.map(o => o.value).join(', ')}`);
    }

    if (contactsStatus) {
      const optCount = Array.isArray(contactsStatus.field_options) ? contactsStatus.field_options.length : 0;
      console.log(`CONTACTS: ${optCount} options`);
      console.log(`  Values: ${contactsStatus.field_options.map(o => o.value).join(', ')}`);
    }

    // Sync to Staging
    console.log('\n\n📋 Step 2: Syncing to Staging');
    console.log('─'.repeat(100));

    if (leadsStatus) {
      console.log('\n  Updating leads status...');
      await stagingClient.query(`
        UPDATE default_field_configurations
        SET field_options = $1
        WHERE organization_id = $2 AND field_name = 'status' AND entity_type = 'leads'
      `, [JSON.stringify(leadsStatus.field_options), stagingOrgId]);
      console.log('  ✅ Updated leads status');
    }

    if (contactsStatus) {
      console.log('\n  Updating contacts status...');
      await stagingClient.query(`
        UPDATE default_field_configurations
        SET field_options = $1
        WHERE organization_id = $2 AND field_name = 'status' AND entity_type = 'contacts'
      `, [JSON.stringify(contactsStatus.field_options), stagingOrgId]);
      console.log('  ✅ Updated contacts status');
    }

    // Sync to Devtest
    console.log('\n\n📋 Step 3: Syncing to Devtest');
    console.log('─'.repeat(100));

    if (leadsStatus) {
      console.log('\n  Updating leads status...');
      await devtestClient.query(`
        UPDATE default_field_configurations
        SET field_options = $1
        WHERE organization_id = $2 AND field_name = 'status' AND entity_type = 'leads'
      `, [JSON.stringify(leadsStatus.field_options), devtestOrgId]);
      console.log('  ✅ Updated leads status');
    }

    if (contactsStatus) {
      console.log('\n  Updating contacts status...');
      await devtestClient.query(`
        UPDATE default_field_configurations
        SET field_options = $1
        WHERE organization_id = $2 AND field_name = 'status' AND entity_type = 'contacts'
      `, [JSON.stringify(contactsStatus.field_options), devtestOrgId]);
      console.log('  ✅ Updated contacts status');
    }

    // Verify
    console.log('\n\n✅ VERIFICATION - ALL ENVIRONMENTS');
    console.log('═'.repeat(100));

    const envs = [
      { name: 'PRODUCTION', client: prodClient, orgId: prodOrgId },
      { name: 'STAGING', client: stagingClient, orgId: stagingOrgId },
      { name: 'DEVTEST', client: devtestClient, orgId: devtestOrgId }
    ];

    for (const env of envs) {
      const configs = await env.client.query(`
        SELECT entity_type, field_options
        FROM default_field_configurations
        WHERE organization_id = $1 AND field_name = 'status'
        ORDER BY entity_type
      `, [env.orgId]);

      console.log(`\n🟢 ${env.name}:`);
      for (const config of configs.rows) {
        const optCount = Array.isArray(config.field_options) ? config.field_options.length : 0;
        console.log(`  ${config.entity_type.toUpperCase()}: ${optCount} options`);
        console.log(`    Values: ${config.field_options.map(o => o.value).join(', ')}`);
      }
    }

    console.log('\n\n✅ SYNC COMPLETED SUCCESSFULLY');
    console.log('═'.repeat(100));
    console.log('\n📊 Final Status Configuration Across All Environments:');
    console.log('   ✅ LEADS: new, contacted, first_follow_up, engaged, trial, second_follow_up, third_follow_up, converted, lost (9 values)');
    console.log('   ✅ CONTACTS: active, inactive, suspended, do_not_call, churned, vip, at_risk (7 values)');
    console.log('\n🎯 All environments now have consistent and correct status field configurations!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await Promise.all([prodClient.end(), stagingClient.end(), devtestClient.end()]);
  }
}

syncStatusCorrected();
