#!/bin/bash

# Deploy Custom Fields to Staging
# This script helps deploy the custom fields migration to staging environment

echo "🚀 Custom Fields Deployment to STAGING"
echo "═══════════════════════════════════════════════════"
echo ""

# Step 1: Check if we're on staging branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📋 Current branch: $CURRENT_BRANCH"

if [ "$CURRENT_BRANCH" != "staging" ]; then
  echo "⚠️  Warning: You're on '$CURRENT_BRANCH' branch, not 'staging'"
  echo "   Switching to staging branch..."
  git checkout staging
  echo "✓ Switched to staging branch"
fi

echo ""

# Step 2: Pull latest changes
echo "📥 Pulling latest changes from remote..."
git pull origin staging
echo "✓ Staging branch is up to date"
echo ""

# Step 3: Apply migration
echo "📦 Ready to apply database migration"
echo ""
echo "This will:"
echo "  • Add custom_fields column to contacts table"
echo "  • Create GIN index for efficient queries"
echo "  • Verify the changes"
echo ""
echo "Run the migration with:"
echo "  node scripts/deploy-custom-fields-staging.js"
echo ""
