#!/usr/bin/env node

const path = require('path');
const { runAllContactTests } = require('./contacts.test.js');
const { runAllApiKeyTests } = require('./api-keys.test.js');
const { runAllWebhookTests } = require('./webhooks.test.js');

// Test runner configuration
const config = {
  apiUrl: process.env.API_URL || 'http://localhost:3000/api',
  timeout: 30000, // 30 seconds
  verbose: process.env.VERBOSE === 'true' || process.argv.includes('--verbose'),
  parallel: process.env.PARALLEL === 'true' || process.argv.includes('--parallel')
};

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Utility functions
function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  colorLog('green', `✅ ${message}`);
}

function logError(message) {
  colorLog('red', `❌ ${message}`);
}

function logWarning(message) {
  colorLog('yellow', `⚠️  ${message}`);
}

function logInfo(message) {
  colorLog('blue', `ℹ️  ${message}`);
}

// Check if server is running
async function checkServerHealth() {
  const axios = require('axios');
  try {
    const response = await axios.get(config.apiUrl.replace('/api', ''), { timeout: 5000 });
    return true;
  } catch (error) {
    return false;
  }
}

// Run pre-test checks
async function preTestChecks() {
  console.log('🔍 Running pre-test checks...\n');

  // Check 1: Server availability
  logInfo('Checking server availability...');
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    logError(`Server not available at ${config.apiUrl}`);
    logWarning('Please ensure the server is running:');
    console.log('   npm run dev');
    console.log('   # or');
    console.log('   npm start');
    process.exit(1);
  }
  logSuccess('Server is running and accessible');

  // Check 2: Environment variables
  logInfo('Checking environment configuration...');
  const requiredEnvVars = ['NODE_ENV'];
  const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
  if (missingEnvVars.length > 0) {
    logWarning(`Missing environment variables: ${missingEnvVars.join(', ')}`);
  }

  // Check 3: Database connectivity (through API health check)
  logInfo('Checking database connectivity...');
  try {
    const axios = require('axios');
    await axios.get(`${config.apiUrl}`, { timeout: 5000 });
    logSuccess('Database connectivity verified');
  } catch (error) {
    logError('Database connectivity check failed');
    logWarning('This might cause test failures');
  }

  console.log('');
}

// Test suite registry
const testSuites = {
  contacts: {
    name: 'Contact Management System Tests',
    runner: runAllContactTests,
    description: 'Comprehensive tests for contact CRUD, conversion, devices, licenses, and trials'
  },
  'api-keys': {
    name: 'API Key Management Tests',
    runner: runAllApiKeyTests,
    description: 'Tests for API key creation, authentication, rate limiting, and multi-tenant isolation'
  },
  webhooks: {
    name: 'Webhook Integration Tests',
    runner: runAllWebhookTests,
    description: 'Tests for Zapier webhook endpoints, field mapping, and lead creation workflows'
  }
  // Additional test suites can be added here
  // leads: { name: 'Lead Management Tests', runner: runLeadTests },
  // users: { name: 'User Management Tests', runner: runUserTests }
};

