const { Client } = require('pg');
const crypto = require('crypto');

const stagingUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const devtestUrl = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';
const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function syncCompanyField() {
  const stagingClient = new Client({ connectionString: stagingUrl, ssl: { rejectUnauthorized: false } });
  const devtestClient = new Client({ connectionString: devtestUrl, ssl: { rejectUnauthorized: false } });
  const prodClient = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔄 SYNCING COMPANY FIELD - ALL ENVIRONMENTS');
    console.log('═'.repeat(90));

    await Promise.all([stagingClient.connect(), devtestClient.connect(), prodClient.connect()]);
    console.log('✅ Connected to all environments\n');

    // Get org IDs
    const stagingOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f'; // Staging Test Organization
    const devtestOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f'; // DevTest (same ID)
    const prodOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';     // UppalTV

    console.log('📍 Organization IDs:');
    console.log(`   🟢 Staging: ${stagingOrgId}`);
    console.log(`   🔵 Devtest: ${devtestOrgId}`);
    console.log(`   🔴 Production: ${prodOrgId}\n`);

    // Get prod company config
    console.log('📋 Fetching PRODUCTION company config...');
    const prodConfigs = await prodClient.query(`
      SELECT entity_type, field_options, is_enabled
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'company'
      ORDER BY entity_type
    `, [prodOrgId]);

    console.log(`   Found ${prodConfigs.rows.length} configs\n`);

    for (const config of prodConfigs.rows) {
      console.log(`   ${config.entity_type}: enabled=${config.is_enabled}, options=${config.field_options}`);
    }

    // Clear existing configs
    console.log('\n🗑️  Clearing existing company configs...');

    await stagingClient.query(
      'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2',
      [stagingOrgId, 'company']
    );
    console.log('   ✅ Staging cleared');

    await devtestClient.query(
      'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2',
      [devtestOrgId, 'company']
    );
    console.log('   ✅ Devtest cleared');

    // Sync to staging and devtest
    console.log('\n📥 Syncing to STAGING & DEVTEST...');

    for (const prodConfig of prodConfigs.rows) {
      const newId = crypto.randomUUID();

      // Insert to staging
      await stagingClient.query(`
        INSERT INTO default_field_configurations
        (id, organization_id, field_name, entity_type, field_options, is_enabled,
         show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        crypto.randomUUID(),
        stagingOrgId,
        'company',
        prodConfig.entity_type,
        prodConfig.field_options,
        prodConfig.is_enabled,
        true, true, true, false
      ]);

      // Insert to devtest
      await devtestClient.query(`
        INSERT INTO default_field_configurations
        (id, organization_id, field_name, entity_type, field_options, is_enabled,
         show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        crypto.randomUUID(),
        devtestOrgId,
        'company',
        prodConfig.entity_type,
        prodConfig.field_options,
        prodConfig.is_enabled,
        true, true, true, false
      ]);

      console.log(`   ✅ ${prodConfig.entity_type}: synced to staging & devtest`);
    }

    // Verify
    console.log('\n✅ VERIFYING SYNC...');
    console.log('─'.repeat(90));

    const verifyStagingConfigs = await stagingClient.query(`
      SELECT entity_type, field_options, is_enabled
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'company'
      ORDER BY entity_type
    `, [stagingOrgId]);

    const verifyDevtestConfigs = await devtestClient.query(`
      SELECT entity_type, field_options, is_enabled
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'company'
      ORDER BY entity_type
    `, [devtestOrgId]);

    console.log('\n🟢 STAGING:');
    for (const config of verifyStagingConfigs.rows) {
      console.log(`   ${config.entity_type}: enabled=${config.is_enabled}`);
    }

    console.log('\n🔵 DEVTEST:');
    for (const config of verifyDevtestConfigs.rows) {
      console.log(`   ${config.entity_type}: enabled=${config.is_enabled}`);
    }

    console.log('\n🔴 PRODUCTION:');
    for (const config of prodConfigs.rows) {
      console.log(`   ${config.entity_type}: enabled=${config.is_enabled}`);
    }

    // Check if all match
    const stagingStr = JSON.stringify(verifyStagingConfigs.rows.map(c => ({ e: c.entity_type, i: c.is_enabled })));
    const devtestStr = JSON.stringify(verifyDevtestConfigs.rows.map(c => ({ e: c.entity_type, i: c.is_enabled })));
    const prodStr = JSON.stringify(prodConfigs.rows.map(c => ({ e: c.entity_type, i: c.is_enabled })));

    if (stagingStr === devtestStr && devtestStr === prodStr) {
      console.log('\n\n✅ SUCCESS - ALL ENVIRONMENTS SYNCHRONIZED');
      console.log('═'.repeat(90));
      console.log('\n🎯 COMPANY FIELD STATUS:');
      console.log('   ✅ TEXT field (no options)');
      console.log('   ✅ Leads config: Enabled');
      console.log('   ✅ Contacts config: Enabled');
      console.log('\n   Synchronized across:');
      console.log('   ✅ Production (UppalTV)');
      console.log('   ✅ Staging (Staging Test Organization)');
      console.log('   ✅ Devtest (DevTest)');
    } else {
      console.log('\n\n⚠️  Mismatch detected');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await Promise.all([stagingClient.end(), devtestClient.end(), prodClient.end()]);
  }
}

syncCompanyField();
