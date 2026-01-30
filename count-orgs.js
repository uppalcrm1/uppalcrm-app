const { query } = require('./database/connection');

async function countOrgs() {
  try {
    const result = await query(`
      SELECT id, name, slug, created_at, 
             (SELECT COUNT(*) FROM users WHERE organization_id = organizations.id) as user_count
      FROM organizations
      ORDER BY created_at DESC
    `);
    
    console.log(`\n✅ Total organizations: ${result.rows.length}\n`);
    console.table(result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

countOrgs();
