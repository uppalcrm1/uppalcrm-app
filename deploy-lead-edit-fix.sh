#!/bin/bash

#####################################################
# LEAD EDIT FIX DEPLOYMENT - STAGING
# Fix: Retain custom field values when editing leads
# Date: 2025-12-26
#####################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "======================================================"
echo "  LEAD EDIT FIX - STAGING DEPLOYMENT"
echo "======================================================"
echo ""

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

echo ""
print_info "Changes to deploy:"
echo "  - frontend/src/components/DynamicLeadForm.jsx"
echo ""

print_info "This fix ensures custom field values (Source Site, Device Type, App)"
print_info "are properly retained when editing leads."
echo ""

#####################################################
# STEP 1: COMMIT CHANGES
#####################################################

echo "======================================================"
echo "STEP 1: Commit Changes"
echo "======================================================"
echo ""

print_info "Adding changes to git..."
git add frontend/src/components/DynamicLeadForm.jsx

print_info "Creating commit..."
git commit -m "$(cat <<'EOF'
fix: Lead edit modal now retains custom field values

Fixed issue where editing a lead did not populate custom field dropdowns
(Source Site, Device Type, App) with their existing values. Users now see
what was already selected when editing.

Changes:
- Enhanced useEffect to properly extract and map custom_fields from leadData
- Improved loadFormConfig to preserve custom fields structure
- Added console logging for debugging data flow
- Custom field dropdowns now show correct selected values

Similar fix to transaction edit modal (commit 54fb434)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

print_success "Changes committed"
echo ""

#####################################################
# STEP 2: PUSH TO STAGING
#####################################################

echo "======================================================"
echo "STEP 2: Push to Repository"
echo "======================================================"
echo ""

print_info "Current branch: $(git branch --show-current)"
echo ""

print_warning "Pushing to remote repository..."
git push

if [ $? -eq 0 ]; then
    print_success "Changes pushed successfully"
else
    echo ""
    print_warning "If this is the first push, you may need to set upstream:"
    echo "  git push --set-upstream origin $(git branch --show-current)"
    exit 1
fi

echo ""

#####################################################
# STEP 3: VERIFY DEPLOYMENT
#####################################################

echo "======================================================"
echo "STEP 3: Auto-Deployment Status"
echo "======================================================"
echo ""

print_info "If using Render.com or similar platform:"
echo "  - Auto-deployment should trigger within 1-2 minutes"
echo "  - Check your Render dashboard for build status"
echo "  - Build typically takes 3-5 minutes"
echo ""

print_info "Frontend will be automatically rebuilt and deployed"
echo ""

#####################################################
# DEPLOYMENT COMPLETE
#####################################################

echo ""
echo "======================================================"
echo "  ✅ DEPLOYMENT INITIATED!"
echo "======================================================"
echo ""

print_success "Lead edit fix pushed to repository"
echo ""

print_info "NEXT STEPS:"
echo ""
echo "1. Monitor deployment:"
echo "   - Check Render dashboard for build status"
echo "   - Wait for deployment to complete (3-5 minutes)"
echo ""
echo "2. Test the fix:"
echo "   - Go to staging environment"
echo "   - Edit a lead that has custom fields populated"
echo "   - Verify dropdown values show correctly:"
echo "     • Source Site should show '4K Max.CA' (not placeholder)"
echo "     • Device Type should show 'Smart TV' (not placeholder)"
echo "     • App should show 'Smart STB' (not placeholder)"
echo ""
echo "3. Check browser console:"
echo "   - Open DevTools console"
echo "   - Look for debug logs:"
echo "     📝 DynamicLeadForm - Received leadData"
echo "     📋 Custom fields from leadData"
echo "     ✅ Mapped custom fields"
echo ""
echo "4. If issues occur:"
echo "   - Check console for errors"
echo "   - Verify leadData contains custom_fields"
echo "   - Check network tab for API response"
echo ""

print_warning "Frontend deployment time: ~3-5 minutes"
print_success "Deployment completed at: $(date)"
echo ""
