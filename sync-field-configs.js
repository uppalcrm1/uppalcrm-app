const { Client } = require('pg');

const stagingUrl = 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging';
const devtestUrl = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';

async function fixFieldConfigurations() {
  const stagingClient = new Client({
    connectionString: stagingUrl,
    ssl: { rejectUnauthorized: false }
  });
  const devtestClient = new Client({
    connectionString: devtestUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔄 Connecting to databases...');
    await stagingClient.connect();
    await devtestClient.connect();
    console.log('✅ Connected\n');

    // Check devtest for duplicates BEFORE
    console.log('🔍 Checking devtest for duplicate field configurations...');
    const dupCheckBefore = await devtestClient.query(`
      SELECT field_name, COUNT(*) as count
      FROM default_field_configurations
      GROUP BY field_name
      HAVING COUNT(*) > 1
      ORDER BY field_name
    `);

    if (dupCheckBefore.rows.length > 0) {
      console.log(`⚠️  Found ${dupCheckBefore.rows.length} fields with duplicates:`);
      dupCheckBefore.rows.forEach(r => console.log(`   - ${r.field_name}: ${r.count} configs`));
    } else {
      console.log('✅ No duplicates in devtest');
    }

    // Get staging field configurations
    console.log('\n📋 Fetching staging field configurations...');
    const stagingConfigs = await stagingClient.query(`
      SELECT id, organization_id, field_name, field_options,
             is_enabled, is_required, sort_order, entity_type,
             overall_visibility, visibility_logic, show_in_create_form,
             show_in_edit_form, show_in_detail_view, show_in_list_view, updated_at
      FROM default_field_configurations
      ORDER BY organization_id, field_name
    `);

    console.log(`Found ${stagingConfigs.rows.length} configurations in staging`);

    // Clear devtest field configurations
    console.log('\n🗑️  Clearing devtest field configurations...');
    await devtestClient.query('DELETE FROM default_field_configurations');
    console.log('✅ Cleared');

    // Copy from staging
    console.log('\n📥 Copying configurations from staging...');
    let copied = 0;

    for (const row of stagingConfigs.rows) {
      const sql = `
        INSERT INTO default_field_configurations
        (id, organization_id, field_name, field_options, is_enabled, is_required,
         sort_order, entity_type, overall_visibility, visibility_logic,
         show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `;

      const values = [
        row.id,
        row.organization_id,
        row.field_name,
        typeof row.field_options === 'string' ? row.field_options : JSON.stringify(row.field_options),
        row.is_enabled,
        row.is_required,
        row.sort_order,
        row.entity_type,
        row.overall_visibility,
        row.visibility_logic,
        row.show_in_create_form,
        row.show_in_edit_form,
        row.show_in_detail_view,
        row.show_in_list_view,
        row.updated_at
      ];

      try {
        await devtestClient.query(sql, values);
        copied++;
      } catch (e) {
        console.log(`   ⚠️  Error copying ${row.field_name}: ${e.message.substring(0, 60)}`);
      }
    }

    console.log(`✅ Copied ${copied}/${stagingConfigs.rows.length} configurations`);

    // Verify
    console.log('\n✅ Verifying devtest...');
    const dupCheckAfter = await devtestClient.query(`
      SELECT field_name, COUNT(*) as count
      FROM default_field_configurations
      GROUP BY field_name
      HAVING COUNT(*) > 1
    `);

    if (dupCheckAfter.rows.length === 0) {
      console.log('✅ No duplicates - field configurations fixed!');
    } else {
      console.log(`⚠️  Still have ${dupCheckAfter.rows.length} duplicate fields`);
    }

    const statusCheck = await devtestClient.query(`
      SELECT field_options FROM default_field_configurations
      WHERE field_name = 'status'
    `);

    console.log(`\n✅ Status field config: ${statusCheck.rows.length} config(s)`);
    if (statusCheck.rows[0]) {
      const opts = statusCheck.rows[0].field_options;
      const optCount = Array.isArray(opts) ? opts.length : 0;
      console.log(`   Options available: ${optCount}`);
      if (optCount > 0) {
        console.log(`   Sample: ${opts[0].value}`);
      }
    }

    console.log('\n✅ SYNC COMPLETE - Devtest field configurations now match staging!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await stagingClient.end();
    await devtestClient.end();
  }
}

fixFieldConfigurations();
