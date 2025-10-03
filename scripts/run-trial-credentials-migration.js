/**
 * Run trial signup credentials migration
 * Adds columns to trial_signups table to store auto-generated credentials
 */

const { pool } = require('../database/connection');

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting trial signup credentials migration...');

    await client.query('BEGIN');

    // Add columns to trial_signups table
    console.log('  Adding organization_slug column...');
    await client.query(`
      ALTER TABLE trial_signups
      ADD COLUMN IF NOT EXISTS organization_slug VARCHAR(255)
    `);

    console.log('  Adding generated_password column...');
    await client.query(`
      ALTER TABLE trial_signups
      ADD COLUMN IF NOT EXISTS generated_password VARCHAR(255)
    `);

    console.log('  Adding credentials_sent_at column...');
    await client.query(`
      ALTER TABLE trial_signups
      ADD COLUMN IF NOT EXISTS credentials_sent_at TIMESTAMP WITH TIME ZONE
    `);

    // Create index
    console.log('  Creating index on organization_slug...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trial_signups_org_slug ON trial_signups(organization_slug)
    `);

    await client.query('COMMIT');

    console.log('✅ Migration completed successfully!');

    // Verify columns exist
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'trial_signups'
      AND column_name IN ('organization_slug', 'generated_password', 'credentials_sent_at')
      ORDER BY column_name
    `);

    console.log('\n📋 Verified columns:');
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.column_name} (${row.data_type})`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run migration
runMigration()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  });