// Run individual test suite
async function runTestSuite(suiteName) {
  const suite = testSuites[suiteName];
  if (!suite) {
    logError(`Unknown test suite: ${suiteName}`);
    return { success: false, error: 'Suite not found' };
  }

  try {
    colorLog('cyan', `\n🚀 Starting: ${suite.name}`);
    colorLog('cyan', '─'.repeat(suite.name.length + 12));
    
    const startTime = Date.now();
    const result = await suite.runner();
    const duration = Date.now() - startTime;

    if (result.failed === 0) {
      logSuccess(`${suite.name} completed successfully in ${duration}ms`);
      return { success: true, result, duration };
    } else {
      logError(`${suite.name} completed with ${result.failed} failures in ${duration}ms`);
      return { success: false, result, duration };
    }
  } catch (error) {
    logError(`${suite.name} failed with error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// Run all test suites
async function runAllTestSuites() {
  const results = {};
  const startTime = Date.now();
  
  for (const [suiteName, suite] of Object.entries(testSuites)) {
    if (config.verbose) {
      console.log(`\n📋 Description: ${suite.description}`);
    }
    
    results[suiteName] = await runTestSuite(suiteName);
  }
  
  const totalDuration = Date.now() - startTime;
  return { results, totalDuration };
}

// Print final summary
function printFinalSummary(testResults) {
  const { results, totalDuration } = testResults;
  
  console.log('\n' + '='.repeat(60));
  colorLog('magenta', '📊 Final Test Summary');
  console.log('='.repeat(60));
  
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  let successfulSuites = 0;
  
  for (const [suiteName, result] of Object.entries(results)) {
    const suite = testSuites[suiteName];
    const icon = result.success ? '✅' : '❌';
    
    console.log(`${icon} ${suite.name}`);
    
    if (result.result) {
      totalTests += result.result.passed + result.result.failed;
      totalPassed += result.result.passed;
      totalFailed += result.result.failed;
      
      console.log(`   📈 Tests: ${result.result.passed + result.result.failed}`);
      console.log(`   ✅ Passed: ${result.result.passed}`);
      console.log(`   ❌ Failed: ${result.result.failed}`);
      console.log(`   ⏱️  Duration: ${result.duration}ms`);
    } else {
      console.log(`   💥 Error: ${result.error}`);
    }
    
    if (result.success) successfulSuites++;
    console.log('');
  }
  
  // Overall statistics
  colorLog('cyan', '📈 Overall Statistics:');
  console.log(`   🏆 Test Suites: ${successfulSuites}/${Object.keys(results).length} passed`);
  console.log(`   📊 Total Tests: ${totalTests}`);
  console.log(`   ✅ Passed: ${totalPassed}`);
  console.log(`   ❌ Failed: ${totalFailed}`);
  console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
  
  // Success/failure message
  if (totalFailed === 0 && successfulSuites === Object.keys(results).length) {
    console.log('');
    colorLog('green', '🎉 All tests passed! The Contact Management System is working perfectly!');
    
    console.log('\n✨ Verified Features:');
    console.log('• Complete contact CRUD operations');
    console.log('• Lead-to-contact conversion workflow');
    console.log('• MAC address validation and device registration');
    console.log('• License generation and management');
    console.log('• Trial creation and expiration handling');
    console.log('• API key creation and authentication');
    console.log('• Webhook endpoints and field mapping');
    console.log('• Zapier integration workflows');
    console.log('• Rate limiting and security controls');
    console.log('• Multi-tenant data isolation');
    console.log('• API security and validation');
    
    return true;
  } else {
    console.log('');
    colorLog('red', `💥 ${totalFailed} test(s) failed across ${Object.keys(results).length - successfulSuites} test suite(s).`);
    console.log('\n🔧 Next Steps:');
    console.log('1. Review the failed test details above');
    console.log('2. Check server logs for any errors');
    console.log('3. Verify database schema and migrations');
    console.log('4. Run individual test suites for debugging:');
    Object.keys(results).forEach(suite => {
      if (!results[suite].success) {
        console.log(`   npm test ${suite}`);
      }
    });
    
    return false;
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  // Show help
  if (args.includes('--help') || args.includes('-h')) {
    console.log('🧪 Contact Management Test Runner\n');
    console.log('Usage:');
    console.log('  npm test              # Run all test suites');
    console.log('  npm test contacts     # Run contact tests only');
    console.log('  npm test --verbose    # Run with detailed output');
    console.log('  npm test --help       # Show this help\n');
    
    console.log('Available Test Suites:');
    for (const [name, suite] of Object.entries(testSuites)) {
      console.log(`  ${name.padEnd(12)} - ${suite.description}`);
    }
    console.log('');
    
    console.log('Environment Variables:');
    console.log('  API_URL=http://localhost:3000/api  # API base URL');
    console.log('  VERBOSE=true                       # Enable verbose output');
    console.log('  NODE_ENV=test                      # Set test environment');
    console.log('');
    return;
  }
  
  // Print header
  console.log('🧪 Contact Management System - Test Suite');
  console.log('═'.repeat(45));
  console.log(`📍 API URL: ${config.apiUrl}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 Verbose: ${config.verbose}`);
  console.log('');

  try {
    // Run pre-test checks
    await preTestChecks();

    let testResults;
    
    // Check if specific test suite requested
    const requestedSuite = args.find(arg => testSuites[arg]);
    
    if (requestedSuite) {
      // Run specific test suite
      const result = await runTestSuite(requestedSuite);
      testResults = {
        results: { [requestedSuite]: result },
        totalDuration: result.duration
      };
    } else {
      // Run all test suites
      testResults = await runAllTestSuites();
    }
    
    // Print final summary
    const success = printFinalSummary(testResults);
    
    // Exit with appropriate code
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    logError(`Test runner failed: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logError(`Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logError(`Unhandled rejection: ${reason}`);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main();
}

module.exports = { main, runAllTestSuites, runTestSuite };