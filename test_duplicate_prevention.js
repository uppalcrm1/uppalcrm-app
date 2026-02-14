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
    name: 'Duplicate Prevention Test',
    description: 'Test duplicate prevention',
    triggerType: 'renewal_within_days',
    triggerConditions: { days: 30 },
    actionConfig: {
      subject_template: '🔄 Renewal: {{contact_name}} - {{account_name}}',
      description_template: 'Renewal due {{renewal_date}}. {{days_remaining}} days left.',
      priority: 'auto',
      days_before_due: 7,
      assignee_strategy: 'account_owner'
    }
  }, {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  const ruleId = ruleRes.data.data.id;
  console.log('Created rule:', ruleId);
  
  // First execution
  console.log('\n=== FIRST EXECUTION ===');
  const exec1 = await api.post(`/api/workflow-rules/${ruleId}/execute`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status:', exec1.data.data.status);
  console.log('Evaluated:', exec1.data.data.recordsEvaluated);
  console.log('Matched:', exec1.data.data.recordsMatched);
  console.log('Created:', exec1.data.data.tasksCreated);
  console.log('Skipped Duplicates:', exec1.data.data.recordsSkippedDuplicate);
  
  // Wait a second
  await new Promise(r => setTimeout(r, 1000));
  
  // Second execution
  console.log('\n=== SECOND EXECUTION ===');
  const exec2 = await api.post(`/api/workflow-rules/${ruleId}/execute`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status:', exec2.data.data.status);
  console.log('Evaluated:', exec2.data.data.recordsEvaluated);
  console.log('Matched:', exec2.data.data.recordsMatched);
  console.log('Created:', exec2.data.data.tasksCreated);
  console.log('Skipped Duplicates:', exec2.data.data.recordsSkippedDuplicate);
  
  if (exec2.data.data.status === 'error') {
    console.log('Error:', exec2.data.data.errorMessage);
  }
  
  // Delete rule
  await api.delete(`/api/workflow-rules/${ruleId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('\nRule deleted');
}

test();
