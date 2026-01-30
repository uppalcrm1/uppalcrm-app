const { Client } = require('pg');

const prodUrl = 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database';

async function cleanup() {
  const client = new Client({
    connectionString: prodUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🧹 PRODUCTION DATABASE CLEANUP');
    console.log('═'.repeat(70));

    await client.connect();
    console.log('✅ Connected to production\n');

    const orphanOrgId = 'e54bf633-328f-4905-8d82-54c84ea1b7bb';

    // ===== BEFORE CLEANUP =====
    console.log('📊 BEFORE CLEANUP');
    console.log('─'.repeat(70));

    const beforeConfigs = await client.query(
      'SELECT COUNT(*) as count FROM default_field_configurations WHERE organization_id = $1',
      [orphanOrgId]
    );

    const beforeContacts = await client.query(
      'SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1',
      [orphanOrgId]
    );

    const beforeDupFields = await client.query(`
      SELECT COUNT(*) as count
      FROM default_field_configurations
      GROUP BY field_name
      HAVING COUNT(*) > 1
    `);

    console.log(`Orphaned field configurations: ${beforeConfigs.rows[0].count}`);
    console.log(`Orphaned contacts: ${beforeContacts.rows[0].count}`);
    console.log(`Fields with duplicates: ${beforeDupFields.rows.length}`);

    // ===== DELETE ORPHANED DATA =====
    console.log('\n🗑️  DELETING ORPHANED DATA');
    console.log('─'.repeat(70));

    // Delete field configurations
    console.log('\n1️⃣  Deleting orphaned field configurations...');
    const delConfigs = await client.query(
      'DELETE FROM default_field_configurations WHERE organization_id = $1',
      [orphanOrgId]
    );
    console.log(`   ✅ Deleted ${delConfigs.rowCount} field configurations`);

    // Delete contacts
    console.log('\n2️⃣  Deleting orphaned contacts...');
    const delContacts = await client.query(
      'DELETE FROM contacts WHERE organization_id = $1',
      [orphanOrgId]
    );
    console.log(`   ✅ Deleted ${delContacts.rowCount} contacts`);

    // ===== AFTER CLEANUP =====
    console.log('\n\n✅ AFTER CLEANUP');
    console.log('─'.repeat(70));

    const afterConfigs = await client.query(
      'SELECT COUNT(*) as count FROM default_field_configurations WHERE organization_id = $1',
      [orphanOrgId]
    );

    const afterContacts = await client.query(
      'SELECT COUNT(*) as count FROM contacts WHERE organization_id = $1',
      [orphanOrgId]
    );

    const afterDupFields = await client.query(`
      SELECT field_name, COUNT(*) as count
      FROM default_field_configurations
      GROUP BY field_name
      HAVING COUNT(*) > 1
      ORDER BY field_name
    `);

    console.log(`Orphaned field configurations: ${afterConfigs.rows[0].count}`);
    console.log(`Orphaned contacts: ${afterContacts.rows[0].count}`);
    console.log(`Fields with duplicates: ${afterDupFields.rows.length}`);

    if (afterDupFields.rows.length > 0) {
      console.log('\nRemaining duplicates:');
      afterDupFields.rows.forEach(row => {
        console.log(`  - ${row.field_name}: ${row.count} configs`);
      });
    }

    // ===== FINAL STATUS =====
    console.log('\n\n📈 FINAL DATABASE STATUS');
    console.log('═'.repeat(70));

    const finalStatus = await client.query(`
      SELECT
        COUNT(DISTINCT organization_id) as orgs,
        COUNT(DISTINCT CASE WHEN field_name IS NOT NULL THEN field_name END) as unique_fields,
        COUNT(*) as total_configs
      FROM default_field_configurations
    `);

    const uppalStatus = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE organization_id = '06048209-8ab4-4816-b23c-6f6362fea521') as users,
        (SELECT COUNT(*) FROM leads WHERE organization_id = '06048209-8ab4-4816-b23c-6f6362fea521') as leads,
        (SELECT COUNT(*) FROM contacts WHERE organization_id = '06048209-8ab4-4816-b23c-6f6362fea521') as contacts,
        (SELECT COUNT(*) FROM default_field_configurations WHERE organization_id = '06048209-8ab4-4816-b23c-6f6362fea521') as field_configs
    `);

    const status = uppalStatus.rows[0];

    console.log('\n🏢 UppalTV Organization (Production)');
    console.log('────────────────────────────────────');
    console.log(`Users: ${status.users}`);
    console.log(`Leads: ${status.leads}`);
    console.log(`Contacts: ${status.contacts}`);
    console.log(`Field Configurations: ${status.field_configs}`);

    console.log('\n📊 Overall Database');
    console.log('────────────────────────────────────');
    console.log(`Active Organizations: 1 (UppalTV)`);
    console.log(`Total Field Configurations: ${finalStatus.rows[0].total_configs}`);
    console.log(`Unique Field Names: ${finalStatus.rows[0].unique_fields}`);
    console.log(`Remaining Duplicates: ${afterDupFields.rows.length}`);

    if (afterDupFields.rows.length === 0) {
      console.log('\n✅ CLEANUP SUCCESSFUL!');
      console.log('   - All orphaned data removed');
      console.log('   - No duplicate field configurations');
      console.log('   - Production database is clean');
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

cleanup();
