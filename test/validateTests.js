#!/usr/bin/env node

/**
 * Test Validation Script
 * 
 * This script validates that the test suite is properly configured and ready to run.
 * It checks for required dependencies, file structure, and basic functionality.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

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

// Validation checks
const validationChecks = [
  {
    name: 'Test Directory Structure',
    check: () => {
      const requiredFiles = [
        'test/contacts.test.js',
        'test/fixtures/index.js', 
        'test/helpers/testUtils.js',
        'test/runTests.js',
        'test/README.md'
      ];

      const missingFiles = requiredFiles.filter(file => 
        !fs.existsSync(path.join(__dirname, '..', file))
      );

      if (missingFiles.length > 0) {
        throw new Error(`Missing files: ${missingFiles.join(', ')}`);
      }

      return 'All required test files are present';
    }
  },

  {
    name: 'Package.json Test Scripts',
    check: () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const requiredScripts = ['test', 'test:contacts', 'test:verbose'];
      const missingScripts = requiredScripts.filter(script => 
        !packageJson.scripts || !packageJson.scripts[script]
      );

      if (missingScripts.length > 0) {
        throw new Error(`Missing scripts: ${missingScripts.join(', ')}`);
      }

      return 'All required test scripts are configured';
    }
  },

  {
    name: 'Required Dependencies',
    check: () => {
      const packagePath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      const requiredDeps = ['axios', 'uuid'];
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      const missingDeps = requiredDeps.filter(dep => !allDeps[dep]);

      if (missingDeps.length > 0) {
        throw new Error(`Missing dependencies: ${missingDeps.join(', ')}`);
      }

      return 'All required dependencies are installed';
    }
  },

  {
    name: 'Test File Syntax',
    check: () => {
      try {
        // Test that main test file can be required
        delete require.cache[require.resolve('./contacts.test.js')];
        require('./contacts.test.js');
        
        // Test that fixtures can be required
        delete require.cache[require.resolve('./fixtures/index.js')];
        require('./fixtures/index.js');
        
        // Test that helpers can be required
        delete require.cache[require.resolve('./helpers/testUtils.js')];
        require('./helpers/testUtils.js');
        
        return 'All test files have valid syntax';
      } catch (error) {
        throw new Error(`Syntax error: ${error.message}`);
      }
    }
  },

  {
    name: 'Test Fixtures Functionality',
    check: () => {
      const fixtures = require('./fixtures/index.js');
      
      // Test that fixtures can generate data
      const contact = fixtures.contactFixtures.basicContact();
      const license = fixtures.licenseFixtures.basicLicense();
      const device = fixtures.deviceFixtures.validDevices()[0];
      
      if (!contact.email || !license.software_edition || !device.mac_address) {
        throw new Error('Fixtures are not generating required fields');
      }

      return 'Test fixtures are working correctly';
    }
  },

  {
    name: 'Test Utilities Functionality', 
    check: () => {
      const { TestAssertions, MACAddressValidator } = require('./helpers/testUtils.js');
      
      // Test assertions
      TestAssertions.assertTrue(true, 'Basic assertion test');
      
      // Test MAC validator
      const isValid = MACAddressValidator.isValid('00:1B:44:11:3A:B7');
      if (!isValid) {
        throw new Error('MAC address validator not working');
      }

      return 'Test utilities are functioning correctly';
    }
  },

  {
    name: 'Environment Configuration',
    check: () => {
      const issues = [];
      
      // Check for common environment variables
      if (!process.env.NODE_ENV) {
        issues.push('NODE_ENV not set (recommended: test)');
      }
      
      if (!process.env.API_URL && !process.env.PORT) {
        issues.push('Neither API_URL nor PORT set (using defaults)');
      }

      if (issues.length > 0) {
        return `Environment OK with warnings: ${issues.join(', ')}`;
      }

      return 'Environment configuration is optimal';
    }
  }
];

// Run all validation checks
async function runValidation() {
  console.log('🔍 Validating Contact Management Test Suite');
  console.log('═'.repeat(45));
  console.log('');

  let passed = 0;
  let failed = 0;
  const results = [];

  for (const check of validationChecks) {
    try {
      logInfo(`Checking: ${check.name}...`);
      const result = await check.check();
      logSuccess(result);
      results.push({ name: check.name, status: 'PASSED', message: result });
      passed++;
    } catch (error) {
      logError(`${check.name}: ${error.message}`);
      results.push({ name: check.name, status: 'FAILED', message: error.message });
      failed++;
    }
    console.log('');
  }

  // Summary
  console.log('📊 Validation Summary');
  console.log('═'.repeat(20));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${passed + failed}`);
  console.log('');

  if (failed === 0) {
    colorLog('green', '🎉 All validation checks passed!');
    console.log('');
    colorLog('cyan', '🚀 Ready to run tests:');
    console.log('   npm test              # Run all tests');
    console.log('   npm run test:contacts # Run contact tests');
    console.log('   npm run test:verbose  # Run with detailed output');
    console.log('');
    
    return true;
  } else {
    colorLog('red', `💥 ${failed} validation check(s) failed.`);
    console.log('');
    colorLog('yellow', '🔧 Failed Checks:');
    results
      .filter(r => r.status === 'FAILED')
      .forEach(result => {
        console.log(`   • ${result.name}: ${result.message}`);
      });
    console.log('');
    
    return false;
  }
}

// Export functions for use in other scripts
module.exports = {
  runValidation,
  validationChecks
};

// Run validation if this file is executed directly
if (require.main === module) {
  runValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      logError(`Validation failed: ${error.message}`);
      process.exit(1);
    });
}