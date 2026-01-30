const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function searchUser() {
  try {
    console.log('🔍 Searching production database...\n');
    
    // Search for the user
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, organization_id, is_active 
      FROM users 
      WHERE email ILIKE '%ayush%'
      ORDER BY created_at DESC
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found with "ayush" in email\n');
      console.log('📊 Showing ALL users in production:');
      const allUsers = await pool.query('SELECT id, email, first_name, last_name, is_active FROM users ORDER BY created_at DESC LIMIT 50');
      console.table(allUsers.rows);
    } else {
      console.log(`✅ Found ${result.rows.length} user(s):\n`);
      console.table(result.rows);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

searchUser();
