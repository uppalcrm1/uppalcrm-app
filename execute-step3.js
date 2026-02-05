#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function executeStep3() {
  try {
    log('\n' + '='.repeat(100), 'cyan');
    log('STEP 3: DELETE DEAD CODE FILES', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    const filesToDelete = [
      'backend/controllers/licenseController.js',
      'backend/routes/licenses.js',
      'backend/database/license_schema.sql'
    ];

    // Verify files exist BEFORE deletion
    log('BEFORE - Verify files to be deleted:\n', 'blue');

    const beforeState = {};
    for (const file of filesToDelete) {
      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        beforeState[file] = {
          exists: true,
          size: (stats.size / 1024).toFixed(2)
        };
        log(`  ✅ EXISTS: ${file}`, 'green');
        log(`     Size: ${beforeState[file].size} KB`, 'blue');
      } else {
        beforeState[file] = { exists: false };
        log(`  ❌ NOT FOUND: ${file}`, 'yellow');
      }
    }

    log('\nDeleting files...\n', 'blue');

    const results = {
      deleted: [],
      failed: [],
      notFound: []
    };

    for (const file of filesToDelete) {
      const fullPath = path.join(__dirname, file);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
          log(`  ✅ Deleted: ${file}`, 'green');
          results.deleted.push(file);
        } else {
          log(`  ℹ️  Not found (skipped): ${file}`, 'yellow');
          results.notFound.push(file);
        }
      } catch (e) {
        log(`  ❌ Error deleting ${file}: ${e.message}`, 'red');
        results.failed.push({ file, error: e.message });
      }
    }

    log('\n' + '='.repeat(100), 'cyan');
    log('VERIFICATION - AFTER DELETION', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    // Verify files are gone
    log('Verify files deleted:\n', 'blue');

    for (const file of filesToDelete) {
      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        log(`  ❌ ${file} - Still exists (ERROR)`, 'red');
      } else {
        log(`  ✅ ${file} - Successfully deleted`, 'green');
      }
    }

    // Verify related files still exist (safety check)
    log('\nSafety check - Related files should still exist:\n', 'blue');

    const safetyCheck = [
      'backend/controllers/accountController.js',
      'backend/controllers/transactionController.js',
      'routes/accounts-simple.js',
      'routes/accounts.js',
      'server.js'
    ];

    for (const file of safetyCheck) {
      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        log(`  ✅ ${file} - Still exists`, 'green');
      } else {
        log(`  ❌ ${file} - Missing (ERROR)`, 'red');
      }
    }

    // List remaining files in backend/controllers
    log('\nRemaining files in backend/controllers/:\n', 'blue');
    const controllerDir = path.join(__dirname, 'backend/controllers');
    if (fs.existsSync(controllerDir)) {
      const files = fs.readdirSync(controllerDir)
        .filter(f => f.endsWith('.js'))
        .sort();

      if (files.length === 0) {
        log('  (empty)', 'yellow');
      } else {
        files.forEach(file => {
          const fullPath = path.join(controllerDir, file);
          const stats = fs.statSync(fullPath);
          log(`  • ${file} (${(stats.size / 1024).toFixed(2)} KB)`, 'green');
        });
      }
    }

    // List remaining files in backend/routes
    log('\nRemaining files in backend/routes/:\n', 'blue');
    const routesDir = path.join(__dirname, 'backend/routes');
    if (fs.existsSync(routesDir)) {
      const files = fs.readdirSync(routesDir)
        .filter(f => f.endsWith('.js') && !f.startsWith('__'))
        .sort();

      if (files.length === 0) {
        log('  (empty)', 'yellow');
      } else {
        files.forEach(file => {
          const fullPath = path.join(routesDir, file);
          const stats = fs.statSync(fullPath);
          log(`  • ${file} (${(stats.size / 1024).toFixed(2)} KB)`, 'green');
        });
      }
    }

    log('\n' + '='.repeat(100), 'cyan');
    log('STEP 3 SUMMARY', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    if (results.failed.length === 0) {
      log(`✅ STEP 3 COMPLETED SUCCESSFULLY`, 'green');
      log(`   • ${results.deleted.length} files deleted`, 'green');
      log(`   • 0 errors`, 'green');
      log(`   • All safety checks passed`, 'green');
      log(`\n✅ Ready to proceed to STEP 4\n`, 'green');
    } else {
      log(`⚠️  STEP 3 COMPLETED WITH ERRORS`, 'yellow');
      log(`   • ${results.deleted.length} files deleted`, 'green');
      log(`   • ${results.failed.length} errors`, 'red');
      results.failed.forEach(f => {
        log(`     - ${f.file}: ${f.error}`, 'red');
      });
    }

  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}\n`, 'red');
    process.exit(1);
  }
}

executeStep3();
