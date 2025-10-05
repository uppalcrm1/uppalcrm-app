const { query } = require('../database/connection');

(async () => {
  try {
    // First, check what columns exist
    console.log('🔍 Checking organizations table structure...\n');
    const columnsResult = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'organizations'
      ORDER BY ordinal_position
    `);

    console.log('📋 Columns in organizations table:');
    columnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // Get statistics
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active,
        COUNT(CASE WHEN is_active = false THEN 1 END) as inactive
      FROM organizations
    `);

    console.log('📊 Organization Statistics:');
    console.log('Total organizations:', result.rows[0].total);
    console.log('Active:', result.rows[0].active);
    console.log('Inactive:', result.rows[0].inactive);

    // Get list of all organizations
    const orgs = await query(`
      SELECT *
      FROM organizations
      ORDER BY created_at DESC
    `);

    console.log('\n📋 All Organizations:');
    orgs.rows.forEach((org, i) => {
      console.log(`${i + 1}. ${org.name} (slug: ${org.slug})`);
      console.log(`   ID: ${org.id}`);
      console.log(`   Active: ${org.is_active}`);
      console.log(`   Created: ${org.created_at}`);
      console.log(`   All fields:`, JSON.stringify(org, null, 2));
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
