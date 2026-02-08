#!/usr/bin/env node
/**
 * Ensure Playwright browsers are installed before starting the server
 * This script runs before the actual server starts
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🎭 Checking Playwright installation...');
console.log(`📍 Current environment: NODE_ENV=${process.env.NODE_ENV}`);
console.log(`📍 HOME: ${process.env.HOME}`);
console.log(`📍 TMPDIR: ${process.env.TMPDIR}`);

try {
  // Check multiple possible playwright cache paths
  const possiblePaths = [
    path.join(process.env.HOME || os.homedir(), '.cache/ms-playwright'),
    '/opt/render/.cache/ms-playwright',
    '/tmp/.cache/ms-playwright',
    path.join(process.env.TMPDIR || '/tmp', '.ms-playwright'),
    process.env.PLAYWRIGHT_BROWSERS_PATH
  ].filter(Boolean);

  console.log('📁 Checking cache paths:');
  possiblePaths.forEach(p => console.log(`   - ${p}`));

  let browserFound = false;

  for (const playwrightPath of possiblePaths) {
    if (!playwrightPath) continue;
    if (fs.existsSync(playwrightPath)) {
      try {
        const files = fs.readdirSync(playwrightPath);
        if (files.length > 0) {
          console.log(`✅ Playwright browsers found at ${playwrightPath}`);
          console.log(`   Files: ${files.slice(0, 3).join(', ')}...`);
          browserFound = true;
          break;
        }
      } catch (e) {
        console.log(`   ⚠️  Can't read ${playwrightPath}: ${e.message}`);
      }
    }
  }

  if (browserFound) {
    console.log('✅ Playwright browsers already installed');
    process.exit(0);
  }

  console.log('⚠️  Playwright browsers not found');
  console.log('📥 Installing Playwright browsers (this may take 3-5 minutes)...');

  // Use spawnSync for better output streaming
  const result = spawnSync('npx', ['playwright', 'install', 'chromium', '--with-deps'], {
    stdio: 'inherit',
    timeout: 1200000 // 20 minutes
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    console.error(`⚠️  Playwright installation exited with code ${result.status}`);
    throw new Error(`Playwright installation failed with code ${result.status}`);
  }

  console.log('✅ Playwright installation complete');
  process.exit(0);
} catch (error) {
  console.error('❌ Error during Playwright setup:', error.message);
  console.warn('⚠️  Warning: Continuing server startup despite Playwright issue...');
  console.warn('   MAC Address Search may fail if browsers are not available');
  // Don't exit with error - allow server to start anyway
  process.exit(0);
}
