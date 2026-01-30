const { query } = require('./database/connection');

async function listUsers() {
  try {
    const result = await query('SELECT id, email, first_name, last_name FROM users WHERE is_active = true LIMIT 50');
    console.table(result.rows);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

listUsers();
