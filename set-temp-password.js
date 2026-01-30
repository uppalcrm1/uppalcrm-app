const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function setPassword() {
  try {
    const tempPassword = 'TempPass123!@#';
    const passwordHash = await bcrypt.hash(tempPassword, 12);
    
    const result = await pool.query(`
      UPDATE users
      SET password_hash = $1, is_first_login = true, updated_at = NOW()
      WHERE email = $2
      RETURNING id, email, first_name, last_name
    `, [passwordHash, 'ayushhuppaltv@gmail.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('\n✅ Temporary Password Set!\n');
    console.log('User:', user.first_name, user.last_name);
    console.log('Email:', user.email);
    console.log('\n🔐 Temporary Password:');
    console.log(tempPassword);
    console.log('\n📝 Next steps:');
    console.log('1. Share the email and password with Ayush');
    console.log('2. He should login and change the password on first login');
    console.log('3. Mark as first login: Yes\n');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

setPassword();
