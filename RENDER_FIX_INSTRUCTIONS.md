#!/usr/bin/env node
/**
 * Quick RLS policy fix - can be run directly in Render shell
 * Run with: psql $DATABASE_URL -c "..."
 */

const sql = `
DROP POLICY IF EXISTS session_isolation ON user_sessions;

CREATE POLICY session_isolation ON user_sessions
    FOR ALL
    TO PUBLIC
    USING (organization_id = current_setting('app.current_organization_id')::uuid)
    WITH CHECK (organization_id = current_setting('app.current_organization_id')::uuid);

SELECT * FROM pg_policies 
WHERE tablename = 'user_sessions' AND policyname = 'session_isolation';
`;

console.log('Execute this in Render shell:\n');
console.log('psql $DATABASE_URL -c "' + sql.replace(/\n/g, ' ').trim() + '"');
console.log('\n\nOr connect to the DB and run each statement separately:\n');
console.log(sql);
