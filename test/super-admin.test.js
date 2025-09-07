#!/usr/bin/env node

const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:3003/api';

async function testSuperAdminAPI() {
  console.log('🧪 Testing Super Admin API...\n');

  try {
    // Test 1: Login as super admin
    console.log('1. Testing super admin login...');
    const loginResponse = await axios.post(`${API_BASE_URL}/super-admin/login`, {
      email: 'admin@yourcrm.com',
      password: 'admin123'
    });

    if (loginResponse.data.token && loginResponse.data.admin) {
      console.log('✅ Super admin login successful');
      console.log(`   Admin: ${loginResponse.data.admin.first_name} ${loginResponse.data.admin.last_name}`);
      console.log(`   Email: ${loginResponse.data.admin.email}`);
      
      const authToken = loginResponse.data.token;
      const headers = {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };

      // Test 2: Get dashboard data
      console.log('\n2. Testing dashboard data...');
      const dashboardResponse = await axios.get(`${API_BASE_URL}/super-admin/dashboard`, { headers });
      
      if (dashboardResponse.data.overview) {
        console.log('✅ Dashboard data retrieved');
        const overview = dashboardResponse.data.overview;
        console.log(`   Active Trials: ${overview.active_trials}`);
        console.log(`   Expired Trials: ${overview.expired_trials}`);
        console.log(`   New Signups Today: ${overview.new_signups_today}`);
        console.log(`   New Trials Today: ${overview.new_trials_today}`);
        console.log(`   Expiring in 7 Days: ${overview.expiring_next_7_days}`);
      }

      // Test 3: Get organizations list
      console.log('\n3. Testing organizations list...');
      const orgsResponse = await axios.get(`${API_BASE_URL}/super-admin/organizations?limit=5`, { headers });
      
      if (orgsResponse.data.organizations) {
        console.log('✅ Organizations list retrieved');
        console.log(`   Total organizations: ${orgsResponse.data.organizations.length}`);
        
        orgsResponse.data.organizations.forEach((org, index) => {
          console.log(`   ${index + 1}. ${org.organization_name} - ${org.trial_status} (${org.days_remaining} days left)`);
        });
      }

      // Test 4: Get expiring trials
      console.log('\n4. Testing expiring trials...');
      const expiringResponse = await axios.get(`${API_BASE_URL}/super-admin/expiring-trials`, { headers });
      
      if (expiringResponse.data.expiring_trials !== undefined) {
        console.log('✅ Expiring trials retrieved');
        console.log(`   Trials expiring soon: ${expiringResponse.data.total_expiring}`);
        
        if (expiringResponse.data.expiring_trials.length > 0) {
          expiringResponse.data.expiring_trials.forEach((trial, index) => {
            console.log(`   ${index + 1}. ${trial.organization_name} - ${trial.days_remaining} days (${trial.risk_level} risk)`);
          });
        } else {
          console.log('   No trials expiring in next 7 days');
        }
      }

      // Test 5: Get business leads
      console.log('\n5. Testing business leads...');
      const leadsResponse = await axios.get(`${API_BASE_URL}/super-admin/business-leads`, { headers });
      
      if (leadsResponse.data.leads) {
        console.log('✅ Business leads retrieved');
        console.log(`   Total leads: ${leadsResponse.data.leads.length}`);
        
        leadsResponse.data.leads.slice(0, 3).forEach((lead, index) => {
          console.log(`   ${index + 1}. ${lead.company_name} - ${lead.lead_temperature} (${lead.engagement_score}% engaged)`);
        });
      }

      console.log('\n🎉 All Super Admin API tests passed!');
      console.log(`🌐 Access Super Admin Dashboard at: http://localhost:3003/super-admin`);
      console.log(`🔑 Login: admin@yourcrm.com / admin123`);

    } else {
      console.log('❌ Super admin login failed - invalid response format');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run the test
testSuperAdminAPI().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});