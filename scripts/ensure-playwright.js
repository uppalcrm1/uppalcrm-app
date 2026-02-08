#!/usr/bin/env node
/**
 * Ensure Playwright browsers are installed before starting the server
 * This runs at startup and will aggressively install if needed
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_INSTALL_ATTEMPTS = 2;
let installAttempts = 0;

function log(msg, type = 'info') {
  const emoji = { info: '📦', success: '✅', warning: '⚠️ ', error: '❌', play: '🎭', check: '🔍' };
  console.log(`${emoji[type]} ${msg}`);
}

function checkPlaywrightInstalled() {
  log('Checking Playwright installation...', 'check');

  const possiblePaths = [
    '/opt/render/.cache/ms-playwright',
    path.join(process.env.HOME || os.homedir(), '.cache/ms-playwright'),
    '/tmp/.cache/ms-playwright',
    path.join(process.env.TMPDIR || '/tmp', '.ms-playwright'),
    process.env.PLAYWRIGHT_BROWSERS_PATH
  ].filter(Boolean);

  for (const checkPath of possiblePaths) {
    if (!checkPath) continue;
    try {
      if (fs.existsSync(checkPath)) {
        const files = fs.readdirSync(checkPath);
        if (files.length > 0) {
          log(`Playwright found at ${checkPath}`, 'success');

          // Verify executable exists
          const chromiumDirs = files.filter(f => f.includes('chromium'));
          for (const dir of chromiumDirs) {
            const execPath = path.join(checkPath, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
            if (fs.existsSync(execPath)) {
              log('Chromium executable verified', 'success');
              return true;
            }
          }

          log('Chromium directory exists but executable missing', 'warning');
          return false;
        }
      }
    } catch (e) {
      // Continue checking other paths
    }
  }

  log('Playwright browsers not found', 'warning');
  return false;
}

function installPlaywright() {
  installAttempts++;

  if (installAttempts > MAX_INSTALL_ATTEMPTS) {
    log(`Failed after ${MAX_INSTALL_ATTEMPTS} attempts - continuing without Playwright`, 'warning');
    log('MAC Address Search will not work until Playwright is installed', 'warning');
    return;
  }

  log(`Installing Playwright (attempt ${installAttempts}/${MAX_INSTALL_ATTEMPTS})...`, 'play');

  const result = spawnSync('npx', ['playwright', 'install', 'chromium', '--with-deps'], {
    stdio: 'inherit',
    timeout: 600000 // 10 minutes
  });

  if (result.status === 0) {
    log('Playwright installation completed', 'success');

    // Verify it worked
    if (checkPlaywrightInstalled()) {
      log('Installation verified successfully', 'success');
      return;
    } else {
      log('Verification failed, will retry...', 'warning');
      if (installAttempts < MAX_INSTALL_ATTEMPTS) {
        setTimeout(() => installPlaywright(), 2000);
      }
    }
  } else {
    log(`Installation exited with code ${result.status}`, 'warning');
    if (installAttempts < MAX_INSTALL_ATTEMPTS) {
      log('Retrying installation...', 'play');
      setTimeout(() => installPlaywright(), 2000);
    }
  }
}

// Main execution
try {
  log('Starting Playwright verification at startup...', 'play');

  if (!checkPlaywrightInstalled()) {
    installPlaywright();
  } else {
    log('Ready to start server', 'success');
  }

  // Always allow server to start
  process.exit(0);
} catch (error) {
  log(`Error: ${error.message}`, 'error');
  log('Continuing startup anyway...', 'warning');
  process.exit(0);
}
