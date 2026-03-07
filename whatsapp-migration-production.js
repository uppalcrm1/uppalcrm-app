const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uppalcrm_database_user:PvPTfZUaaKLum1EjDOdOA9ZCReN03ATk@dpg-d2p6asl6ubrc73bvo1h0-a.oregon-postgres.render.com/uppalcrm_database',
  ssl: { rejectUnauthorized: false }
});

async function runProductionWhatsAppMigration() {
  try {
    console.log('🔄 RUNNING WHATSAPP MIGRATION ON PRODUCTION DATABASE\n');
    console.log('⚠️  WARNING: This will modify the PRODUCTION database!\n');
    
    // 1. Run the migration
    console.log('STEP 1: Making user_id column nullable in lead_interactions...');
    console.log('Executing: ALTER TABLE lead_interactions ALTER COLUMN user_id DROP NOT NULL;');
    
    await pool.query(`ALTER TABLE lead_interactions ALTER COLUMN user_id DROP NOT NULL`);
    console.log('✅ Migration executed successfully on PRODUCTION');
    
    // 2. Verify the change
    console.log('\nSTEP 2: Verifying user_id column is now nullable...');
    console.log('Executing: SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = \'lead_interactions\' AND column_name = \'user_id\';');
    
    const verification = await pool.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'lead_interactions' AND column_name = 'user_id'
    `);
    
    if (verification.rowCount > 0) {
      const result = verification.rows[0];
      console.log('\nVERIFICATION RESULTS:');
      console.log(`  Column: ${result.column_name}`);
      console.log(`  is_nullable: ${result.is_nullable} ${result.is_nullable === 'YES' ? '✅ (SUCCESS)' : '❌ (FAILED)'}`);
    } else {
      console.log('❌ ERROR: Column user_id not found in lead_interactions table');
    }
    
    console.log('\n🎉 PRODUCTION WHATSAPP MIGRATION COMPLETED');
    
  } catch (error) {
    console.error('❌ PRODUCTION MIGRATION ERROR:', error.message);
    console.error('Full error details:', error);
  } finally {
    await pool.end();
  }
}

runProductionWhatsAppMigration();