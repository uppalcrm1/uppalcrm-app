const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_staging_user:D8F0YrSeJyOWmbfkg1BA12psG62Wo3dM@dpg-d35nudvdiees738fequg-a.oregon-postgres.render.com/uppalcrm_database_staging',
  ssl: { rejectUnauthorized: false }
});

async function runWhatsAppMigration() {
  try {
    console.log('🔄 RUNNING WHATSAPP MIGRATION ON STAGING\n');
    
    // 1. Run the migration
    console.log('STEP 1: Making user_id column nullable in lead_interactions...');
    await pool.query(`ALTER TABLE lead_interactions ALTER COLUMN user_id DROP NOT NULL`);
    console.log('✅ Migration executed successfully');
    
    // 2. Verify the change
    console.log('\nSTEP 2: Verifying user_id column is now nullable...');
    const verification = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'lead_interactions' AND column_name = 'user_id'
    `);
    
    if (verification.rowCount > 0) {
      const result = verification.rows[0];
      console.log(`Column: ${result.column_name}`);
      console.log(`Nullable: ${result.is_nullable} ${result.is_nullable === 'YES' ? '✅ (SUCCESS)' : '❌ (FAILED)'}`);
    } else {
      console.log('❌ Column user_id not found in lead_interactions table');
    }
    
    console.log('\n🎉 WHATSAPP MIGRATION COMPLETED');
    
  } catch (error) {
    console.error('Migration error:', error.message);
    console.error('Full error:', error);
  } finally {
    await pool.end();
  }
}

runWhatsAppMigration();