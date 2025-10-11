const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixLeadTrigger() {
  const client = await pool.connect();

  try {
    console.log('🔧 Starting lead trigger fix...');

    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '..', 'database', 'fix-lead-trigger-column-names.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the migration
    await client.query(sql);

    console.log('✅ Lead trigger fixed successfully!');
    console.log('   - Updated track_lead_changes() function to use correct column names');
    console.log('   - Changed lead_value -> value');
    console.log('   - Changed lead_source -> source');

  } catch (error) {
    console.error('❌ Error fixing lead trigger:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixLeadTrigger();
