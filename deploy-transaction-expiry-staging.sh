#!/bin/bash

#####################################################
# STAGING DEPLOYMENT SCRIPT
# Transaction Manual Expiry Update (Option 4)
# Date: 2025-12-22
#####################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "======================================================"
echo "  TRANSACTION EXPIRY UPDATE - STAGING DEPLOYMENT"
echo "======================================================"
echo ""

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Confirm staging deployment
echo ""
print_warning "You are about to deploy TRANSACTION EXPIRY UPDATE to STAGING"
echo ""
print_info "This deployment includes:"
echo "  • Manual expiry date control in transaction creation"
echo "  • Three calculation methods (extend, start from today, custom)"
echo "  • Live preview of expiry changes"
echo "  • NO database migrations required (uses existing fields)"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_error "Deployment cancelled"
    exit 1
fi

echo ""
print_info "Starting deployment process..."
echo ""

#####################################################
# STEP 1: VERIFY NO CONFLICTS
#####################################################

echo "======================================================"
echo "STEP 1: Verify No Conflicts"
echo "======================================================"
echo ""

print_info "Checking for uncommitted changes..."

if git diff --quiet && git diff --cached --quiet; then
    print_success "No uncommitted changes found"
else
    print_warning "You have uncommitted changes"
    git status --short
    echo ""
    read -p "Continue anyway? (yes/no): " continue_confirm

    if [ "$continue_confirm" != "yes" ]; then
        print_error "Deployment cancelled"
        exit 1
    fi
fi

echo ""

#####################################################
# STEP 2: COMMIT CHANGES TO GIT
#####################################################

echo "======================================================"
echo "STEP 2: Commit Changes to Git"
echo "======================================================"
echo ""

print_info "Files modified for this feature:"
echo "  ✓ routes/transactions.js (backend)"
echo "  ✓ frontend/src/components/CreateTransactionModal.jsx (frontend)"
echo ""

print_info "Changes:"
echo "  • Added update_account_expiry and new_expiry_date fields to API"
echo "  • Added expiry update section in transaction modal"
echo "  • Added 3 calculation methods + preview"
echo "  • Account expiry updates atomically with transaction"
echo ""

read -p "Commit these changes to Git? (yes/no): " git_confirm

if [ "$git_confirm" == "yes" ]; then
    print_info "Adding files to Git..."

    git add routes/transactions.js
    git add frontend/src/components/CreateTransactionModal.jsx
    git add TRANSACTION_EXPIRY_UPDATE.md

    print_info "Creating commit..."

    git commit -m "feat: Add manual expiry update to transaction creation (Option 4)

- Add update_account_expiry and new_expiry_date fields to transactions API
- Add expiry update section in CreateTransactionModal with 3 calculation methods
- Add live preview showing before/after expiry dates
- Update account expiry atomically with transaction creation
- No database migrations required (uses existing fields)

User can now:
- Choose to update account expiry when creating transaction
- Select from 3 calculation methods (extend, start from today, custom)
- Preview expiry changes before confirming
- Skip expiry update for special transactions

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

    if [ $? -eq 0 ]; then
        print_success "Changes committed to Git"
    else
        print_error "Git commit failed!"
        exit 1
    fi
else
    print_warning "Skipping Git commit"
fi

echo ""

#####################################################
# STEP 3: PUSH TO STAGING BRANCH
#####################################################

echo "======================================================"
echo "STEP 3: Push to Staging Branch"
echo "======================================================"
echo ""

print_info "Current branch: $(git branch --show-current)"
echo ""

read -p "Push to staging branch? (yes/no): " push_confirm

if [ "$push_confirm" == "yes" ]; then
    CURRENT_BRANCH=$(git branch --show-current)

    print_info "Pushing $CURRENT_BRANCH to origin..."

    git push origin $CURRENT_BRANCH

    if [ $? -eq 0 ]; then
        print_success "Code pushed to remote"
    else
        print_error "Git push failed!"
        exit 1
    fi
else
    print_warning "Skipping Git push - you'll need to deploy manually"
fi

echo ""

#####################################################
# STEP 4: DEPLOY TO STAGING SERVER
#####################################################

echo "======================================================"
echo "STEP 4: Deploy to Staging Server"
echo "======================================================"
echo ""

print_info "Deployment methods:"
echo ""
echo "  A) Render.com (Auto-deploy from Git)"
echo "  B) Manual server deployment"
echo "  C) Skip (already deployed)"
echo ""

read -p "Select deployment method (A/B/C): " deploy_method

if [ "$deploy_method" == "A" ] || [ "$deploy_method" == "a" ]; then
    print_info "For Render.com auto-deploy:"
    echo ""
    echo "1. Render will automatically detect the push"
    echo "2. Wait for build to complete (~2-5 minutes)"
    echo "3. Check Render dashboard for deployment status"
    echo ""
    print_warning "Monitor at: https://dashboard.render.com"
    echo ""
    read -p "Press Enter when deployment is complete..."

elif [ "$deploy_method" == "B" ] || [ "$deploy_method" == "b" ]; then
    print_info "Manual deployment steps:"
    echo ""
    echo "1. SSH into staging server:"
    echo "   ssh user@your-staging-server.com"
    echo ""
    echo "2. Navigate to project directory:"
    echo "   cd /path/to/uppal-crm"
    echo ""
    echo "3. Pull latest changes:"
    echo "   git pull origin main (or your branch)"
    echo ""
    echo "4. Install dependencies (if needed):"
    echo "   npm install"
    echo "   cd frontend && npm install && cd .."
    echo ""
    echo "5. Build frontend:"
    echo "   cd frontend && npm run build && cd .."
    echo ""
    echo "6. Restart backend:"
    echo "   pm2 restart all"
    echo "   OR"
    echo "   systemctl restart uppal-crm"
    echo ""
    read -p "Press Enter when deployment is complete..."

