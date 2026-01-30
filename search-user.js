const { query } = require('./database/connection');

async function searchUser() {
  try {
    console.log('=== Searching for user with "ayush" in email ===');
    const result = await query(`
      SELECT id, email, first_name, last_name, organization_id, is_active 
      FROM users 
      WHERE email ILIKE '%ayush%' OR email ILIKE '%uppal%'
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No user found with "ayush" or "uppal" in email');
      console.log('\n=== Showing all users in production ===');
      const allUsers = await query('SELECT id, email, first_name, last_name, organization_id, is_active FROM users ORDER BY created_at DESC LIMIT 50');
      console.table(allUsers.rows);
    } else {
      console.log(`✅ Found ${result.rows.length} user(s):`);
      console.table(result.rows);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

searchUser();
