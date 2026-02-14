const axios = require('axios');

const api = axios.create({
  baseURL: 'https://uppalcrm-api-devtest.onrender.com',
  validateStatus: () => true
});

async function test() {
  // Login
  const loginRes = await api.post('/api/auth/login', {
    email: 'admin@staging.uppalcrm.com',
    password: 'staging123'
  });
  
  const token = loginRes.data.token;
  
  // Create rule
  const ruleRes = await api.post('/api/workflow-rules', {
    name: 'Debug Rule',
    description: 'Debug test',
    triggerType: 'renewal_within_days',
    triggerConditions: { days: 30 },
    actionConfig: {
      subject_template: 'Test: {{contact_name}}',
      description_template: 'Test renewal',
      priority: 'auto',
      days_before_due: 7,
      assignee_strategy: 'account_owner'
    }
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const ruleId = ruleRes.data.data.id;
  console.log('Created rule:', ruleId);
  
  // Execute rule
  const exec1 = await api.post(`/api/workflow-rules/${ruleId}/execute`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('\nFirst execution result:');
  console.log('  Evaluated:', exec1.data.data.recordsEvaluated);
  console.log('  Matched:', exec1.data.data.recordsMatched);
  console.log('  Created:', exec1.data.data.tasksCreated);
  
  // Get logs
  const logsRes = await api.get(`/api/workflow-rules/${ruleId}/logs?limit=5`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  console.log('\nLogs response (raw):');
  console.log(JSON.stringify(logsRes.data.data.logs[0], null, 2));
  
  // Delete rule
  await api.delete(`/api/workflow-rules/${ruleId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('\nRule deleted');
}

test();
