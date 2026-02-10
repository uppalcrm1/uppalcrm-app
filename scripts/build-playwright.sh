#!/bin/bash
# Build script for Render that ensures Playwright is properly installed
# This handles the special requirements for Playwright on Render infrastructure

set -e  # Exit on any error

echo "🏗️  Starting build process..."
echo "NODE_ENV: $NODE_ENV"

# Step 1: Install Node dependencies
echo "📦 Installing Node dependencies..."
npm install --force

# Step 2: Try to install Playwright with system dependencies
echo "🎭 Installing Playwright browsers with system dependencies..."
if npx playwright install chromium --with-deps; then
  echo "✅ Playwright installed successfully"
else
  echo "⚠️  Playwright install with --with-deps failed, trying without --with-deps..."
  if npx playwright install chromium; then
    echo "✅ Playwright installed successfully (without system deps)"
  else
    echo "❌ Playwright installation failed completely"
    echo "⚠️  MAC Address Search will not work until Playwright is installed"
    # Don't fail the build - the startup script will handle it
  fi
fi

# Step 3: Verify Playwright installation
echo "🔍 Verifying Playwright installation..."
if npx playwright browsers | grep -q "chromium"; then
  echo "✅ Chromium verified"
else
  echo "⚠️  Chromium not found in Playwright browsers list"
fi

echo "✅ Build complete"
