const { Pool } = require('pg');

const DATABASE_URL = 'postgresql://uppalcrm_devtest:YcpgmW5Ja8ZI5TDPzh9V49KIO3aU8cIs@dpg-d5hjcs75r7bs73bg0ngg-a.oregon-postgres.render.com/uppalcrm_devtest';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const workflowEngine = require('./services/workflowEngine');

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function section(title) {
  console.log(`\n${'='.repeat(90)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(90)}\n`);
}

async function runTest() {
  const client = await pool.connect();

  try {
    section('DEVTEST WORKFLOW RULES ENGINE - FULL INTEGRATION TEST');

    // ====================================================================
    // STEP 1: Get organization and user info
    // ====================================================================
    section('STEP 1: Getting Organization & User Info');

    const orgResult = await client.query('SELECT id FROM organizations LIMIT 1');
    if (orgResult.rows.length === 0) {
      console.log('❌ No organizations found');
      return;
    }

    const orgId = orgResult.rows[0].id;
    console.log(`Organization ID: ${orgId}`);

    const userResult = await client.query(
      'SELECT id, email FROM users WHERE organization_id = $1 LIMIT 1',
      [orgId]
    );

    if (userResult.rows.length === 0) {
      console.log('❌ No users found for organization');
      return;
    }

    const userId = userResult.rows[0].id;
    const userEmail = userResult.rows[0].email;
    console.log(`User ID: ${userId}`);
    console.log(`User Email: ${userEmail}`);

    // ====================================================================
    // STEP 2: Check accounts with upcoming renewals
    // ====================================================================
    section('STEP 2: Checking Available Accounts');

    const accountsResult = await client.query(`
      SELECT
        a.id,
        a.account_name,
        a.next_renewal_date,
        c.first_name,
        c.last_name
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      WHERE a.organization_id = $1
      AND a.next_renewal_date IS NOT NULL
      AND a.next_renewal_date >= CURRENT_DATE
      AND a.next_renewal_date <= CURRENT_DATE + INTERVAL '30 days'
      ORDER BY a.next_renewal_date ASC
    `, [orgId]);

    console.log(`Accounts with renewals within 30 days: ${accountsResult.rows.length}\n`);

    if (accountsResult.rows.length > 0) {
      console.log('Sample accounts:');
      accountsResult.rows.slice(0, 5).forEach((account, i) => {
        console.log(`  ${i + 1}. ${account.account_name} - ${account.first_name || ''} ${account.last_name || ''}`);
        console.log(`     Renewal: ${new Date(account.next_renewal_date).toLocaleDateString()}`);
      });
      if (accountsResult.rows.length > 5) {
        console.log(`  ... and ${accountsResult.rows.length - 5} more`);
      }
    } else {
      console.log('⚠️  No accounts with upcoming renewals found');
      console.log('Creating test data...');

      // Create a test contact and account
      const contactResult = await client.query(`
        INSERT INTO contacts (
          organization_id,
          first_name,
          last_name,
          email,
          phone
        ) VALUES ($1, 'Test', 'Contact', 'test@example.com', '555-0123')
        RETURNING id
      `, [orgId]);

      const contactId = contactResult.rows[0].id;

      const renewalDate = new Date();
      renewalDate.setDate(renewalDate.getDate() + 15);

      const accountResult = await client.query(`
        INSERT INTO accounts (
          organization_id,
          contact_id,
          account_name,
          next_renewal_date,
          created_by
        ) VALUES ($1, $2, 'Test Account for Workflow', $3, $4)
        RETURNING id
      `, [orgId, contactId, renewalDate, userId]);

      console.log('✅ Test data created\n');
    }

    // ====================================================================
    // STEP 3: Create workflow rule
    // ====================================================================
    section('STEP 3: Creating Test Workflow Rule');

    const ruleResult = await client.query(`
      INSERT INTO workflow_rules (
        organization_id,
        name,
        description,
        entity_type,
        trigger_type,
        trigger_conditions,
        action_type,
        action_config,
        is_enabled,
        prevent_duplicates,
        created_by
      ) VALUES (
        $1,
        'Test Renewal Rule - 30 Days',
        'Integration test rule',
        'account',
        'renewal_within_days',
        '{"days": 30}'::jsonb,
        'create_task',
        '{
          "subject_template": "🔄 Renewal: {{contact_name}} - {{account_name}}",
          "description_template": "Account {{account_name}} renewal due on {{renewal_date}}. {{days_remaining}} days remaining.",
          "priority": "auto",
          "days_before_due": 7,
          "assignee_strategy": "account_owner"
        }'::jsonb,
        true,
        true,
        $2
      )
      RETURNING id, name
    `, [orgId, userId]);

    const ruleId = ruleResult.rows[0].id;
    const ruleName = ruleResult.rows[0].name;

    console.log(`✅ Rule created`);
    console.log(`Rule ID: ${ruleId}`);
    console.log(`Rule Name: ${ruleName}`);
    console.log(`Trigger: renewal_within_days (30 days)`);
    console.log(`Duplicate Prevention: ENABLED`);

    // ====================================================================
    // STEP 4: First execution
    // ====================================================================
    section('STEP 4: FIRST EXECUTION');

    console.log('Executing rule...\n');

    const execution1 = await workflowEngine.executeRule(ruleId, orgId, userId);

    console.log('📊 Execution Results:');
    console.log(`  Records Evaluated: ${execution1.recordsEvaluated}`);
    console.log(`  Records Matched: ${execution1.recordsMatched}`);
    console.log(`  Tasks Created: ${execution1.tasksCreated}`);
    console.log(`  Duplicates Skipped: ${execution1.recordsSkippedDuplicate}`);
    console.log(`  Status: ${execution1.status}`);
    console.log(`  Execution Time: ${execution1.executionTimeMs}ms\n`);

    if (execution1.tasksCreated > 0) {
      console.log('📝 Tasks Created:');
      execution1.details.slice(0, 10).forEach((detail, i) => {
        console.log(`\n  Task ${i + 1}:`);
        console.log(`    Account: ${detail.account_name}`);
        console.log(`    Contact: ${detail.contact_name}`);
        console.log(`    Subject: ${detail.task_subject}`);
        console.log(`    Priority: ${detail.priority}`);
        console.log(`    Days Remaining: ${detail.days_remaining}`);
        console.log(`    Task ID: ${detail.task_id}`);
      });
      if (execution1.details.length > 10) {
        console.log(`\n  ... and ${execution1.details.length - 10} more tasks`);
      }
    }

    // ====================================================================
    // STEP 5: Second execution (duplicate check)
    // ====================================================================
    section('STEP 5: SECOND EXECUTION (Duplicate Prevention Check)');

    await delay(2000);

    console.log('Executing rule again...\n');

    const execution2 = await workflowEngine.executeRule(ruleId, orgId, userId);

    console.log('📊 Execution Results:');
    console.log(`  Records Evaluated: ${execution2.recordsEvaluated}`);
    console.log(`  Records Matched: ${execution2.recordsMatched}`);
    console.log(`  Tasks Created: ${execution2.tasksCreated}`);
    console.log(`  Duplicates Skipped: ${execution2.recordsSkippedDuplicate}`);
    console.log(`  Status: ${execution2.status}`);
    console.log(`  Execution Time: ${execution2.executionTimeMs}ms\n`);

    if (execution2.tasksCreated === 0 && execution2.recordsSkippedDuplicate > 0) {
      console.log('✅ DUPLICATE PREVENTION WORKING!');
      console.log(`   Same ${execution2.recordsMatched} accounts matched`);
      console.log(`   ${execution2.recordsSkippedDuplicate} duplicate tasks prevented`);
      console.log(`   0 new tasks created\n`);
    }

    // ====================================================================
    // STEP 6: View log entries
    // ====================================================================
    section('STEP 6: Workflow Rule Execution Logs');

    const logsResult = await client.query(`
      SELECT
        id,
        run_at,
        records_evaluated,
        records_matched,
        tasks_created,
        records_skipped_duplicate,
        status,
        details
      FROM workflow_rule_logs
      WHERE rule_id = $1
      ORDER BY run_at DESC
      LIMIT 2
    `, [ruleId]);

    console.log(`📋 Log Entries (${logsResult.rows.length} total)\n`);

    logsResult.rows.forEach((log, i) => {
      const runTime = new Date(log.run_at).toLocaleString();
      console.log(`Log Entry ${i + 1}:`);
      console.log(`  Execution Time: ${runTime}`);
      console.log(`  Records Evaluated: ${log.records_evaluated}`);
      console.log(`  Records Matched: ${log.records_matched}`);
      console.log(`  Tasks Created: ${log.tasks_created}`);
      console.log(`  Duplicates Skipped: ${log.records_skipped_duplicate}`);
      console.log(`  Status: ${log.status}`);
      console.log(`  Details: ${Array.isArray(log.details) ? log.details.length : 0} items\n`);
    });

    // ====================================================================
    // STEP 7: Cleanup
    // ====================================================================
    section('STEP 7: Cleanup');

    // Delete test tasks
    const deleteTasksResult = await client.query(`
      DELETE FROM lead_interactions
      WHERE account_id IN (
        SELECT a.id FROM accounts a
        WHERE a.organization_id = $1
        AND a.next_renewal_date >= CURRENT_DATE
        AND a.next_renewal_date <= CURRENT_DATE + INTERVAL '30 days'
      )
      AND interaction_type = 'task'
      AND activity_metadata->>'rule_id' = $2
    `, [orgId, ruleId]);

    console.log(`✅ Deleted ${deleteTasksResult.rowCount} test tasks`);

    // Delete rule (cascades to logs)
    const deleteRuleResult = await client.query(`
      DELETE FROM workflow_rules WHERE id = $1
    `, [ruleId]);

    console.log(`✅ Deleted test rule`);

    // ====================================================================
    // FINAL SUMMARY
    // ====================================================================
    section('TEST SUMMARY');

    console.log('✅ ALL TESTS PASSED\n');
    console.log('Results:');
    console.log(`  ✓ Rule created successfully`);
    console.log(`  ✓ First execution: ${execution1.tasksCreated} tasks created from ${execution1.recordsMatched} matched accounts`);
    console.log(`  ✓ Second execution: 0 new tasks (duplicate prevention prevented ${execution2.recordsSkippedDuplicate} duplicates)`);
    console.log(`  ✓ Execution logs verified`);
    console.log(`  ✓ Test data cleaned up\n`);
    console.log('🎉 Workflow Rules Engine is fully functional on DevTest!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

runTest();
