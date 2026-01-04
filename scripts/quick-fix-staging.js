const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging',
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🔧 Fixing source field for leads...\n');

    const orgs = await client.query('SELECT id, name FROM organizations');

    for (const org of orgs.rows) {
      // First check if it exists
      const existing = await client.query(`
        SELECT id FROM custom_field_definitions
        WHERE organization_id = $1 AND entity_type = 'leads' AND field_name = 'source'
      `, [org.id]);

      const fieldOptions = JSON.stringify([
        {value: 'website', label: 'Website'},
        {value: 'referral', label: 'Referral'},
        {value: 'social-media', label: 'Social Media'},
        {value: 'cold-call', label: 'Cold Call'},
        {value: 'email', label: 'Email'},
        {value: 'advertisement', label: 'Advertisement'},
        {value: 'trade-show', label: 'Trade Show'},
        {value: 'other', label: 'Other'}
      ]);

      if (existing.rows.length > 0) {
        // Update existing
        await client.query(`
          UPDATE custom_field_definitions
          SET field_options = $1::jsonb, is_enabled = true, updated_at = NOW()
          WHERE id = $2
        `, [fieldOptions, existing.rows[0].id]);
        console.log(`🔄 ${org.name}: Updated source field for leads`);
      } else {
        // Insert new
        await client.query(`
          INSERT INTO custom_field_definitions (
            organization_id, field_name, field_label, entity_type,
            field_type, is_required, is_enabled, sort_order,
            show_in_create_form, show_in_edit_form, show_in_detail_view,
            field_options, created_at, updated_at
          ) VALUES (
            $1, 'source', 'Source', 'leads',
            'select', false, true, 10,
            true, true, true,
            $2::jsonb, NOW(), NOW()
          )
        `, [org.id, fieldOptions]);
        console.log(`✅ ${org.name}: Created source field for leads`);
      }
    }

    const check = await client.query(`
      SELECT entity_type, COUNT(*) FROM custom_field_definitions
      WHERE field_name = 'source' GROUP BY entity_type ORDER BY entity_type
    `);

    console.log('\n📊 Source fields by entity type:');
    console.table(check.rows);

    await client.query('COMMIT');
    console.log('\n✅ SUCCESS! Leads source field is now fixed.');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(console.error);
