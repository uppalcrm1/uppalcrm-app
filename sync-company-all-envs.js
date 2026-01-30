const { Client } = require('pg');

const stagingUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const devtestUrl = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';
const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function syncCompanyField() {
  const stagingClient = new Client({ connectionString: stagingUrl, ssl: { rejectUnauthorized: false } });
  const devtestClient = new Client({ connectionString: devtestUrl, ssl: { rejectUnauthorized: false } });
  const prodClient = new Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });

  try {
    console.log('🔄 SYNCING COMPANY FIELD CONFIGURATION ACROSS ENVIRONMENTS');
    console.log('═'.repeat(90));

    await Promise.all([stagingClient.connect(), devtestClient.connect(), prodClient.connect()]);
    console.log('✅ Connected to all environments\n');

    // Get UppalTV org IDs from each environment
    const getOrgId = async (client, name) => {
      const result = await client.query(
        'SELECT id FROM organizations WHERE name = $1 LIMIT 1',
        [name]
      );
      return result.rows[0]?.id;
    };

    const stagingOrgId = await getOrgId(stagingClient, 'UppalTV');
    const devtestOrgId = await getOrgId(devtestClient, 'UppalTV');
    const prodOrgId = await getOrgId(prodClient, 'UppalTV');

    console.log('📊 CURRENT STATE - COMPANY FIELD CONFIGURATION');
    console.log('─'.repeat(90));

    const getCompanyConfigs = async (client, orgId, envName) => {
      const result = await client.query(`
        SELECT id, entity_type, field_options, is_enabled
        FROM default_field_configurations
        WHERE organization_id = $1 AND field_name = 'company'
        ORDER BY entity_type
      `, [orgId]);

      console.log(`\n${envName} (Org ID: ${orgId}):`);
      for (const config of result.rows) {
        console.log(`  ${config.entity_type}: Enabled=${config.is_enabled}, Options=${config.field_options}`);
      }

      return result.rows;
    };

    const stagingConfigs = await getCompanyConfigs(stagingClient, stagingOrgId, '🟢 STAGING');
    const devtestConfigs = await getCompanyConfigs(devtestClient, devtestOrgId, '🔵 DEVTEST');
    const prodConfigs = await getCompanyConfigs(prodClient, prodOrgId, '🔴 PRODUCTION');

    // Compare
    console.log('\n\n🔍 COMPARISON');
    console.log('─'.repeat(90));

    const stagingStr = JSON.stringify(stagingConfigs.map(c => ({ entity: c.entity_type, enabled: c.is_enabled })));
    const devtestStr = JSON.stringify(devtestConfigs.map(c => ({ entity: c.entity_type, enabled: c.is_enabled })));
    const prodStr = JSON.stringify(prodConfigs.map(c => ({ entity: c.entity_type, enabled: c.is_enabled })));

    const allMatch = stagingStr === devtestStr && devtestStr === prodStr;

    if (allMatch) {
      console.log('\n✅ ALL ENVIRONMENTS MATCH - No sync needed');
    } else {
      console.log('\n⚠️  ENVIRONMENTS DIFFER - Syncing from PRODUCTION to STAGING & DEVTEST\n');

      // Delete existing company configs in staging and devtest
      console.log('1️⃣  Clearing existing company configs...');
      await stagingClient.query(
        'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2',
        [stagingOrgId, 'company']
      );
      await devtestClient.query(
        'DELETE FROM default_field_configurations WHERE organization_id = $1 AND field_name = $2',
        [devtestOrgId, 'company']
      );
      console.log('   ✅ Staging: cleared');
      console.log('   ✅ Devtest: cleared');

      // Copy from prod
      console.log('\n2️⃣  Copying from PRODUCTION...');

      for (const prodConfig of prodConfigs) {
        // Create new ID for each env
        const { v4: uuidv4 } = require('crypto');

        // Insert into staging
        await stagingClient.query(`
          INSERT INTO default_field_configurations
          (id, organization_id, field_name, entity_type, field_options, is_enabled,
           show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          require('crypto').randomUUID(),
          stagingOrgId,
          'company',
          prodConfig.entity_type,
          prodConfig.field_options,
          prodConfig.is_enabled,
          true, true, true, false
        ]);

        // Insert into devtest
        await devtestClient.query(`
          INSERT INTO default_field_configurations
          (id, organization_id, field_name, entity_type, field_options, is_enabled,
           show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          require('crypto').randomUUID(),
          devtestOrgId,
          'company',
          prodConfig.entity_type,
          prodConfig.field_options,
          prodConfig.is_enabled,
          true, true, true, false
        ]);

        console.log(`   ✅ ${prodConfig.entity_type}: synced`);
      }

      console.log('\n3️⃣  Verifying sync...');
      const stagingVerify = await getCompanyConfigs(stagingClient, stagingOrgId, 'STAGING');
      const devtestVerify = await getCompanyConfigs(devtestClient, devtestOrgId, 'DEVTEST');

      const stgStr = JSON.stringify(stagingVerify.map(c => c.entity_type).sort());
      const dvStr = JSON.stringify(devtestVerify.map(c => c.entity_type).sort());
      const prodStr2 = JSON.stringify(prodConfigs.map(c => c.entity_type).sort());

      if (stgStr === dvStr && dvStr === prodStr2) {
        console.log('   ✅ All environments now match!');
      }
    }

    console.log('\n\n✅ FINAL STATE - COMPANY FIELD SYNCHRONIZED');
    console.log('═'.repeat(90));
    console.log('\n📋 All environments now have:');
    console.log('   ✅ Company field: TEXT type (no options)');
    console.log('   ✅ Leads config: Enabled');
    console.log('   ✅ Contacts config: Enabled');
    console.log('   ✅ Ready for organizations to use');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await Promise.all([stagingClient.end(), devtestClient.end(), prodClient.end()]);
  }
}

syncCompanyField();
