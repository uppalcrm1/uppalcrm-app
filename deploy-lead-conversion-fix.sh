#!/bin/bash

# Deploy lead conversion fix to production
# This script deploys the fix for the "cannot insert a non-DEFAULT value into column status" error

echo "🚀 Deploying lead conversion fix to production..."

# Check if we're on the right branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  Warning: You're on branch '$CURRENT_BRANCH', not 'main'"
  read -p "Continue anyway? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
  fi
fi

# Stage the changes
echo "📦 Staging changes..."
git add routes/contacts.js

# Create a commit
echo "💾 Creating commit..."
git commit -m "fix: Use contact_status instead of status in lead conversion

The status column is a GENERATED column that cannot accept direct inserts.
This fix changes the INSERT statement to use contact_status instead,
which resolves the 500 error when converting leads to contacts.

🤖 Generated with Claude Code https://claude.com/claude-code

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push to remote
echo "⬆️  Pushing to remote..."
git push origin main

echo ""
echo "✅ Deploy complete!"
echo ""
echo "📝 Next steps:"
echo "1. Wait for Render to automatically deploy the changes (~2-3 minutes)"
echo "2. Monitor the deploy at: https://dashboard.render.com/"
echo "3. Test lead conversion in production once deployed"
echo ""
echo "🔍 To monitor the deploy:"
echo "   - Check Render dashboard for deployment status"
echo "   - Look for the commit message in the deploy logs"
echo "   - Test converting a lead after deployment completes"
