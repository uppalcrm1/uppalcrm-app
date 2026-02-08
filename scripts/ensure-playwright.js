#!/usr/bin/env node
/**
 * Ensure Playwright browsers are installed before starting the server
 * This script runs before the actual server starts
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🎭 Checking Playwright installation...');

try {
  // Check if chromium is already installed
  const playwrightPath = path.join(process.env.HOME || '/tmp', '.cache/ms-playwright');

  if (fs.existsSync(playwrightPath)) {
    const files = fs.readdirSync(playwrightPath);
    if (files.length > 0) {
      console.log('✅ Playwright browsers already installed');
      process.exit(0);
    }
  }

  console.log('📥 Installing Playwright browsers...');
  execSync('npx playwright install chromium --with-deps', {
    stdio: 'inherit',
    timeout: 600000 // 10 minutes
  });

  console.log('✅ Playwright installation complete');
  process.exit(0);
} catch (error) {
  console.warn('⚠️  Warning: Playwright installation failed, but continuing...');
  console.warn(error.message);
  // Don't exit with error - allow server to start anyway
  process.exit(0);
}
