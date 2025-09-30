#!/usr/bin/env node

// Simple test to show how to access the super admin interface

async function testSuperAdminProduction() {
  console.log('🔍 Testing Super Admin Interface for Your B2B CRM\n');

  const baseUrl = 'https://uppalcrm-api.onrender.com/api/super-admin';

  console.log('📊 Your Multi-Tenant Admin Interface is Available at:');
  console.log(`   ${baseUrl}\n`);

  console.log('🔑 Login Credentials:');
  console.log('   Email: admin@uppalcrm.com');
  console.log('   Password: SuperAdmin123!\n');

  console.log('📋 To see all businesses subscribed to your CRM:');
  console.log('\n1. First, login to get an auth token:');
  console.log(`   POST ${baseUrl}/login`);
  console.log('   Body: {"email": "admin@uppalcrm.com", "password": "SuperAdmin123!"}');

  console.log('\n2. Then access your dashboard:');
  console.log(`   GET ${baseUrl}/dashboard`);
  console.log('   Header: Authorization: Bearer <your_token>');

  console.log('\n3. Or view all organizations:');
  console.log(`   GET ${baseUrl}/organizations`);
  console.log('   Header: Authorization: Bearer <your_token>');

  console.log('\n🏢 Current organizations in your CRM:');
  console.log('   • Test Company (testcompany) - Active');
  console.log('   • Uppal Solutions Ltd (uppal-solutions) - Active');

  console.log('\n💡 What you can monitor:');
  console.log('   ✅ All customer organizations using your CRM');
  console.log('   ✅ Their subscription status (trial/paid/expired)');
  console.log('   ✅ Number of users in each organization');
  console.log('   ✅ Admin contact information');
  console.log('   ✅ Trial expiration dates');
  console.log('   ✅ Payment status and billing info');

  console.log('\n🚀 Your super admin interface is ready to use!');
  console.log('   This gives you complete visibility into all businesses using your B2B CRM.');
}

testSuperAdminProduction();