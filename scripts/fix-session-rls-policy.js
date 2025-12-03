#!/usr/bin/env node
/**
 * Fix RLS policy on user_sessions table to allow INSERT/UPDATE
 * The session_isolation policy was missing WITH CHECK clause, blocking all INSERTs
 */

const { pool } = require('../database/connection');

async function fixSessionRLSPolicy() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Fixing user_sessions RLS policy...\n');

    // Drop the old policy
    console.log('📋 Dropping old session_isolation policy...');
    await client.query(`
      DROP POLICY IF EXISTS session_isolation ON user_sessions;
    `);
    console.log('✅ Old policy dropped\n');

    // Create the new policy with WITH CHECK clause
    console.log('📋 Creating new session_isolation policy with WITH CHECK...');
    await client.query(`
      CREATE POLICY session_isolation ON user_sessions
          FOR ALL
          TO PUBLIC
          USING (organization_id = current_setting('app.current_organization_id')::uuid)
          WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);
    `);
    console.log('✅ New policy created\n');

    // Verify the policy exists
    const result = await client.query(`
      SELECT * FROM pg_policies 
      WHERE tablename = 'user_sessions' AND policyname = 'session_isolation';
    `);

    if (result.rows.length > 0) {
      console.log('✅ Policy verification successful!');
      console.log(`   Table: ${result.rows[0].tablename}`);
      console.log(`   Policy: ${result.rows[0].policyname}`);
      console.log(`   Command: ${result.rows[0].cmd}\n`);
    } else {
      console.log('⚠️  Warning: Could not verify policy creation\n');
    }

    console.log('🎉 RLS policy fix completed successfully!');
    console.log('\n💡 Next steps:');
    console.log('   1. Users can now log in and sessions will be stored');
    console.log('   2. Token verification will find the stored sessions');
    console.log('   3. Clear browser cache and try logging in again\n');

  } catch (error) {
    console.error('❌ Error fixing RLS policy:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixSessionRLSPolicy().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
