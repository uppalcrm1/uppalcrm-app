const crypto = require('crypto');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function generateToken() {
  try {
    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    // Token expires in 1 hour
    const expiryTime = new Date(Date.now() + 60 * 60 * 1000);
    
    // Update user with reset token
    const result = await pool.query(`
      UPDATE users
      SET reset_token_hash = $1, reset_token_expiry = $2, updated_at = NOW()
      WHERE email = $3
      RETURNING id, email, first_name
    `, [resetTokenHash, expiryTime, 'ayushhuppaltv@gmail.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ User not found');
      await pool.end();
      process.exit(1);
    }
    
    const user = result.rows[0];
    console.log('\n✅ Password Reset Token Generated!\n');
    console.log('User:', user.first_name, '(' + user.email + ')');
    console.log('Token expires at:', expiryTime.toISOString());
    console.log('\n🔗 Password Reset Link:\n');
    
    const resetUrl = `https://your-app-url.com/reset-password/${resetToken}`;
    console.log(resetUrl);
    
    console.log('\n📝 Or send this API request to reset password:');
    console.log(`\nPOST /api/auth/reset-password/${resetToken}`);
    console.log('Content-Type: application/json');
    console.log('\n{');
    console.log('  "password": "newPassword123"');
    console.log('}');
    
    console.log('\n\n💡 Share the reset link with the user, or they can POST to the API endpoint with their new password.');
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await pool.end();
    process.exit(1);
  }
}

generateToken();
