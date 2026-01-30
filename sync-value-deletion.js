const { Client } = require('pg');

const stagingUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const devtestUrl = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';
const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function syncValueDeletion() {
  const stagingClient = new Client({ connectionString: stagingUrl, ssl: { rejectUnauthorized: false } });
  const devtestClient = new Client({ connectionString: devtestUrl, ssl: { rejectUnauthorized: false } });
  const prodClient = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔄 SYNCING VALUE FIELD DELETION - ALL ENVIRONMENTS');
    console.log('═'.repeat(100));

    await Promise.all([stagingClient.connect(), devtestClient.connect(), prodClient.connect()]);
    console.log('✅ Connected to all environments\n');

    const stagingOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';
    const devtestOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';
    const prodOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';

    // Check current state
    console.log('📋 CURRENT STATE - VALUE CONFIGURATIONS');
    console.log('─'.repeat(100));

    const stagingValueConfigs = await stagingClient.query(`
      SELECT entity_type FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'value'
    `, [stagingOrgId]);

    const devtestValueConfigs = await devtestClient.query(`
      SELECT entity_type FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'value'
    `, [devtestOrgId]);

    const prodValueConfigs = await prodClient.query(`
      SELECT entity_type FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'value'
    `, [prodOrgId]);

    console.log(`\n🟢 Staging: ${stagingValueConfigs.rows.length} "value" configs`);
    stagingValueConfigs.rows.forEach(row => console.log(`   - ${row.entity_type}`));

    console.log(`\n🔵 Devtest: ${devtestValueConfigs.rows.length} "value" configs`);
    devtestValueConfigs.rows.forEach(row => console.log(`   - ${row.entity_type}`));

    console.log(`\n🔴 Production: ${prodValueConfigs.rows.length} "value" configs`);
    prodValueConfigs.rows.forEach(row => console.log(`   - ${row.entity_type}`));

    // Delete contacts value configs from staging and devtest
    console.log('\n\n🗑️  DELETING CONTACTS VALUE CONFIG FROM STAGING & DEVTEST');
    console.log('─'.repeat(100));

    console.log('\n1️⃣  Deleting from Staging...');
    const stgDelete = await stagingClient.query(
      'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2 AND entity_type = $3',
      [stagingOrgId, 'value', 'contacts']
    );
    console.log(`   ✅ Deleted ${stgDelete.rowCount} record(s)`);

    console.log('\n2️⃣  Deleting from Devtest...');
    const dvtDelete = await devtestClient.query(
      'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2 AND entity_type = $3',
      [devtestOrgId, 'value', 'contacts']
    );
    console.log(`   ✅ Deleted ${dvtDelete.rowCount} record(s)`);

    // Verify
    console.log('\n\n✅ VERIFICATION - AFTER DELETION');
    console.log('─'.repeat(100));

    const stagingAfter = await stagingClient.query(`
      SELECT entity_type FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'value'
    `, [stagingOrgId]);

    const devtestAfter = await devtestClient.query(`
      SELECT entity_type FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'value'
    `, [devtestOrgId]);

    console.log(`\n🟢 Staging: ${stagingAfter.rows.length} "value" configs`);
    stagingAfter.rows.forEach(row => console.log(`   - ${row.entity_type}`));

    console.log(`\n🔵 Devtest: ${devtestAfter.rows.length} "value" configs`);
    devtestAfter.rows.forEach(row => console.log(`   - ${row.entity_type}`));

    console.log(`\n🔴 Production: ${prodValueConfigs.rows.length} "value" configs`);
    prodValueConfigs.rows.forEach(row => console.log(`   - ${row.entity_type}`));

    // Check if all synced
    if (stagingAfter.rows.length === prodValueConfigs.rows.length &&
        devtestAfter.rows.length === prodValueConfigs.rows.length) {
      console.log('\n\n✅ SUCCESS - ALL ENVIRONMENTS SYNCHRONIZED');
      console.log('═'.repeat(100));
      console.log('\n🎯 VALUE FIELD CONFIGURATION STATUS:');
      console.log('   ✅ Production: Leads only (legitimate)');
      console.log('   ✅ Staging: Leads only (legitimate)');
      console.log('   ✅ Devtest: Leads only (legitimate)');
      console.log('\n✅ Contacts now use lifetime_value instead');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await Promise.all([stagingClient.end(), devtestClient.end(), prodClient.end()]);
  }
}

syncValueDeletion();
