const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function updateEmail() {
  try {
    console.log('🔄 Updating email in production database...\n');
    
    const result = await pool.query(`
      UPDATE users 
      SET email = $1, updated_at = NOW()
      WHERE email = $2
      RETURNING id, email, first_name, last_name
    `, ['ayushhuppaltv@gmail.com', 'ayushuppaltv@gmail.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
    } else {
      console.log('✅ Email updated successfully!\n');
      console.table(result.rows);
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

updateEmail();
