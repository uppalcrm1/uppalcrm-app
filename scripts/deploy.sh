#!/bin/bash

# UppalCRM Deployment Script
# Usage: ./scripts/deploy.sh [staging|production]

set -e

ENVIRONMENT=${1:-staging}

echo "🚀 UppalCRM Deployment Script"
echo "Environment: $ENVIRONMENT"
echo "================================"

# Function to check if branch exists
branch_exists() {
    git show-branch "$1" >/dev/null 2>&1
}

# Function to deploy to staging
deploy_staging() {
    echo "📦 Deploying to STAGING..."

    # Ensure we're on main branch
    git checkout main
    git pull origin main

    # Create or update staging branch
    if branch_exists staging; then
        git checkout staging
        git merge main --no-edit
    else
        git checkout -b staging
    fi

    # Push to staging (triggers automatic deployment)
    git push origin staging

    echo "✅ Staging deployment triggered!"
    echo "🌐 Staging URLs:"
    echo "   Backend:  https://uppalcrm-api-staging.onrender.com"
    echo "   Frontend: https://uppalcrm-frontend-staging.onrender.com"
    echo ""
    echo "⏱️  Deployment takes ~2-3 minutes"
    echo "🧪 Test your changes, then run: ./scripts/deploy.sh production"
}

# Function to deploy to production
deploy_production() {
    echo "🚨 Deploying to PRODUCTION..."

    # Safety check
    read -p "⚠️  Are you sure you want to deploy to production? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Production deployment cancelled"
        exit 1
    fi

    # Ensure staging exists and is up to date
    if ! branch_exists staging; then
        echo "❌ Staging branch doesn't exist. Deploy to staging first!"
        exit 1
    fi

    # Merge staging to main
    git checkout main
    git pull origin main
    git merge staging --no-edit

    # Push to main (triggers production deployment)
    git push origin main

    echo "✅ Production deployment triggered!"
    echo "🌐 Production URLs:"
    echo "   Backend:  https://uppalcrm-api.onrender.com"
    echo "   Frontend: https://uppalcrm-frontend.onrender.com"
    echo ""
    echo "⏱️  Deployment takes ~2-3 minutes"
}

# Main deployment logic
case $ENVIRONMENT in
    staging)
        deploy_staging
        ;;
    production|prod)
        deploy_production
        ;;
    *)
        echo "❌ Invalid environment. Use 'staging' or 'production'"
        echo "Usage: ./scripts/deploy.sh [staging|production]"
        exit 1
        ;;
esac