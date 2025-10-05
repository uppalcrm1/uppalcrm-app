const { query } = require('../database/connection');

(async () => {
  try {
    console.log('🔧 Fixing: Creating trial_signup for Uppal Solutions Ltd\n');

    // Get admin user
    const admin = await query(`
      SELECT email, first_name, last_name
      FROM users
      WHERE organization_id = '040b932d-2d7a-4ab8-a9be-b055347d7b65'
      AND role = 'admin'
      LIMIT 1
    `);

    if (admin.rows.length === 0) {
      console.log('❌ No admin user found');
      process.exit(1);
    }

    const adminUser = admin.rows[0];
    console.log('Found admin:', adminUser.email);

    // Create trial signup
    const result = await query(`
      INSERT INTO trial_signups (
        first_name, last_name, email, company, status,
        converted_organization_id, created_at
      ) VALUES ($1, $2, $3, $4, 'converted', $5, $6)
      RETURNING id, company, email, status
    `, [
      adminUser.first_name || 'Admin',
      adminUser.last_name || 'User',
      adminUser.email,
      'Uppal Solutions Ltd',
      '040b932d-2d7a-4ab8-a9be-b055347d7b65',
      new Date('2025-09-30T01:37:46.694Z')
    ]);

    console.log('\n✅ Created trial signup:');
    console.log('   Company:', result.rows[0].company);
    console.log('   Email:', result.rows[0].email);
    console.log('   Status:', result.rows[0].status);
    console.log('   ID:', result.rows[0].id);

    // Verify
    const count = await query(`
      SELECT COUNT(*) as count
      FROM trial_signups
      WHERE converted_organization_id = '040b932d-2d7a-4ab8-a9be-b055347d7b65'
    `);

    console.log('\n✅ Trial signup now linked to organization');
    console.log('   Total signups for this org:', count.rows[0].count);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
