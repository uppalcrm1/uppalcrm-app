#!/usr/bin/env node
/**
 * Build script for Render deployment
 * Handles Node dependency installation and Playwright browser setup
 */

const { execSync } = require('child_process');
const fs = require('fs');

function log(message, type = 'info') {
  const emoji = {
    info: '📦',
    success: '✅',
    warning: '⚠️ ',
    error: '❌',
    build: '🏗️ ',
    play: '🎭',
    check: '🔍'
  };
  console.log(`${emoji[type]} ${message}`);
}

function run(command, description) {
  try {
    log(description, 'info');
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    log(`${description} - FAILED`, 'error');
    return false;
  }
}

async function main() {
  log('Starting build process', 'build');
  log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`, 'info');

  try {
    // Step 1: Install Node dependencies
    if (!run('npm install --force', 'Installing Node dependencies')) {
      throw new Error('Failed to install dependencies');
    }

    // Step 2: Try to install Playwright with system dependencies
    log('Installing Playwright browsers...', 'play');

    let playwrightInstalled = false;

    // Try with --with-deps first
    try {
      execSync('npx playwright install chromium --with-deps', { stdio: 'inherit' });
      log('Playwright installed successfully with system dependencies', 'success');
      playwrightInstalled = true;
    } catch (e) {
      log('Playwright install with --with-deps failed, trying without...', 'warning');

      // Try without --with-deps
      try {
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        log('Playwright installed successfully', 'success');
        playwrightInstalled = true;
      } catch (e2) {
        log('Playwright installation failed', 'error');
        log('MAC Address Search will not work until Playwright is installed', 'warning');
      }
    }

    // Step 3: Verify Playwright installation
    log('Verifying Playwright installation...', 'check');
    try {
      const result = execSync('npx playwright browsers', { encoding: 'utf-8' });
      if (result.includes('chromium')) {
        log('Chromium verified', 'success');
      } else {
        log('Chromium not found in list', 'warning');
      }
    } catch (e) {
      log('Could not verify Playwright browsers', 'warning');
    }

    log('Build complete', 'success');
    process.exit(0);
  } catch (error) {
    log(`Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

main();
