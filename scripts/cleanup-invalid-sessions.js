/**
 * Cleanup Invalid Sessions Script
 *
 * This script cleans up invalid or expired sessions from the database.
 * Run this after deployments that change authentication logic.
 *
 * Usage: node scripts/cleanup-invalid-sessions.js
 */

const { pool, query } = require('../database/connection');

async function cleanupInvalidSessions() {
  console.log('🧹 Starting session cleanup...\n');

  try {
    // 1. Check for expired sessions
    console.log('📊 Checking for expired sessions...');
    const expiredResult = await query(`
      SELECT COUNT(*) as count FROM user_sessions
      WHERE expires_at < NOW()
    `);
    console.log(`   Found ${expiredResult.rows[0].count} expired sessions`);

    // 2. Check for sessions with invalid user references
    console.log('\n📊 Checking for sessions with invalid user references...');
    const invalidUserResult = await query(`
      SELECT COUNT(*) as count FROM user_sessions s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE u.id IS NULL OR u.is_active = false
    `);
    console.log(`   Found ${invalidUserResult.rows[0].count} sessions with invalid users`);

    // 3. Check for sessions with malformed UUIDs (if any exist)
    console.log('\n📊 Checking total sessions...');
    const totalResult = await query(`
      SELECT COUNT(*) as count FROM user_sessions
    `);
    console.log(`   Total sessions in database: ${totalResult.rows[0].count}`);

    // 4. Delete expired sessions
    console.log('\n🗑️  Deleting expired sessions...');
    const deleteExpiredResult = await query(`
      DELETE FROM user_sessions
      WHERE expires_at < NOW()
      RETURNING id
    `);
    console.log(`   ✅ Deleted ${deleteExpiredResult.rowCount} expired sessions`);

    // 5. Delete sessions with invalid user references
    console.log('\n🗑️  Deleting sessions with invalid user references...');
    const deleteInvalidResult = await query(`
      DELETE FROM user_sessions s
      WHERE NOT EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = s.user_id AND u.is_active = true
      )
      RETURNING id
    `);
    console.log(`   ✅ Deleted ${deleteInvalidResult.rowCount} invalid sessions`);

    // 6. Show remaining sessions
    console.log('\n📊 Remaining valid sessions...');
    const remainingResult = await query(`
      SELECT COUNT(*) as count FROM user_sessions
      WHERE expires_at > NOW()
    `);
    console.log(`   ${remainingResult.rows[0].count} valid sessions remaining`);

    // 7. Show session details by organization
    console.log('\n📊 Sessions by organization...');
    const sessionsByOrg = await query(`
      SELECT
        o.name as organization_name,
        o.slug as organization_slug,
        COUNT(s.id) as session_count,
        MAX(s.expires_at) as latest_expiry
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      JOIN organizations o ON o.id = u.organization_id
      WHERE s.expires_at > NOW()
      GROUP BY o.id, o.name, o.slug
      ORDER BY session_count DESC
    `);

    if (sessionsByOrg.rows.length > 0) {
      sessionsByOrg.rows.forEach(row => {
        console.log(`   - ${row.organization_name} (${row.organization_slug}): ${row.session_count} sessions`);
        console.log(`     Latest expiry: ${new Date(row.latest_expiry).toLocaleString()}`);
      });
    } else {
      console.log('   No active sessions found');
    }

    console.log('\n✅ Session cleanup completed successfully!\n');
    console.log('💡 Users with expired sessions will need to log in again.\n');

  } catch (error) {
    console.error('❌ Error during session cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the cleanup
cleanupInvalidSessions()
  .then(() => {
    console.log('Script completed.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
