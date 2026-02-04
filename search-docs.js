#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

function searchDocumentation() {
  try {
    log('\n' + '='.repeat(100), 'cyan');
    log('STEP 5: SEARCH DOCUMENTATION FOR SOFTWARE_LICENSES REFERENCES', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    const projectRoot = __dirname;
    const searchPatterns = [
      'software_licenses',
      '/api/licenses',
      'software_license'
    ];

    const filesToCheck = [
      'agents/account-management.md',
      'agents/contact-management.md',
      'agents/transaction-management.md',
      'agents/interactions-management.md',
      'agents/reporting-management.md',
      'API_TEST_RESULTS.md',
      'SOFTWARE_LICENSES_COMPREHENSIVE_REPORT.md',
      'SOFTWARE_LICENSES_QUICK_REFERENCE.md',
      'README.md',
      'DEPLOYMENT_GUIDE.md'
    ];

    const findings = [];

    log('Searching documentation files...\n', 'blue');

    for (const file of filesToCheck) {
      const fullPath = path.join(projectRoot, file);

      if (!fs.existsSync(fullPath)) {
        log(`  ⊘ ${file} - File not found`, 'yellow');
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');
      const fileFindings = [];

      lines.forEach((line, lineNum) => {
        searchPatterns.forEach(pattern => {
          if (line.includes(pattern)) {
            fileFindings.push({
              lineNum: lineNum + 1,
              pattern,
              content: line.trim(),
              suggestion: generateSuggestion(line, pattern)
            });
          }
        });
      });

      if (fileFindings.length > 0) {
        log(`  ✅ ${file} - ${fileFindings.length} reference(s) found`, 'green');
        findings.push({
          file,
          fullPath,
          findings: fileFindings
        });
      }
    }

    if (findings.length === 0) {
      log('\n  ℹ️  No references to software_licenses found in checked documentation files', 'yellow');
    } else {
      log('\n' + '='.repeat(100), 'cyan');
      log('DETAILED FINDINGS', 'cyan');
      log('='.repeat(100) + '\n', 'cyan');

      findings.forEach(fileData => {
        log(`FILE: ${fileData.file}\n`, 'bright');

        fileData.findings.forEach((finding, idx) => {
          log(`  ${idx + 1}. Line ${finding.lineNum}:`, 'blue');
          log(`     Pattern: "${finding.pattern}"`, 'yellow');
          log(`     Current:  ${finding.content.substring(0, 80)}`, 'yellow');
          if (finding.suggestion) {
            log(`     Proposed: ${finding.suggestion.substring(0, 80)}`, 'green');
          }
          log();
        });
      });
    }

    log('='.repeat(100), 'cyan');
    log('CHANGE SUMMARY', 'cyan');
    log('='.repeat(100) + '\n', 'cyan');

    let totalChanges = 0;
    const changesByType = {
      software_licenses: 0,
      api_licenses: 0,
      software_license: 0
    };

    findings.forEach(fileData => {
      fileData.findings.forEach(finding => {
        totalChanges++;
        if (finding.pattern === 'software_licenses') changesByType.software_licenses++;
        else if (finding.pattern === '/api/licenses') changesByType.api_licenses++;
        else if (finding.pattern === 'software_license') changesByType.software_license++;
      });
    });

    log(`Total references found: ${totalChanges}\n`, 'blue');
    log('Breakdown by type:', 'blue');
    log(`  • software_licenses: ${changesByType.software_licenses}`, 'yellow');
    log(`  • /api/licenses: ${changesByType.api_licenses}`, 'yellow');
    log(`  • software_license: ${changesByType.software_license}`, 'yellow');

    log('\n' + '='.repeat(100) + '\n', 'cyan');

    if (totalChanges > 0) {
      log(`⏳ ${findings.length} file(s) need updating`, 'yellow');
      log('\nWAITING FOR APPROVAL before making changes...', 'yellow');
    } else {
      log('✅ No documentation changes needed!', 'green');
    }

  } catch (error) {
    log(`\n❌ Error: ${error.message}\n`, 'red');
    process.exit(1);
  }
}

function generateSuggestion(line, pattern) {
  if (pattern === 'software_licenses') {
    return line.replace(/software_licenses/g, 'accounts');
  } else if (pattern === '/api/licenses') {
    return line.replace(/\/api\/licenses/g, '/api/accounts');
  } else if (pattern === 'software_license') {
    return line.replace(/software_license([^s]|$)/g, 'account$1');
  }
  return null;
}

searchDocumentation();
