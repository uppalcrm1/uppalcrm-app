#!/bin/bash

# Pre-Deployment Checklist Script
# Run this before deploying to production

echo ""
echo "🔍 Pre-Deployment Checklist for UppalCRM"
echo "========================================"
echo ""
echo "Review each item before proceeding with deployment:"
echo ""
echo "✓ Testing:"
echo "  [ ] Tested locally?"
echo "  [ ] Tested on staging environment?"
echo "  [ ] Staging monitoring period completed?"
echo ""
echo "✓ Database (if applicable):"
echo "  [ ] Database migrations tested on staging?"
echo "  [ ] Production database backup created?"
echo "  [ ] Rollback migration script ready?"
echo ""
echo "✓ Configuration:"
echo "  [ ] Environment variables updated (if needed)?"
echo "  [ ] Secrets rotated (if needed)?"
echo "  [ ] CORS settings verified?"
echo ""
echo "✓ Communication:"
echo "  [ ] Team notified of deployment?"
echo "  [ ] Breaking changes documented?"
echo "  [ ] Deployment time appropriate (low traffic if high risk)?"
echo ""
echo "✓ Safety:"
echo "  [ ] Rollback plan documented and ready?"
echo "  [ ] Team available to monitor post-deployment?"
echo "  [ ] Customer support team notified (if major change)?"
echo ""
echo "✓ Documentation:"
echo "  [ ] DEPLOYMENT_LOG.md ready to update?"
echo "  [ ] Changes documented in commit messages?"
echo ""
echo "========================================"
echo ""

# Get deployment type
echo "What are you deploying?"
echo "1) Code changes only (no database)"
echo "2) Code + Database migration"
echo "3) Configuration changes only"
echo "4) Hotfix"
read -p "Select (1-4): " deploy_type

echo ""
echo "Risk assessment:"
echo "1) 🟢 Low Risk (UI, text, minor fixes)"
echo "2) 🟡 Medium Risk (new features, API changes)"
echo "3) 🔴 High Risk (database, core logic, multi-tenant changes)"
read -p "Select risk level (1-3): " risk_level

echo ""

if [ "$risk_level" = "3" ]; then
    echo "⚠️  HIGH RISK DEPLOYMENT"
    echo "Additional requirements:"
    echo "  [ ] Staging tested for 24-48 hours?"
    echo "  [ ] Database backup verified?"
    echo "  [ ] Deploying during low-traffic window?"
    echo "  [ ] Team on standby for monitoring?"
    echo ""
fi

echo ""
read -p "All checks completed? Proceed with deployment? (yes/no): " response

if [[ "$response" != "yes" ]]; then
    echo ""
    echo "❌ Deployment cancelled."
    echo "Complete the checklist items and try again."
    echo ""
    exit 1
fi

echo ""
echo "✅ Pre-deployment checklist approved!"
echo ""
echo "Next steps:"
echo "1. git checkout main && git pull"
echo "2. git merge staging"
echo "3. git push origin main"
echo "4. Monitor Render dashboard for deployment"
echo "5. Run health checks after deployment"
echo "6. Update DEPLOYMENT_LOG.md"
echo ""
echo "Good luck! 🚀"
echo ""
