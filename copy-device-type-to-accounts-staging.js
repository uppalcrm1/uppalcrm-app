const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function copyDeviceTypeToAccounts() {
  const stagingOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';
  
  try {
    console.log('Checking device_type in staging organization...\n');
    
    // Check what exists
    const existingResult = await pool.query(`
      SELECT entity_type, field_name, field_label, field_type, field_options, is_enabled, created_by
      FROM custom_field_definitions
      WHERE organization_id = $1
        AND field_name = 'device_type'
      ORDER BY entity_type
    `, [stagingOrgId]);
    
    console.log('📱 Existing device_type fields:');
    console.table(existingResult.rows.map(r => ({
      entity: r.entity_type,
      label: r.field_label,
      type: r.field_type,
      options: r.field_options ? r.field_options.length : 0,
      enabled: r.is_enabled
    })));
    
    if (existingResult.rows.length === 0) {
      console.log('\n❌ No device_type field found in staging!');
      return;
    }
    
    // Get the leads version as the source
    const leadsField = existingResult.rows.find(r => r.entity_type === 'leads');
    if (!leadsField) {
      console.log('\n❌ device_type not found for leads!');
      return;
    }
    
    console.log('\n📋 Source field (leads):');
    console.log('  Options:', leadsField.field_options);
    
    // Copy to accounts if it doesn't exist
    const accountsField = existingResult.rows.find(r => r.entity_type === 'accounts');
    if (accountsField) {
      console.log('\n✅ device_type already exists for accounts!');
    } else {
      console.log('\n📝 Copying device_type to accounts...');
      await pool.query(`
        INSERT INTO custom_field_definitions 
        (organization_id, entity_type, field_name, field_label, field_type, field_options, is_required, is_enabled, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        stagingOrgId,
        'accounts',
        leadsField.field_name,
        leadsField.field_label,
        leadsField.field_type,
        JSON.stringify(leadsField.field_options),
        false,
        true,
        leadsField.created_by
      ]);
      console.log('✅ device_type copied to accounts!');
    }
    
    // Verify
    const finalResult = await pool.query(`
      SELECT entity_type, field_name
      FROM custom_field_definitions
      WHERE organization_id = $1
        AND field_name = 'device_type'
      ORDER BY entity_type
    `, [stagingOrgId]);
    
    console.log('\n✅ Final status:');
    console.log('  Entities with device_type:', finalResult.rows.map(r => r.entity_type).join(', '));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

copyDeviceTypeToAccounts();
