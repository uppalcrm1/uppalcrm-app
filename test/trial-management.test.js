#!/usr/bin/env node

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Test configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3003/api';
const VERBOSE = process.env.VERBOSE === 'true';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Helper functions
const log = (message, color = 'white') => console.log(colors[color] + message + colors.reset);
const error = (message) => log('❌ ' + message, 'red');
const success = (message) => log('✅ ' + message, 'green');
const info = (message) => log('ℹ️  ' + message, 'blue');
const warn = (message) => log('⚠️  ' + message, 'yellow');

class TrialManagementTester {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.testOrgId = null;
    this.authToken = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async setupTestOrganization() {
    try {
      const timestamp = Date.now();
      const orgData = {
        organization: {
          name: `Test Org ${timestamp}`,
          slug: `testorg${timestamp}`,
          domain: `test${timestamp}.example.com`
        },
        admin: {
          first_name: 'Trial',
          last_name: 'Admin',
          email: `admin+${timestamp}@example.com`,
          password: 'TestPassword123!'
        }
      };

      const response = await axios.post(`${this.baseURL}/auth/register`, orgData);
      
      if (response.data.token && response.data.organization) {
        this.testOrgId = response.data.organization.id;
        this.authToken = response.data.token;
        success(`Test organization created: ${orgData.organization.slug}`);
        return true;
      }
    } catch (error) {
      error(`Failed to create test organization: ${error.message}`);
      return false;
    }
  }

  getHeaders() {
    return {
      'Authorization': `Bearer ${this.authToken}`,
      'Content-Type': 'application/json',
      'X-Organization-Slug': `testorg${Date.now()}`
    };
  }

  async testTrialEligibility() {
    try {
      info('Testing trial eligibility check...');
      
      const response = await axios.get(`${this.baseURL}/trials/check-eligibility`, {
        headers: this.getHeaders()
      });

      if (response.data.eligible === true) {
        success('✓ Organization is eligible for trial');
        return true;
      } else {
        warn('Organization is not eligible for trial');
        return false;
      }
    } catch (error) {
      error(`Trial eligibility test failed: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async testStartTrial() {
    try {
      info('Testing trial start...');
      
      const response = await axios.post(`${this.baseURL}/trials/start`, {
        trial_days: 30
      }, {
        headers: this.getHeaders()
      });

      if (response.data.trial && response.data.trial.trial_status === 'active') {
        success('✓ Trial started successfully');
        success(`  - Duration: ${response.data.trial.trial_days} days`);
        success(`  - Days remaining: ${response.data.trial.days_remaining}`);
        return true;
      }
    } catch (error) {
      error(`Start trial test failed: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async testTrialStatus() {
    try {
      info('Testing trial status retrieval...');
      
      const response = await axios.get(`${this.baseURL}/trials/status`, {
        headers: this.getHeaders()
      });

      if (response.data.trial) {
        success('✓ Trial status retrieved successfully');
        success(`  - Status: ${response.data.trial.trial_status}`);
        success(`  - Days remaining: ${response.data.trial.days_remaining}`);
        success(`  - Progress: ${Math.round(response.data.trial.trial_progress_percentage)}%`);
        return true;
      }
    } catch (error) {
      error(`Trial status test failed: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async testExtendTrial() {
    try {
      info('Testing trial extension...');
      
      const response = await axios.post(`${this.baseURL}/trials/extend`, {
        additional_days: 7
      }, {
        headers: this.getHeaders()
      });

      if (response.data.trial) {
        success('✓ Trial extended successfully');
        success(`  - New duration: ${response.data.trial.trial_days} days`);
        return true;
      }
    } catch (error) {
      error(`Trial extension test failed: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async testTrialHistory() {
    try {
      info('Testing trial history...');
      
      const response = await axios.get(`${this.baseURL}/trials/history`, {
        headers: this.getHeaders()
      });

      if (response.data.history !== undefined) {
        success('✓ Trial history retrieved successfully');
        success(`  - History entries: ${response.data.count || 0}`);
        return true;
      }
    } catch (error) {
      error(`Trial history test failed: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async testCancelTrial() {
    try {
      info('Testing trial cancellation...');
      
      const response = await axios.post(`${this.baseURL}/trials/cancel`, {
        reason: 'Test cancellation'
      }, {
        headers: this.getHeaders()
      });

      if (response.data.trial && response.data.trial.trial_status === 'cancelled') {
        success('✓ Trial cancelled successfully');
        success(`  - Final status: ${response.data.trial.trial_status}`);
        return true;
      }
    } catch (error) {
      error(`Trial cancellation test failed: ${error.response?.data?.message || error.message}`);
      return false;
    }
  }

  async runTest(testName, testFunction) {
    log(`\n🧪 ${testName}`, 'cyan');
    log('═'.repeat(50), 'cyan');
    
    try {
      const result = await testFunction.call(this);
      
      if (result) {
        this.testResults.passed++;
        this.testResults.tests.push({ name: testName, status: 'PASSED' });
        success(`${testName} - PASSED\n`);
      } else {
        this.testResults.failed++;
        this.testResults.tests.push({ name: testName, status: 'FAILED' });
        error(`${testName} - FAILED\n`);
      }
      
      return result;
    } catch (err) {
      this.testResults.failed++;
      this.testResults.tests.push({ name: testName, status: 'ERROR', error: err.message });
      error(`${testName} - ERROR: ${err.message}\n`);
      return false;
    }
  }

  async runAllTests() {
    log('\n🚀 Trial Management System - Test Suite', 'bright');
    log('═'.repeat(50), 'bright');
    log(`📍 API URL: ${this.baseURL}`, 'blue');
    log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`, 'blue');
    log(`📝 Verbose: ${VERBOSE}`, 'blue');

    // Setup test organization
    if (!(await this.setupTestOrganization())) {
      error('Failed to setup test environment. Exiting.');
      process.exit(1);
    }

    // Run trial management tests
    await this.runTest('Trial Eligibility Check', this.testTrialEligibility);
    await this.runTest('Start Trial', this.testStartTrial);
    await this.runTest('Trial Status Retrieval', this.testTrialStatus);
    await this.runTest('Extend Trial', this.testExtendTrial);
    await this.runTest('Trial History', this.testTrialHistory);
    await this.runTest('Cancel Trial', this.testCancelTrial);

    // Test summary
    this.printSummary();
    
    return this.testResults.failed === 0;
  }

  printSummary() {
    log('\n🎯 Test Results Summary', 'bright');
    log('═'.repeat(25), 'bright');
    success(`✅ Passed: ${this.testResults.passed}`);
    error(`❌ Failed: ${this.testResults.failed}`);
    log(`📊 Total:  ${this.testResults.passed + this.testResults.failed}`, 'blue');

    this.testResults.tests.forEach(test => {
      if (test.status === 'PASSED') {
        success(`✅ ${test.name}`);
      } else {
        error(`❌ ${test.name}`);
      }
    });

    if (this.testResults.failed > 0) {
      warn(`\n⚠️  ${this.testResults.failed} test(s) failed. Please review the errors above.`);
    } else {
      success('\n🎉 All tests passed! Trial Management System is working correctly.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new TrialManagementTester();
  tester.runAllTests().then(success => {
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = TrialManagementTester;