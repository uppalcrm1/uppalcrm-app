const { query } = require('../database/connection');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    console.log('🔄 Running trial columns migration...\n');

    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '..', 'database', 'add-trial-columns-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Run the migration
    await query(migrationSQL);

    console.log('✅ Migration completed successfully!\n');

    // Verify the new columns exist
    const columnsResult = await query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'organizations' AND column_name IN ('is_trial', 'trial_status', 'trial_start_date', 'trial_expires_at')
      ORDER BY column_name
    `);

    console.log('📋 New columns added:');
    columnsResult.rows.forEach(col => {
      console.log(`  ✓ ${col.column_name} (${col.data_type})`);
    });

    // Show updated organization data
    const orgs = await query(`
      SELECT id, name, is_trial, trial_status, subscription_plan
      FROM organizations
    `);

    console.log('\n📊 Updated organizations:');
    orgs.rows.forEach(org => {
      console.log(`  - ${org.name}: is_trial=${org.is_trial}, trial_status=${org.trial_status}, plan=${org.subscription_plan}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
})();
