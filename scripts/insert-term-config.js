const { query, closePool } = require('../database/connection');

const DevTestOrgId = '4af68759-65cf-4b38-8fd5-e6f41d7a726f';

const insertTermConfig = async () => {
  try {
    console.log('\n📝 Inserting term field configuration for DevTest org...\n');

    const insertResult = await query(`
      INSERT INTO default_field_configurations
      (organization_id, entity_type, field_name, field_options, is_enabled, is_required, sort_order, overall_visibility, visibility_logic, show_in_create_form, show_in_edit_form, show_in_detail_view, show_in_list_view)
      VALUES
      (
        $1,
        'transactions',
        'term',
        $2::jsonb,
        true,
        true,
        0,
        'visible',
        'master_override',
        true,
        true,
        true,
        false
      )
      RETURNING *;
    `, [
      DevTestOrgId,
      JSON.stringify([
        {"label": "1 Month",  "value": 1,  "is_default": true, "sort_order": 1},
        {"label": "3 Months", "value": 3,  "is_default": true, "sort_order": 2},
        {"label": "6 Months", "value": 6,  "is_default": true, "sort_order": 3},
        {"label": "1 Year",   "value": 12, "is_default": true, "sort_order": 4}
      ])
    ]);

    if (insertResult.rows.length === 0) {
      console.error('❌ Insert failed - no rows returned');
      process.exit(1);
    }

    console.log('✅ Successfully inserted term field configuration!\n');
    const insertedRow = insertResult.rows[0];
    console.log('📋 INSERTED ROW:');
    console.log('─'.repeat(80));
    Object.keys(insertedRow).forEach(key => {
      const value = insertedRow[key];
      if (key === 'field_options' && typeof value === 'object') {
        console.log(`  ${key}:`);
        console.log(JSON.stringify(value, null, 4).split('\n').map(line => `    ${line}`).join('\n'));
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log('─'.repeat(80));

    // Now query it back to confirm
    console.log('\n✔️ Querying the inserted row back to confirm...\n');

    const queryResult = await query(`
      SELECT * FROM default_field_configurations
      WHERE organization_id = $1
      AND entity_type = 'transactions'
      AND field_name = 'term'
    `, [DevTestOrgId]);

    if (queryResult.rows.length === 0) {
      console.error('❌ Query failed - row not found');
      process.exit(1);
    }

    console.log('✅ Successfully queried term field configuration!\n');
    const queriedRow = queryResult.rows[0];
    console.log('📋 QUERIED ROW:');
    console.log('─'.repeat(80));
    Object.keys(queriedRow).forEach(key => {
      const value = queriedRow[key];
      if (key === 'field_options' && typeof value === 'object') {
        console.log(`  ${key}:`);
        console.log(JSON.stringify(value, null, 4).split('\n').map(line => `    ${line}`).join('\n'));
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });
    console.log('─'.repeat(80));

    console.log('\n✨ Term field configuration successfully inserted and verified!\n');

    await closePool();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.detail) {
      console.error('   Detail:', error.detail);
    }
    await closePool();
    process.exit(1);
  }
};

insertTermConfig();
