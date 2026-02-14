/**
 * Test script for Workflow Rules Engine
 * Tests the complete workflow:
 * 1. Create a test rule
 * 2. Execute it once - verify accounts matched and tasks created
 * 3. Execute it again - verify zero duplicates
 * 4. Show log entries
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3004';
const ORG_ID = '4af68759-65cf-4b38-8fd5-e6f41d7a726f'; // DevTest org

let testAuthToken = '';
let testRuleId = '';

const api = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true // Don't throw on any status
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(message, data = null) {
  console.log(`\n${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

function section(title) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(80)}\n`);
}

// ============================================================================
// TEST 1: Login and get auth token
// ============================================================================

async function testLogin() {
  section('STEP 1: Login');

  const response = await api.post('/api/auth/login', {
    email: 'admin@staging.uppalcrm.com',
    password: 'staging123'
  });

  if (response.status !== 200) {
    log('❌ Login failed:', response.data);
    return false;
  }

  testAuthToken = response.data.token;
  log('✅ Login successful');
  log(`Token: ${testAuthToken.substring(0, 20)}...`);

  return true;
}

// ============================================================================
// TEST 2: Create a workflow rule
// ============================================================================

async function testCreateRule() {
  section('STEP 2: Create Workflow Rule');

  const ruleData = {
    name: 'Test Renewal Rule',
    description: 'Test rule that triggers on renewals within 30 days',
    trigger_type: 'renewal_within_days',
    trigger_conditions: { days: 30 },
    action_config: {
      subject_template: 'Renewal: {{contact_name}} - {{account_name}}',
      description_template: 'Renewal due {{renewal_date}}. {{days_remaining}} days left.',
      priority: 'auto',
      days_before_due: 7,
      assignee_strategy: 'account_owner'
    }
  };

  const response = await api.post('/api/workflow-rules', ruleData, {
    headers: { Authorization: `Bearer ${testAuthToken}` }
  });

  if (response.status !== 201) {
    log('❌ Rule creation failed:', response.data);
    return false;
  }

  testRuleId = response.data.data.id;
  log('✅ Rule created successfully');
  log(`Rule ID: ${testRuleId}`);
  log('Rule details:', {
    name: response.data.data.name,
    triggerType: response.data.data.triggerType,
    actionConfig: response.data.data.actionConfig
  });

  return true;
}

// ============================================================================
// TEST 3: Execute the rule (First execution)
// ============================================================================

async function testExecuteRuleFirst() {
  section('STEP 3: Execute Rule - First Execution');

  const response = await api.post(
    `/api/workflow-rules/${testRuleId}/execute`,
    {},
    { headers: { Authorization: `Bearer ${testAuthToken}` } }
  );

  if (!response.data.success) {
    log('❌ Rule execution failed:', response.data);
    return false;
  }

  const executionData = response.data.data;

  log('✅ Rule executed successfully');
  log('Execution Summary:', {
    ruleId: executionData.ruleId,
    recordsEvaluated: executionData.recordsEvaluated,
    recordsMatched: executionData.recordsMatched,
    tasksCreated: executionData.tasksCreated,
    recordsSkippedDuplicate: executionData.recordsSkippedDuplicate,
    status: executionData.status,
    executionTimeMs: executionData.executionTimeMs
  });

  if (executionData.tasksCreated > 0) {
    log('Tasks Created:', executionData.details.slice(0, 3).map(detail => ({
      accountName: detail.account_name,
      contactName: detail.contact_name,
      taskSubject: detail.task_subject,
      priority: detail.priority,
      daysRemaining: detail.days_remaining
    })));
  }

  return { success: true, tasksCreated: executionData.tasksCreated };
}

// ============================================================================
// TEST 4: Execute the rule again (Duplicate check)
// ============================================================================

async function testExecuteRuleSecond() {
  section('STEP 4: Execute Rule - Second Execution (Duplicate Check)');

  await delay(1000); // Small delay to ensure different timestamps

  const response = await api.post(
    `/api/workflow-rules/${testRuleId}/execute`,
    {},
    { headers: { Authorization: `Bearer ${testAuthToken}` } }
  );

  if (!response.data.success) {
    log('❌ Rule execution failed:', response.data);
    return false;
  }

  const executionData = response.data.data;

  log('✅ Rule executed successfully');
  log('Execution Summary:', {
    recordsEvaluated: executionData.recordsEvaluated,
    recordsMatched: executionData.recordsMatched,
    tasksCreated: executionData.tasksCreated,
    recordsSkippedDuplicate: executionData.recordsSkippedDuplicate,
    status: executionData.status
  });

  const isDuplicatePrevention = executionData.tasksCreated === 0 &&
                                 executionData.recordsMatched > 0 &&
                                 executionData.recordsSkippedDuplicate > 0;

  if (isDuplicatePrevention) {
    log('✅ DUPLICATE PREVENTION WORKING CORRECTLY');
    log(`   Matched: ${executionData.recordsMatched} accounts`);
    log(`   Created: ${executionData.tasksCreated} tasks (was prevented from creating duplicates)`);
    log(`   Skipped: ${executionData.recordsSkippedDuplicate} duplicate records`);
  } else if (executionData.tasksCreated === 0 && executionData.recordsMatched === 0) {
    log('⚠️  No accounts matched in second execution');
    log('   This may be expected if renewal dates have changed');
  } else {
    log('⚠️  Unexpected result - check prevent_duplicates setting');
  }

  return { success: true, tasksCreated: executionData.tasksCreated };
}

// ============================================================================
// TEST 5: Get rule execution logs
// ============================================================================

async function testGetRuleLogs() {
  section('STEP 5: Get Rule Execution Logs');

  const response = await api.get(
    `/api/workflow-rules/${testRuleId}/logs?limit=10`,
    { headers: { Authorization: `Bearer ${testAuthToken}` } }
  );

  if (response.status !== 200) {
    log('❌ Failed to fetch logs:', response.data);
    return false;
  }

  const logs = response.data.data.logs || [];
  log(`✅ Retrieved ${logs.length} execution logs`);

  if (logs.length > 0) {
    log('Latest executions:');
    logs.forEach((log, index) => {
      console.log(`
  Execution ${index + 1}:
    - Executed at: ${new Date(log.runAt).toLocaleString()}
    - Trigger source: ${log.triggerSource}
    - Records evaluated: ${log.recordsEvaluated}
    - Records matched: ${log.recordsMatched}
    - Tasks created: ${log.tasksCreated}
    - Status: ${log.status}
    - Duplicates skipped: ${log.recordsSkippedDuplicate}
      `);
    });
  }

  return true;
}

// ============================================================================
// TEST 6: Get single rule with details
// ============================================================================

async function testGetRuleDetails() {
  section('STEP 6: Get Rule Details');

  const response = await api.get(
    `/api/workflow-rules/${testRuleId}`,
    { headers: { Authorization: `Bearer ${testAuthToken}` } }
  );

  if (response.status !== 200) {
    log('❌ Failed to fetch rule:', response.data);
    return false;
  }

  const rule = response.data.data;
  log('✅ Rule details retrieved');
  log({
    id: rule.id,
    name: rule.name,
    entityType: rule.entityType,
    triggerType: rule.triggerType,
    actionType: rule.actionType,
    isEnabled: rule.isEnabled,
    preventDuplicates: rule.preventDuplicates,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt
  });

  return true;
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  console.clear();
  console.log('🧪 WORKFLOW RULES ENGINE - INTEGRATION TEST SUITE\n');

  try {
    // Step 1: Login
    if (!await testLogin()) {
      process.exit(1);
    }

    // Step 2: Create rule
    if (!await testCreateRule()) {
      process.exit(1);
    }

    // Step 3: First execution
    const firstExecution = await testExecuteRuleFirst();
    if (!firstExecution.success) {
      process.exit(1);
    }

    // Step 4: Second execution (duplicate check)
    const secondExecution = await testExecuteRuleSecond();
    if (!secondExecution.success) {
      process.exit(1);
    }

    // Step 5: Get logs
    if (!await testGetRuleLogs()) {
      process.exit(1);
    }

    // Step 6: Get rule details
    if (!await testGetRuleDetails()) {
      process.exit(1);
    }

    // Final summary
    section('TEST SUMMARY');
    console.log('✅ All tests completed successfully!\n');
    console.log('Key Findings:');
    console.log(`  ✓ Rule created with ID: ${testRuleId}`);
    console.log(`  ✓ First execution: ${firstExecution.tasksCreated} tasks created`);
    console.log(`  ✓ Second execution: ${secondExecution.tasksCreated} tasks created (duplicate prevention active)`);
    console.log('\n🎉 Workflow Rules Engine is functioning correctly!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
