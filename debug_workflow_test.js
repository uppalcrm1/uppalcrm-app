const { Pool } = require('pg');
const workflowEngine = require('./services/workflowEngine');

const DATABASE_URL = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function test() {
  const client = await pool.connect();

  try {
    // Get org and rule
    const orgResult = await client.query('SELECT id FROM organizations LIMIT 1');
    const orgId = orgResult.rows[0].id;

    const userResult = await client.query(
      'SELECT id FROM users WHERE organization_id = $1 LIMIT 1',
      [orgId]
    );
    const userId = userResult.rows[0].id;

    // Create test rule
    const ruleResult = await client.query(`
      INSERT INTO workflow_rules (
        organization_id, name, trigger_type, trigger_conditions, action_config, created_by
      ) VALUES ($1, 'Debug Test Rule', 'renewal_within_days', '{"days": 30}'::jsonb, '{}'::jsonb, $2)
      RETURNING id
    `, [orgId, userId]);

    const ruleId = ruleResult.rows[0].id;

    console.log('Testing workflow engine...');
    console.log('Rule ID:', ruleId);
    console.log('Org ID:', orgId);
    console.log('User ID:', userId);

    // Execute
    const result = await workflowEngine.executeRule(ruleId, orgId, userId);

    console.log('\nExecution result:');
    console.log(JSON.stringify(result, null, 2));

    // Clean up
    await client.query('DELETE FROM workflow_rules WHERE id = $1', [ruleId]);

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

test();
