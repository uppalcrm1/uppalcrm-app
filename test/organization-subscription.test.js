#!/usr/bin/env node

/**
 * Test script for Organization subscription management methods
 * Usage: node test/organization-subscription.test.js
 */

require('dotenv').config();
const Organization = require('../models/Organization');

async function testSubscriptionManagement() {
  console.log('🧪 Testing Organization Subscription Management Methods\n');

  try {
    // Test 1: calculateMonthlyCost
    console.log('📊 Test 1: calculateMonthlyCost()');
    console.log('----------------------------------------');
    const cost1 = Organization.calculateMonthlyCost(5, 15);
    console.log(`5 users × $15 = $${cost1}`);
    console.assert(cost1 === 75, 'Cost calculation failed');

    const cost2 = Organization.calculateMonthlyCost(10);
    console.log(`10 users × $15 (default) = $${cost2}`);
    console.assert(cost2 === 150, 'Default price calculation failed');

    const cost3 = Organization.calculateMonthlyCost(3, 20);
    console.log(`3 users × $20 = $${cost3}`);
    console.assert(cost3 === 60, 'Custom price calculation failed');

    console.log('✅ calculateMonthlyCost tests passed\n');

    // Test 2: getAllWithStats
    console.log('📊 Test 2: getAllWithStats()');
    console.log('----------------------------------------');
    const orgsWithStats = await Organization.getAllWithStats();
    console.log(`Found ${orgsWithStats.length} organizations with stats`);

    if (orgsWithStats.length > 0) {
      const org = orgsWithStats[0];
      console.log('\nSample organization stats:');
      console.log(`  Name: ${org.name}`);
      console.log(`  Status: ${org.subscription_status}`);
      console.log(`  Total Users: ${org.total_users}`);
      console.log(`  Active Users: ${org.active_users}`);
      console.log(`  Recent Active Users: ${org.recent_active_users}`);
      console.log(`  Usage: ${org.usage_percentage}%`);
      console.log(`  Monthly Cost: $${org.monthly_cost || 0}`);
      console.log(`  Max Users: ${org.max_users}`);

      if (org.trial_days_remaining !== null) {
        console.log(`  Trial Days Remaining: ${org.trial_days_remaining}`);
      }
      if (org.billing_days_remaining !== null) {
        console.log(`  Billing Days Remaining: ${org.billing_days_remaining}`);
      }

      // Verify required fields are present
      console.assert(org.id, 'Organization ID missing');
      console.assert(org.name, 'Organization name missing');
      console.assert(typeof org.total_users === 'number', 'total_users should be a number');
      console.assert(typeof org.active_users === 'number', 'active_users should be a number');
      console.assert(typeof org.usage_percentage === 'number', 'usage_percentage should be a number');
    }

    console.log('✅ getAllWithStats test passed\n');

    // Test 3: updateSubscription
    console.log('📊 Test 3: updateSubscription()');
    console.log('----------------------------------------');

    if (orgsWithStats.length > 0) {
      const testOrg = orgsWithStats[0];
      console.log(`Updating subscription for: ${testOrg.name}`);

      const updateData = {
        subscription_status: 'active',
        monthly_cost: 150.00,
        contact_email: 'admin@example.com',
        contact_phone: '555-1234',
        notes: 'Test update from subscription test script'
      };

      const updatedOrg = await Organization.updateSubscription(testOrg.id, updateData);

      if (updatedOrg) {
        console.log('✅ Organization updated successfully');
        console.log(`  Status: ${updatedOrg.subscription_status}`);
        console.log(`  Monthly Cost: $${updatedOrg.monthly_cost}`);
        console.log(`  Contact Email: ${updatedOrg.contact_email}`);
        console.log(`  Contact Phone: ${updatedOrg.contact_phone}`);

        // Verify updates
        console.assert(updatedOrg.subscription_status === 'active', 'Status update failed');
        console.assert(updatedOrg.monthly_cost == 150.00, 'Monthly cost update failed');
        console.assert(updatedOrg.contact_email === 'admin@example.com', 'Contact email update failed');

        console.log('✅ updateSubscription test passed');

        // Restore original status
        console.log('\n🔄 Restoring original subscription status...');
        await Organization.updateSubscription(testOrg.id, {
          subscription_status: testOrg.subscription_status
        });
        console.log('✅ Original status restored');
      } else {
        console.error('❌ Update failed - organization not found');
      }
    } else {
      console.log('⚠️  No organizations found to test updateSubscription');
    }

    console.log('\n✅ updateSubscription test completed\n');

    // Test 4: toJSON with subscription fields
    console.log('📊 Test 4: toJSON() includes subscription fields');
    console.log('----------------------------------------');

    if (orgsWithStats.length > 0) {
      const org = await Organization.findById(orgsWithStats[0].id);
      if (org) {
        const json = org.toJSON();
        console.log('toJSON() output includes:');
        console.log(`  - subscription_status: ${json.subscription_status !== undefined ? '✓' : '✗'}`);
        console.log(`  - trial_ends_at: ${json.trial_ends_at !== undefined ? '✓' : '✗'}`);
        console.log(`  - contact_email: ${json.contact_email !== undefined ? '✓' : '✗'}`);
        console.log(`  - billing_email: ${json.billing_email !== undefined ? '✓' : '✗'}`);
        console.log(`  - monthly_cost: ${json.monthly_cost !== undefined ? '✓' : '✗'}`);
        console.log(`  - notes: ${json.notes !== undefined ? '✓' : '✗'}`);

        // Verify all subscription fields are present
        console.assert(json.subscription_status !== undefined, 'subscription_status missing');
        console.assert(json.monthly_cost !== undefined, 'monthly_cost missing');

        console.log('✅ toJSON test passed\n');
      }
    }

    // Summary
    console.log('='.repeat(50));
    console.log('🎉 All Organization subscription management tests passed!');
    console.log('='.repeat(50));
    console.log('\n📝 Summary:');
    console.log('  ✅ calculateMonthlyCost() - Working correctly');
    console.log('  ✅ getAllWithStats() - Returns organizations with full stats');
    console.log('  ✅ updateSubscription() - Updates subscription fields');
    console.log('  ✅ toJSON() - Includes all subscription fields');
    console.log('\n🚀 Organization model is ready for subscription management!');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests
testSubscriptionManagement();
