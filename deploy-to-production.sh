#!/bin/bash

# Production Deployment Script
# Deploys account_status consolidation to production

echo "🚀 PRODUCTION DEPLOYMENT - Account Status Consolidation"
echo "========================================================"
echo ""

# Safety checks
echo "⚠️  SAFETY CHECKS"
echo "================="
echo ""

echo "1️⃣ Checking production database backup..."
if [ -z "$BACKUP_CONFIRMED" ]; then
  echo "❌ ERROR: Database backup not confirmed!"
  echo "   Please create a backup FIRST:"
  echo "   1. Go to: https://dashboard.render.com"
  echo "   2. Select: uppalcrm-database (production)"
  echo "   3. Click: 'Backups' tab"
  echo "   4. Click: 'Create Manual Backup'"
  echo "   5. Wait for backup to complete"
  echo "   6. Export BACKUP_CONFIRMED=yes"
  echo "   7. Run this script again"
  exit 1
fi
echo "✅ Backup confirmed"
echo ""

echo "2️⃣ Checking git status..."
if [ "$(git status --porcelain)" != "" ]; then
  echo "❌ ERROR: Uncommitted changes in git!"
  echo "   Please commit all changes first:"
  echo "   git add ."
  echo "   git commit -m \"message\""
  exit 1
fi
echo "✅ Git status clean"
echo ""

# Deployment steps
echo "📋 DEPLOYMENT STEPS"
echo "==================="
echo ""

echo "Step 1: Merge staging into main"
git checkout main || exit 1
git merge origin/staging --no-edit || exit 1
echo "✅ Merged staging into main"
echo ""

echo "Step 2: Push to GitHub (triggers Render deployment)"
git push origin main || exit 1
echo "✅ Pushed to GitHub"
echo ""

echo "Step 3: Waiting for Render deployment..."
echo "   This takes 3-5 minutes for backend + frontend"
echo "   Monitor at: https://dashboard.render.com"
echo ""
echo "⏳ Please wait..."
sleep 30
echo ""

echo "Step 4: Render should now be deploying..."
echo "   - Backend auto-rebuild: ~3-5 minutes"
echo "   - Frontend auto-rebuild: ~3-5 minutes"
echo "   - Verify builds in Render dashboard"
echo ""

echo "Step 5: After Render deployment, run database migration:"
echo "   cd C:\Users\uppal\uppal-crm-project"
echo "   export DATABASE_URL=<production-database-url>"
echo "   node run-production-migration.js"
echo ""

echo "========================================================"
echo "✅ CODE DEPLOYMENT COMPLETE"
echo "========================================================"
echo ""
echo "NEXT: Run the database migration script when ready:"
echo "   BACKUP_CONFIRMED=yes DATABASE_URL=... node run-production-migration.js"
echo ""