else
    print_info "Skipping deployment step"
fi

print_success "Code deployed to staging"

echo ""

#####################################################
# STEP 5: VERIFY DEPLOYMENT
#####################################################

echo "======================================================"
echo "STEP 5: Verify Deployment"
echo "======================================================"
echo ""

print_info "Verification steps:"
echo ""

# Test 1: Check if backend is accessible
print_info "Test 1: Checking backend API..."

if [ -z "$STAGING_API_URL" ]; then
    print_warning "STAGING_API_URL not set"
    read -p "Enter staging API URL (e.g., https://api-staging.yourapp.com): " STAGING_API_URL
fi

if [ ! -z "$STAGING_API_URL" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_API_URL/health" || echo "000")

    if [ "$HTTP_CODE" == "200" ]; then
        print_success "Backend API is accessible (HTTP $HTTP_CODE)"
    else
        print_warning "Backend API returned HTTP $HTTP_CODE"
    fi
else
    print_warning "Skipping API check"
fi

echo ""

# Test 2: Check frontend
print_info "Test 2: Checking frontend..."

if [ -z "$STAGING_FRONTEND_URL" ]; then
    print_warning "STAGING_FRONTEND_URL not set"
    read -p "Enter staging frontend URL (e.g., https://staging.yourapp.com): " STAGING_FRONTEND_URL
fi

if [ ! -z "$STAGING_FRONTEND_URL" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_FRONTEND_URL" || echo "000")

    if [ "$HTTP_CODE" == "200" ]; then
        print_success "Frontend is accessible (HTTP $HTTP_CODE)"
    else
        print_warning "Frontend returned HTTP $HTTP_CODE"
    fi
else
    print_warning "Skipping frontend check"
fi

echo ""

#####################################################
# STEP 6: MANUAL TESTING GUIDE
#####################################################

echo "======================================================"
echo "STEP 6: Manual Testing Guide"
echo "======================================================"
echo ""

print_success "Deployment complete! Now test the feature:"
echo ""

print_info "TEST 1: Transaction with Expiry Update"
echo "---------------------------------------"
echo "1. Open staging: $STAGING_FRONTEND_URL"
echo "2. Navigate to any account"
echo "3. Click 'Create Transaction'"
echo "4. Fill transaction details:"
echo "   • Amount: \$150"
echo "   • Term: 3 Months"
echo "   • Payment Date: Today"
echo "5. In 'Update Account Expiry' section:"
echo "   ☑ Checkbox is checked (default)"
echo "   ● Select 'Extend from current expiry'"
echo "6. Verify preview shows:"
echo "   • Current Expiry: [current date]"
echo "   • New Expiry: [current + 3 months]"
echo "   • Extension: +X days"
echo "7. Click 'Create Transaction & Update Expiry'"
echo "8. ✅ Verify:"
echo "   • Transaction created"
echo "   • Account expiry updated to new date"
echo "   • Success message shows"
echo ""

print_info "TEST 2: Transaction WITHOUT Expiry Update"
echo "---------------------------------------"
echo "1. Open transaction modal again"
echo "2. Fill transaction details"
echo "3. ☐ UNCHECK 'Update account expiry'"
echo "4. Click 'Create Transaction'"
echo "5. ✅ Verify:"
echo "   • Transaction created"
echo "   • Account expiry NOT changed"
echo ""

print_info "TEST 3: Start from Payment Date"
echo "---------------------------------------"
echo "1. Open transaction modal"
echo "2. Select ● 'Start from payment date'"
echo "3. Verify preview calculates from payment date"
echo "4. Create transaction"
echo "5. ✅ Verify expiry is correct"
echo ""

print_info "TEST 4: Custom Date"
echo "---------------------------------------"
echo "1. Open transaction modal"
echo "2. Select ● 'Custom date'"
echo "3. Manually pick a date"
echo "4. Create transaction"
echo "5. ✅ Verify account expiry matches custom date"
echo ""

print_info "TEST 5: Edge Cases"
echo "---------------------------------------"
echo "• Try with expired account"
echo "• Try with account with no expiry date"
echo "• Try changing term and see preview update"
echo "• Try unchecking and re-checking checkbox"
echo ""

#####################################################
# DEPLOYMENT COMPLETE
#####################################################

echo ""
echo "======================================================"
echo "  ✅ STAGING DEPLOYMENT COMPLETE!"
echo "======================================================"
echo ""

print_success "Transaction expiry update deployed to staging!"
echo ""

print_info "IMPORTANT NOTES:"
echo ""
echo "📚 Documentation: TRANSACTION_EXPIRY_UPDATE.md"
echo ""
echo "🔧 NO database migrations required"
echo "   (Uses existing next_renewal_date and subscription_end_date fields)"
echo ""
echo "🎯 Key Features:"
echo "   • Manual control over expiry updates"
echo "   • 3 calculation methods"
echo "   • Live preview before confirmation"
echo "   • Atomic transaction + account update"
echo ""
echo "🧪 Test extensively before production:"
echo "   • All 4 calculation methods"
echo "   • Edge cases (expired accounts, no expiry, etc.)"
echo "   • Multiple transactions on same account"
echo "   • API response validation"
echo ""

if [ ! -z "$STAGING_FRONTEND_URL" ]; then
    print_info "👉 Start testing: $STAGING_FRONTEND_URL"
fi

echo ""
print_success "Deployment completed at: $(date)"
echo ""
