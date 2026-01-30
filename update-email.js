const { query } = require('./database/connection');

async function updateEmail() {
  try {
    console.log('Updating email...');
    
    const result = await query(
      "UPDATE users SET email = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email",
      ['ayushhuppaltv@gmail.com', 'ayushuppaltv@gmail.com']
    );

    if (result.rows.length === 0) {
      console.log('❌ User not found with email: ayushuppaltv@gmail.com');
    } else {
      console.log('✅ Email updated successfully!');
      console.log('Updated user:', result.rows[0]);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateEmail();
