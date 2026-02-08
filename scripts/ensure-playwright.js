#!/usr/bin/env node
/**
 * Ensure Playwright browsers are installed before starting the server
 * This script runs before the actual server starts
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🎭 Checking Playwright installation...');

try {
  // Check multiple possible playwright cache paths
  const possiblePaths = [
    path.join(process.env.HOME || os.homedir(), '.cache/ms-playwright'),
    '/opt/render/.cache/ms-playwright',
    '/tmp/.cache/ms-playwright',
    path.join(process.env.TMPDIR || '/tmp', '.ms-playwright')
  ];

  let browserFound = false;

  for (const playwrightPath of possiblePaths) {
    if (fs.existsSync(playwrightPath)) {
      const files = fs.readdirSync(playwrightPath);
      if (files.length > 0) {
        console.log(`✅ Playwright browsers found at ${playwrightPath}`);
        browserFound = true;
        break;
      }
    }
  }

  if (browserFound) {
    console.log('✅ Playwright browsers already installed');
    process.exit(0);
  }

  console.log('📥 Installing Playwright browsers (this may take 2-3 minutes)...');
  execSync('npx playwright install chromium --with-deps', {
    stdio: 'inherit',
    timeout: 900000 // 15 minutes
  });

  console.log('✅ Playwright installation complete');
  process.exit(0);
} catch (error) {
  console.warn('⚠️  Warning: Playwright installation failed, but continuing...');
  console.warn(error.message);
  // Don't exit with error - allow server to start anyway
  process.exit(0);
}
