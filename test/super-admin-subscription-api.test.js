#!/usr/bin/env node

/**
 * Test script for Super Admin Subscription Management API
 * Tests all 6 subscription management endpoints
 * Usage: node test/super-admin-subscription-api.test.js
 */

require('dotenv').config();
const axios = require('axios');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || 'super@admin.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || 'SuperSecure123!';

let superAdminToken = null;
let testOrgId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

/**
 * Test 1: Super Admin Login
 */
async function testSuperAdminLogin() {
  logSection('Test 1: Super Admin Login');

  try {
    logInfo('Attempting to login as super admin...');

    const response = await axios.post(`${API_BASE_URL}/api/super-admin/login`, {
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD
    });

    if (response.data.token) {
      superAdminToken = response.data.token;
      logSuccess('Super admin login successful');
      logInfo(`Token: ${superAdminToken.substring(0, 20)}...`);
      logInfo(`Admin: ${response.data.admin.email}`);
      return true;
    } else {
      logError('No token received');
      return false;
    }
  } catch (error) {
    logError(`Login failed: ${error.response?.data?.error || error.message}`);
    return false;
  }
}

/**
 * Test 2: GET /api/super-admin/organizations
 */
async function testGetAllOrganizations() {
  logSection('Test 2: GET /api/super-admin/organizations');

  try {
    logInfo('Fetching all organizations with stats...');

    const response = await axios.get(`${API_BASE_URL}/api/super-admin/organizations`, {
      headers: { Authorization: `Bearer ${superAdminToken}` }
    });

    if (response.data.success && response.data.organizations) {
      const orgs = response.data.organizations;
      logSuccess(`Retrieved ${orgs.length} organizations`);

      if (orgs.length > 0) {
        testOrgId = orgs[0].id;

        logInfo('\nSample Organization:');
        const sample = orgs[0];
        console.log(`  Name: ${sample.name}`);
        console.log(`  Status: ${sample.subscription_status}`);
        console.log(`  Total Users: ${sample.total_users}`);
        console.log(`  Active Users: ${sample.active_users}`);
        console.log(`  Usage: ${sample.usage_percentage}%`);
        console.log(`  Monthly Cost: $${sample.monthly_cost || 0}`);
        console.log(`  Max Users: ${sample.max_users}`);

        // Verify required fields
        const requiredFields = ['id', 'name', 'subscription_status', 'total_users', 'active_users', 'usage_percentage'];
        const missingFields = requiredFields.filter(field => sample[field] === undefined);

        if (missingFields.length === 0) {
          logSuccess('All required fields present');
        } else {
          logWarning(`Missing fields: ${missingFields.join(', ')}`);
        }

        return true;
      } else {
        logWarning('No organizations found in database');
        return false;
      }
    } else {
      logError('Invalid response format');
      return false;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 3: GET /api/super-admin/organizations/:id
 */
async function testGetSingleOrganization() {
  logSection('Test 3: GET /api/super-admin/organizations/:id');

  if (!testOrgId) {
    logWarning('No test organization ID available, skipping test');
    return false;
  }

  try {
    logInfo(`Fetching organization: ${testOrgId}`);

    const response = await axios.get(
      `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );

    if (response.data.success && response.data.organization) {
      const org = response.data.organization;
      logSuccess('Organization retrieved successfully');

      logInfo('\nOrganization Details:');
      console.log(`  Name: ${org.name}`);
      console.log(`  Subscription Status: ${org.subscription_status}`);
      console.log(`  Monthly Cost: $${org.monthly_cost || 0}`);
      console.log(`  Contact Email: ${org.contact_email || 'Not set'}`);
      console.log(`  Billing Email: ${org.billing_email || 'Not set'}`);

      if (org.stats) {
        logInfo('\nStats:');
        console.log(`  Total Users: ${org.stats.total_users}`);
        console.log(`  Active Users: ${org.stats.active_users}`);
        console.log(`  Active Last 30 Days: ${org.stats.active_last_30_days}`);
      }

      return true;
    } else {
      logError('Invalid response format');
      return false;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 4: PUT /api/super-admin/organizations/:id/subscription
 */
async function testUpdateSubscription() {
  logSection('Test 4: PUT /api/super-admin/organizations/:id/subscription');

  if (!testOrgId) {
    logWarning('No test organization ID available, skipping test');
    return false;
  }

  try {
    logInfo('Updating subscription fields...');

    const updateData = {
      contact_email: 'test@example.com',
      contact_phone: '555-TEST',
      notes: `[Test] Updated via API test - ${new Date().toISOString()}`
    };

    const response = await axios.put(
      `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}/subscription`,
      updateData,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );

    if (response.data.success && response.data.organization) {
      const org = response.data.organization;
      logSuccess('Subscription updated successfully');

      // Verify updates
      if (org.contact_email === updateData.contact_email) {
        logSuccess('contact_email updated correctly');
      } else {
        logError('contact_email update failed');
      }

      if (org.contact_phone === updateData.contact_phone) {
        logSuccess('contact_phone updated correctly');
      } else {
        logError('contact_phone update failed');
      }

      return true;
    } else {
      logError('Invalid response format');
      return false;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 5: POST /api/super-admin/organizations/:id/add-licenses
 */
async function testAddLicenses() {
  logSection('Test 5: POST /api/super-admin/organizations/:id/add-licenses');

  if (!testOrgId) {
    logWarning('No test organization ID available, skipping test');
    return false;
  }

  try {
    // Get current state first
    const orgResponse = await axios.get(
      `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );

    const currentMaxUsers = orgResponse.data.organization.max_users || 0;
    const currentCost = orgResponse.data.organization.monthly_cost || 0;

    logInfo(`Current max_users: ${currentMaxUsers}`);
    logInfo(`Current monthly_cost: $${currentCost}`);
    logInfo('Adding 2 licenses...');

    const response = await axios.post(
      `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}/add-licenses`,
      { additional_licenses: 2 },
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );

    if (response.data.success && response.data.changes) {
      logSuccess('Licenses added successfully');

      const changes = response.data.changes;
      logInfo('\nChanges:');
      console.log(`  Previous max_users: ${changes.previous_max_users}`);
      console.log(`  New max_users: ${changes.new_max_users}`);
      console.log(`  Licenses added: ${changes.licenses_added}`);
      console.log(`  Previous cost: $${changes.previous_cost}`);
      console.log(`  New cost: $${changes.new_cost}`);
      console.log(`  Cost increase: $${changes.cost_increase}`);

      // Verify calculation
      const expectedNewMax = changes.previous_max_users + 2;
      const expectedNewCost = expectedNewMax * 15;

      if (changes.new_max_users === expectedNewMax) {
        logSuccess('max_users calculated correctly');
      } else {
        logError(`max_users mismatch: expected ${expectedNewMax}, got ${changes.new_max_users}`);
      }

      if (Math.abs(changes.new_cost - expectedNewCost) < 0.01) {
        logSuccess('monthly_cost calculated correctly');
      } else {
        logError(`monthly_cost mismatch: expected ${expectedNewCost}, got ${changes.new_cost}`);
      }

      return true;
    } else {
      logError('Invalid response format');
      return false;
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 6: POST /api/super-admin/organizations/:id/remove-licenses
 */
async function testRemoveLicenses() {
  logSection('Test 6: POST /api/super-admin/organizations/:id/remove-licenses');

  if (!testOrgId) {
    logWarning('No test organization ID available, skipping test');
    return false;
  }

  try {
    // Get current state
    const orgResponse = await axios.get(
      `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );

    const org = orgResponse.data.organization;
    const currentMaxUsers = org.max_users || 0;
    const activeUsers = org.stats?.active_users || 0;

    logInfo(`Current max_users: ${currentMaxUsers}`);
    logInfo(`Active users: ${activeUsers}`);

    // Try to remove 1 license (should be safe)
    const licensesToRemove = 1;

    if (currentMaxUsers - licensesToRemove < activeUsers) {
      logWarning(`Cannot safely remove ${licensesToRemove} licenses (would go below active users)`);
      logInfo('Testing validation error...');

      try {
        await axios.post(
          `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}/remove-licenses`,
          { licenses_to_remove: currentMaxUsers }, // Try to remove all
          { headers: { Authorization: `Bearer ${superAdminToken}` } }
        );
        logError('Should have failed validation');
        return false;
      } catch (validationError) {
        if (validationError.response?.status === 400) {
          logSuccess('Validation error caught correctly');
          logInfo(`Error message: ${validationError.response.data.message}`);
          return true;
        } else {
          logError('Unexpected error');
          return false;
        }
      }
    } else {
      logInfo(`Removing ${licensesToRemove} license...`);

      const response = await axios.post(
        `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}/remove-licenses`,
        { licenses_to_remove: licensesToRemove },
        { headers: { Authorization: `Bearer ${superAdminToken}` } }
      );

      if (response.data.success && response.data.changes) {
        logSuccess('Licenses removed successfully');

        const changes = response.data.changes;
        logInfo('\nChanges:');
        console.log(`  Previous max_users: ${changes.previous_max_users}`);
        console.log(`  New max_users: ${changes.new_max_users}`);
        console.log(`  Licenses removed: ${changes.licenses_removed}`);
        console.log(`  Cost decrease: $${changes.cost_decrease}`);
        console.log(`  Available seats: ${changes.available_seats}`);

        return true;
      } else {
        logError('Invalid response format');
        return false;
      }
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Test 7: POST /api/super-admin/organizations/:id/convert-to-paid
 */
async function testConvertToPaid() {
  logSection('Test 7: POST /api/super-admin/organizations/:id/convert-to-paid');

  if (!testOrgId) {
    logWarning('No test organization ID available, skipping test');
    return false;
  }

  try {
    // Get current state
    const orgResponse = await axios.get(
      `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}`,
      { headers: { Authorization: `Bearer ${superAdminToken}` } }
    );

    const currentStatus = orgResponse.data.organization.subscription_status;
    logInfo(`Current subscription_status: ${currentStatus}`);

    if (currentStatus !== 'trial') {
      logWarning('Organization is not in trial status');
      logInfo('Testing validation error...');

      try {
        await axios.post(
          `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}/convert-to-paid`,
          {},
          { headers: { Authorization: `Bearer ${superAdminToken}` } }
        );
        logError('Should have failed validation');
        return false;
      } catch (validationError) {
        if (validationError.response?.status === 400) {
          logSuccess('Validation error caught correctly');
          logInfo(`Error message: ${validationError.response.data.message}`);
          return true;
        } else {
          logError('Unexpected error');
          return false;
        }
      }
    } else {
      logInfo('Converting trial to paid...');

      const response = await axios.post(
        `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}/convert-to-paid`,
        {},
        { headers: { Authorization: `Bearer ${superAdminToken}` } }
      );

      if (response.data.success && response.data.changes) {
        logSuccess('Converted to paid successfully');

        const changes = response.data.changes;
        logInfo('\nChanges:');
        console.log(`  Previous status: ${changes.previous_status}`);
        console.log(`  New status: ${changes.new_status}`);
        console.log(`  Last payment: ${changes.last_payment_date}`);
        console.log(`  Next billing: ${changes.next_billing_date}`);
        console.log(`  Monthly cost: $${changes.monthly_cost}`);

        // Revert back to trial for future tests
        logInfo('\nReverting to trial status for future tests...');
        await axios.put(
          `${API_BASE_URL}/api/super-admin/organizations/${testOrgId}/subscription`,
          { subscription_status: 'trial' },
          { headers: { Authorization: `Bearer ${superAdminToken}` } }
        );
        logSuccess('Reverted to trial');

        return true;
      } else {
        logError('Invalid response format');
        return false;
      }
    }
  } catch (error) {
    logError(`Failed: ${error.response?.data?.message || error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('\n');
  log('🧪 SUPER ADMIN SUBSCRIPTION API TEST SUITE', 'cyan');
  log('='.repeat(60), 'cyan');
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Super Admin: ${SUPER_ADMIN_EMAIL}`);
  console.log('');

  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  };

  // Test 1: Login
  results.total++;
  const loginSuccess = await testSuperAdminLogin();
  if (loginSuccess) {
    results.passed++;
  } else {
    results.failed++;
    logError('Cannot proceed without authentication');
    printSummary(results);
    process.exit(1);
  }

  // Test 2: Get all organizations
  results.total++;
  const getAllSuccess = await testGetAllOrganizations();
  if (getAllSuccess) {
    results.passed++;
  } else {
    results.failed++;
  }

  // Test 3: Get single organization
  results.total++;
  if (testOrgId) {
    const getSingleSuccess = await testGetSingleOrganization();
    if (getSingleSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    results.skipped++;
    logWarning('Test 3 skipped: No test organization available');
  }

  // Test 4: Update subscription
  results.total++;
  if (testOrgId) {
    const updateSuccess = await testUpdateSubscription();
    if (updateSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    results.skipped++;
    logWarning('Test 4 skipped: No test organization available');
  }

  // Test 5: Add licenses
  results.total++;
  if (testOrgId) {
    const addSuccess = await testAddLicenses();
    if (addSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    results.skipped++;
    logWarning('Test 5 skipped: No test organization available');
  }

  // Test 6: Remove licenses
  results.total++;
  if (testOrgId) {
    const removeSuccess = await testRemoveLicenses();
    if (removeSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    results.skipped++;
    logWarning('Test 6 skipped: No test organization available');
  }

  // Test 7: Convert to paid
  results.total++;
  if (testOrgId) {
    const convertSuccess = await testConvertToPaid();
    if (convertSuccess) {
      results.passed++;
    } else {
      results.failed++;
    }
  } else {
    results.skipped++;
    logWarning('Test 7 skipped: No test organization available');
  }

  printSummary(results);

  process.exit(results.failed > 0 ? 1 : 0);
}

/**
 * Print test summary
 */
function printSummary(results) {
  console.log('\n' + '='.repeat(60));
  log('TEST SUMMARY', 'cyan');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.total}`);
  logSuccess(`Passed: ${results.passed}`);
  if (results.failed > 0) {
    logError(`Failed: ${results.failed}`);
  }
  if (results.skipped > 0) {
    logWarning(`Skipped: ${results.skipped}`);
  }
  console.log('='.repeat(60));

  if (results.failed === 0 && results.passed > 0) {
    log('🎉 ALL TESTS PASSED!', 'green');
  } else if (results.failed > 0) {
    log('❌ SOME TESTS FAILED', 'red');
  }
  console.log('\n');
}

// Run tests
runAllTests().catch(error => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
