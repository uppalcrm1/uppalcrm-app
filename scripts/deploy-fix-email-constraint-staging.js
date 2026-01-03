const { Pool } = require('pg');
require('dotenv').config({ path: '.env.staging' });

// Use Render database connection
// Try without SSL first (Render internal connections don't use SSL)
let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function deployMigration() {
  let client;

  try {
    client = await pool.connect();
  } catch (sslError) {
    // If connection fails, try with SSL
    console.log('First connection attempt failed, retrying with SSL...');
    await pool.end();
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    client = await pool.connect();
  }

  try {
    console.log('🚀 Starting deployment: Fix email unique constraint (STAGING)');
    console.log('📅 Date:', new Date().toISOString());
    console.log('🔗 Database:', process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'Unknown');
    console.log('');

    // Step 1: Check current constraint
    console.log('Step 1: Checking current email constraint...');
    const constraintCheck = await client.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'contacts'::regclass
      AND contype = 'u'
      AND array_length(conkey, 1) = 2
      AND EXISTS (
        SELECT 1
        FROM unnest(conkey) AS col_num
        JOIN pg_attribute ON attnum = col_num AND attrelid = 'contacts'::regclass
        WHERE attname IN ('organization_id', 'email')
      );
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('✅ Found existing constraint:', constraintCheck.rows[0].conname);
      console.log('   Definition:', constraintCheck.rows[0].definition);
    } else {
      console.log('ℹ️  No unique constraint found on (organization_id, email)');
    }
    console.log('');

    // Step 2: Begin transaction
    console.log('Step 2: Beginning transaction...');
    await client.query('BEGIN');
    console.log('✅ Transaction started');
    console.log('');

    // Step 3: Drop existing constraint
    console.log('Step 3: Dropping existing unique constraint...');
    const dropResult = await client.query(`
      DO $$
      DECLARE
          constraint_name TEXT;
      BEGIN
          SELECT conname INTO constraint_name
          FROM pg_constraint
          WHERE conrelid = 'contacts'::regclass
          AND contype = 'u'
          AND array_length(conkey, 1) = 2
          AND EXISTS (
              SELECT 1
              FROM unnest(conkey) AS col_num
              JOIN pg_attribute ON attnum = col_num AND attrelid = 'contacts'::regclass
              WHERE attname IN ('organization_id', 'email')
          );

          IF constraint_name IS NOT NULL THEN
              EXECUTE format('ALTER TABLE contacts DROP CONSTRAINT %I', constraint_name);
              RAISE NOTICE 'Dropped constraint: %', constraint_name;
          ELSE
              RAISE NOTICE 'No matching unique constraint found';
          END IF;
      END $$;
    `);
    console.log('✅ Constraint dropped (if it existed)');
    console.log('');

    // Step 4: Create partial unique index
    console.log('Step 4: Creating partial unique index...');
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS contacts_organization_email_unique_idx
      ON contacts (organization_id, email)
      WHERE email IS NOT NULL AND email != '';
    `);
    console.log('✅ Partial unique index created');
    console.log('   Index name: contacts_organization_email_unique_idx');
    console.log('   Condition: WHERE email IS NOT NULL AND email != \'\'');
    console.log('');

    // Step 5: Add comment
    console.log('Step 5: Adding documentation comment...');
    await client.query(`
      COMMENT ON INDEX contacts_organization_email_unique_idx IS
      'Unique constraint on email per organization - only applies to non-empty emails to allow multiple contacts without email addresses';
    `);
    console.log('✅ Comment added');
    console.log('');

    // Step 6: Verify the new index
    console.log('Step 6: Verifying new index...');
    const indexCheck = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'contacts'
      AND indexname = 'contacts_organization_email_unique_idx';
    `);

    if (indexCheck.rows.length > 0) {
      console.log('✅ Index verified:');
      console.log('   Name:', indexCheck.rows[0].indexname);
      console.log('   Definition:', indexCheck.rows[0].indexdef);
    } else {
      throw new Error('Index was not created successfully!');
    }
    console.log('');

    // Step 7: Commit transaction
    console.log('Step 7: Committing transaction...');
    await client.query('COMMIT');
    console.log('✅ Transaction committed');
    console.log('');

    console.log('🎉 Migration completed successfully!');
    console.log('');
    console.log('Summary:');
    console.log('- Old constraint: Dropped (prevented multiple empty emails)');
    console.log('- New index: Created (allows multiple empty/null emails)');
    console.log('- Email validation: Now works correctly for contacts without emails');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test creating contacts with empty emails');
    console.log('2. Verify duplicate email detection still works for non-empty emails');
    console.log('3. Monitor application logs for any issues');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('');
    console.error('❌ Migration failed!');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

deployMigration();
