const axios = require('axios');

const API_BASE_URL = process.env.DEVTEST_API_URL || 'https://devtest-api.uppalcrm.com'; // You'll need to provide the actual DevTest API URL
const DEVTEST_TOKEN = process.env.DEVTEST_TOKEN; // You'll need to provide a valid token

// For now, let's create a manual test that documents what the API calls should be
console.log('\n' + '='.repeat(90));
console.log('  DEVTEST WORKFLOW RULES ENGINE - API TEST GUIDE');
console.log('='.repeat(90) + '\n');

console.log('To test the Workflow Rules Engine API on DevTest, run these commands:\n');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('STEP 1: Get Authentication Token');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`curl -X POST ${API_BASE_URL}/api/auth/login \\`);
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{');
console.log('    "email": "admin@staging.uppalcrm.com",');
console.log('    "password": "staging123"');
console.log('  }\'\n');

console.log('Save the returned token for use in subsequent requests.\n');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('STEP 2: Create a Workflow Rule');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`curl -X POST ${API_BASE_URL}/api/workflow-rules \\`);
console.log('  -H "Content-Type: application/json" \\');
console.log('  -H "Authorization: Bearer <TOKEN>" \\');
console.log('  -d \'{');
console.log('    "name": "Test Renewal Rule",');
console.log('    "description": "Integration test rule",');
console.log('    "trigger_type": "renewal_within_days",');
console.log('    "trigger_conditions": {"days": 30},');
console.log('    "action_config": {');
console.log('      "subject_template": "🔄 Renewal: {{contact_name}} - {{account_name}}",');
console.log('      "description_template": "Account {{account_name}} renewal due on {{renewal_date}}. {{days_remaining}} days remaining.",');
console.log('      "priority": "auto",');
console.log('      "days_before_due": 7,');
console.log('      "assignee_strategy": "account_owner"');
console.log('    }');
console.log('  }\'\n');

console.log('Save the returned rule ID.\n');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('STEP 3: Execute the Rule (First Time)');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`curl -X POST ${API_BASE_URL}/api/workflow-rules/<RULE_ID>/execute \\`);
console.log('  -H "Authorization: Bearer <TOKEN>" \\');
console.log('  -d \'{}\'\n');

console.log('Expected response will show:');
console.log('  - recordsEvaluated: Number of accounts checked');
console.log('  - recordsMatched: Accounts with renewals in 30 days');
console.log('  - tasksCreated: Tasks created');
console.log('  - details: Array of created tasks with subjects\n');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('STEP 4: Execute the Rule Again (Second Time)');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`curl -X POST ${API_BASE_URL}/api/workflow-rules/<RULE_ID>/execute \\`);
console.log('  -H "Authorization: Bearer <TOKEN>" \\');
console.log('  -d \'{}\'\n');

console.log('Expected response will show:');
console.log('  - recordsMatched: Same number of matched accounts');
console.log('  - tasksCreated: 0 (duplicate prevention)')
console.log('  - recordsSkippedDuplicate: Number of duplicates prevented\n');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('STEP 5: View Execution Logs');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`curl -X GET ${API_BASE_URL}/api/workflow-rules/<RULE_ID>/logs \\`);
console.log('  -H "Authorization: Bearer <TOKEN>"\n');

console.log('This will return 2 log entries showing both executions.\n');

console.log('═══════════════════════════════════════════════════════════════════════════════');
console.log('STEP 6: Delete the Test Rule');
console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log(`curl -X DELETE ${API_BASE_URL}/api/workflow-rules/<RULE_ID> \\`);
console.log('  -H "Authorization: Bearer <TOKEN>"\n');

console.log('═══════════════════════════════════════════════════════════════════════════════\n');

console.log('To run this test programmatically, you need to provide:');
console.log('  DEVTEST_API_URL - The DevTest API base URL');
console.log('  DEVTEST_TOKEN - A valid authentication token\n');

console.log('Or manually run the curl commands above in your terminal with your DevTest server.\n');
