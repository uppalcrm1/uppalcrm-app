#!/usr/bin/env node
/**
 * Install Playwright browsers with aggressive retry logic
 * Used during both postinstall and build phases
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_RETRIES = 3;
let retryCount = 0;

function log(message, type = 'info') {
  const emoji = {
    info: '📦',
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
    play: '🎭',
    retry: '🔄'
  };
  console.log(`${emoji[type]} ${message}`);
}

function isPlaywrightInstalled() {
  try {
    const cacheDir = '/opt/render/.cache/ms-playwright';
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      const hasChromium = files.some(f => f.includes('chromium'));
      if (hasChromium) {
        // Check if the executable actually exists
        const chromiumDirs = fs.readdirSync(cacheDir).filter(f => f.includes('chromium'));
        for (const dir of chromiumDirs) {
          const execPath = path.join(cacheDir, dir, 'chrome-headless-shell-linux64', 'chrome-headless-shell');
          if (fs.existsSync(execPath)) {
            log(`Chromium executable verified at ${execPath}`, 'success');
            return true;
          }
        }
        log(`Chromium directory found but executable missing`, 'warning');
        return false;
      }
    }
  } catch (e) {
    // Continue if we can't check
  }
  return false;
}

function installPlaywright() {
  retryCount++;

  if (retryCount > MAX_RETRIES) {
    log(`Failed to install Playwright after ${MAX_RETRIES} attempts`, 'error');
    log('Continuing startup - will retry at runtime', 'warning');
    process.exit(0);
  }

  log(`Installing Playwright (attempt ${retryCount}/${MAX_RETRIES})...`, 'play');

  try {
    // Try with --with-deps first
    const result = spawnSync('npx', ['playwright', 'install', 'chromium', '--with-deps'], {
      stdio: 'inherit',
      timeout: 600000 // 10 minutes per attempt
    });

    if (result.status === 0) {
      log('Playwright installed successfully', 'success');

      // Verify installation
      if (isPlaywrightInstalled()) {
        log('Playwright verification passed', 'success');
        process.exit(0);
      } else {
        log('Verification failed, retrying...', 'warning');
        installPlaywright();
      }
    } else {
      log(`Installation failed with code ${result.status}, retrying...`, 'warning');

      // Wait a bit before retry
      console.log('Waiting 5 seconds before retry...');
      setTimeout(() => {
        installPlaywright();
      }, 5000);
    }
  } catch (error) {
    log(`Installation error: ${error.message}`, 'error');
    log('Retrying...', 'retry');
    setTimeout(() => {
      installPlaywright();
    }, 5000);
  }
}

// Main
log('Playwright installation script started', 'play');

if (isPlaywrightInstalled()) {
  log('Playwright already installed and verified', 'success');
  process.exit(0);
}

installPlaywright();
