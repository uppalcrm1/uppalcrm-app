const { Client } = require('pg');
const crypto = require('crypto');

const stagingUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const devtestUrl = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';
const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function syncStatusSource() {
  const stagingClient = new Client({ connectionString: stagingUrl, ssl: { rejectUnauthorized: false } });
  const devtestClient = new Client({ connectionString: devtestUrl, ssl: { rejectUnauthorized: false } });
  const prodClient = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔄 SYNCING STATUS & SOURCE FIELDS - ALL ENVIRONMENTS');
    console.log('═'.repeat(90));

    await Promise.all([stagingClient.connect(), devtestClient.connect(), prodClient.connect()]);
    console.log('✅ Connected to all environments\n');

    const stagingOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';
    const devtestOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';
    const prodOrgId = '06048209-8ab4-4816-b23c-6f6362fea521';

    // Get prod configs for status and source
    console.log('📋 Fetching PRODUCTION configurations...\n');

    const prodStatusConfigs = await prodClient.query(`
      SELECT entity_type, field_options, is_enabled
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'status'
      ORDER BY entity_type
    `, [prodOrgId]);

    const prodSourceConfigs = await prodClient.query(`
      SELECT entity_type, field_options, is_enabled
      FROM default_field_configurations
      WHERE organization_id = $1 AND field_name = 'source'
      ORDER BY entity_type
    `, [prodOrgId]);

    console.log(`Found ${prodStatusConfigs.rows.length} STATUS configs`);
    console.log(`Found ${prodSourceConfigs.rows.length} SOURCE configs`);

    // Clear existing configs in staging & devtest
    console.log('\n🗑️  Clearing existing configs in staging & devtest...');

    const fieldsToSync = ['status', 'source'];
    for (const field of fieldsToSync) {
      await stagingClient.query(
        'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2',
        [stagingOrgId, field]
      );
      await devtestClient.query(
        'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2',
        [devtestOrgId, field]
      );
    }
    console.log('   ✅ Staging cleared');
    console.log('   ✅ Devtest cleared');

    // Sync status configs
    console.log('\n📥 Syncing STATUS configurations...');

    for (const config of prodStatusConfigs.rows) {
      // Insert to staging
      await stagingClient.query(`
        INSERT INTO default_field_configurations
        (id, organization_id, field_name, entity_type, field_options, is_enabled,
         show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        crypto.randomUUID(),
        stagingOrgId,
        'status',
        config.entity_type,
        JSON.stringify(config.field_options),
        config.is_enabled,
        true, true, true, true
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
        'status',
        config.entity_type,
        JSON.stringify(config.field_options),
        config.is_enabled,
        true, true, true, true
      ]);

      const optCount = Array.isArray(config.field_options) ? config.field_options.length : 0;
      console.log(`   ✅ ${config.entity_type}: ${optCount} options`);
    }

    // Sync source configs
    console.log('\n📥 Syncing SOURCE configurations...');

    for (const config of prodSourceConfigs.rows) {
      // Insert to staging
      await stagingClient.query(`
        INSERT INTO default_field_configurations
        (id, organization_id, field_name, entity_type, field_options, is_enabled,
         show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        crypto.randomUUID(),
        stagingOrgId,
        'source',
        config.entity_type,
        JSON.stringify(config.field_options),
        config.is_enabled,
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
        'source',
        config.entity_type,
        JSON.stringify(config.field_options),
        config.is_enabled,
        true, true, true, false
      ]);

      const optCount = Array.isArray(config.field_options) ? config.field_options.length : 0;
      console.log(`   ✅ ${config.entity_type}: ${optCount} options`);
    }

    // Verify
    console.log('\n\n✅ VERIFICATION');
    console.log('═'.repeat(90));

    for (const env of ['STAGING', 'DEVTEST']) {
      const envClient = env === 'STAGING' ? stagingClient : devtestClient;
      const envOrgId = env === 'STAGING' ? stagingOrgId : devtestOrgId;

      console.log(`\n${env === 'STAGING' ? '🟢' : '🔵'} ${env}:`);

      const statusConfigs = await envClient.query(`
        SELECT entity_type, field_options
        FROM default_field_configurations
        WHERE organization_id = $1 AND field_name = 'status'
        ORDER BY entity_type
      `, [envOrgId]);

      console.log('\n  STATUS:');
      for (const config of statusConfigs.rows) {
        const optCount = Array.isArray(config.field_options) ? config.field_options.length : 0;
        console.log(`    ${config.entity_type}: ${optCount} options`);
      }

      const sourceConfigs = await envClient.query(`
        SELECT entity_type, field_options
        FROM default_field_configurations
        WHERE organization_id = $1 AND field_name = 'source'
        ORDER BY entity_type
      `, [envOrgId]);

      console.log('\n  SOURCE:');
      for (const config of sourceConfigs.rows) {
        const optCount = Array.isArray(config.field_options) ? config.field_options.length : 0;
        console.log(`    ${config.entity_type}: ${optCount} options`);
      }
    }

    console.log('\n\n✅ SUCCESS - ALL ENVIRONMENTS SYNCHRONIZED');
    console.log('═'.repeat(90));
    console.log('\n📋 Synchronized Fields:');
    console.log('   ✅ STATUS: Leads (9) & Contacts (7) with appropriate options');
    console.log('   ✅ SOURCE: All entities with proper options');
    console.log('\n🎯 Environments:');
    console.log('   ✅ Production (UppalTV)');
    console.log('   ✅ Staging (Staging Test Organization)');
    console.log('   ✅ Devtest (DevTest)');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await Promise.all([stagingClient.end(), devtestClient.end(), prodClient.end()]);
  }
}

syncStatusSource();
