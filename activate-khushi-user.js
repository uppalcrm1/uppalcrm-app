require('dotenv').config();
const { query } = require('./database/connection');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function activateKhushiUser() {
  try {
    console.log('🔧 Activating Khushi Sekhri user...\n');

    // Uppal TV org ID
    const orgId = '06048209-8ab4-4816-b23c-6f6362fea521';

    // Generate a secure random password
    const newPassword = crypto.randomBytes(12).toString('base64').slice(0, 16);
    console.log('🔑 Generated new password:', newPassword);
    console.log('');

    // Hash the password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update user - activate and set new password
    const result = await query(
      `UPDATE users 
       SET is_active = true, 
           password_hash = $1, 
           updated_at = NOW()
       WHERE email = $2 AND organization_id = $3
       RETURNING id, email, first_name, last_name, role, is_active`,
      [passwordHash, 'khushiuppaltv@gmail.com', orgId]
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found');
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('✅ User activated successfully!');
    console.log('');
    console.log('📋 User Details:');
    console.log(`   Name: ${user.first_name} ${user.last_name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Status: ${user.is_active ? 'Active' : 'Inactive'}`);
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log(`   Email: ${user.email}`);
    console.log(`   Password: ${newPassword}`);
    console.log('');
    console.log('⚠️  User should change this password on first login');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error activating user:', error);
    process.exit(1);
  }
}

activateKhushiUser();
