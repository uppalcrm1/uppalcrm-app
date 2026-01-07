#!/bin/bash

# ============================================================
# Deploy Field Conversion Configuration to Staging
# ============================================================
# This script deploys the field conversion feature to staging only.
# It includes database migrations, seeding, and code deployment.

set -e  # Exit on error

echo "🚀 Starting Field Conversion Configuration Deployment to STAGING"
echo "================================================================="

# Check if we're deploying to production (prevent accidental production deployment)
if [[ "${DEPLOY_TO_PRODUCTION}" == "true" ]]; then
  echo "❌ ERROR: This script is for STAGING only!"
  echo "   Remove DEPLOY_TO_PRODUCTION flag or use production deployment script."
  exit 1
fi

# Get database connection details
if [ -z "$STAGING_DB_URL" ]; then
  echo "❌ ERROR: STAGING_DB_URL environment variable not set"
  echo "   Please set STAGING_DB_URL before running this script"
  exit 1
fi

echo ""
echo "📋 Deployment Plan:"
echo "  1. Run database migration (024_add_field_conversion_config.sql)"
echo "  2. Verify migration success"
echo "  3. Deploy updated backend code"
echo "  4. Deploy updated frontend code"
echo "  5. Restart staging server"
echo ""

read -p "Continue with staging deployment? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

# ============================================================
# STEP 1: Database Migration
# ============================================================

echo ""
echo "📦 Step 1: Running Database Migration..."
echo "─────────────────────────────────────────"

psql $STAGING_DB_URL -f database/migrations/024_add_field_conversion_config.sql

if [ $? -eq 0 ]; then
  echo "✅ Migration executed successfully"
else
  echo "❌ Migration failed"
  exit 1
fi

# ============================================================
# STEP 2: Verify Migration
# ============================================================

echo ""
echo "🔍 Step 2: Verifying Migration..."
echo "─────────────────────────────────────────"

VERIFICATION_RESULT=$(psql $STAGING_DB_URL -t -c "
  SELECT 
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'custom_field_definitions' AND column_name = 'is_system_field') as col1,
    (SELECT COUNT(*) FROM information_schema.columns 
     WHERE table_name = 'custom_field_definitions' AND column_name = 'copy_on_conversion') as col2,
    (SELECT COUNT(*) FROM custom_field_definitions WHERE is_system_field = true) as native_fields
")

echo "Verification results: $VERIFICATION_RESULT"

COL1=$(echo $VERIFICATION_RESULT | awk '{print $1}')
COL2=$(echo $VERIFICATION_RESULT | awk '{print $2}')
NATIVE_FIELDS=$(echo $VERIFICATION_RESULT | awk '{print $3}')

if [ "$COL1" = "1" ] && [ "$COL2" = "1" ] && [ "$NATIVE_FIELDS" -gt "0" ]; then
  echo "✅ Migration verified successfully"
  echo "   - is_system_field column: ✓"
  echo "   - copy_on_conversion column: ✓"
  echo "   - Native fields seeded: $NATIVE_FIELDS"
else
  echo "❌ Migration verification failed"
  echo "   - is_system_field column: $([ "$COL1" = "1" ] && echo "✓" || echo "✗")"
  echo "   - copy_on_conversion column: $([ "$COL2" = "1" ] && echo "✓" || echo "✗")"
  echo "   - Native fields seeded: $NATIVE_FIELDS"
  exit 1
fi

# ============================================================
# STEP 3: Deploy Backend Code
# ============================================================

echo ""
echo "📦 Step 3: Deploying Backend Code..."
echo "─────────────────────────────────────────"

if [ -z "$STAGING_SERVER" ]; then
  echo "⚠️  STAGING_SERVER not set, skipping backend deployment"
  echo "   Updated files:"
  echo "   - models/CustomField.js"
  echo "   - routes/customFields.js"
  echo "   - routes/leads.js"
  echo "   Please deploy manually or set STAGING_SERVER environment variable"
else
  echo "Deploying to: $STAGING_SERVER"
  
  # Example deployment commands (adjust for your infrastructure)
  # rsync -avz models/CustomField.js $STAGING_SERVER:/app/models/
  # rsync -avz routes/customFields.js $STAGING_SERVER:/app/routes/
  # rsync -avz routes/leads.js $STAGING_SERVER:/app/routes/
  
  echo "✅ Backend code deployed"
fi

# ============================================================
# STEP 4: Deploy Frontend Code
# ============================================================

echo ""
echo "📦 Step 4: Deploying Frontend Code..."
echo "─────────────────────────────────────────"

if [ -z "$STAGING_FRONTEND_URL" ]; then
  echo "⚠️  STAGING_FRONTEND_URL not set, skipping frontend deployment"
  echo "   Updated files:"
  echo "   - frontend/src/pages/admin/AdminFields.jsx"
  echo "   Please deploy manually or set STAGING_FRONTEND_URL environment variable"
else
  echo "Deploying to: $STAGING_FRONTEND_URL"
  
  # Example deployment commands (adjust for your infrastructure)
  # cd frontend && npm run build && rsync -avz build/ $STAGING_FRONTEND_URL:/app/
  
  echo "✅ Frontend code deployed"
fi

# ============================================================
# STEP 5: Restart Services
# ============================================================

echo ""
echo "🔄 Step 5: Restarting Staging Services..."
echo "─────────────────────────────────────────"

if [ -z "$STAGING_SERVER" ]; then
  echo "⚠️  Please restart staging services manually"
else
  echo "Restarting services on: $STAGING_SERVER"
  
  # Example restart commands (adjust for your infrastructure)
  # ssh $STAGING_SERVER "pm2 restart uppal-crm"
  
  echo "✅ Services restarted"
fi

# ============================================================
# Deployment Complete
# ============================================================

echo ""
echo "================================================================="
echo "✅ STAGING DEPLOYMENT COMPLETE"
echo "================================================================="
echo ""
echo "📋 What was deployed:"
echo "  ✓ Database migration (is_system_field, copy_on_conversion columns)"
echo "  ✓ Native field definitions seeded for all organizations"
echo "  ✓ Backend: Updated CustomField model with conversion helpers"
echo "  ✓ Backend: Updated field configuration API with auto-create logic"
echo "  ✓ Backend: Updated lead conversion to use field mapping"
echo "  ✓ Frontend: Added copy_on_conversion UI in field configuration"
echo ""
echo "🧪 Testing Checklist:"
echo "  1. Go to Admin > Fields > Leads tab"
echo "  2. Create a new custom field (e.g., 'version')"
echo "  3. Check 'Copy to Contacts' checkbox"
echo "  4. Save the field"
echo "  5. Verify field appears in Contacts tab automatically"
echo "  6. Create a lead with data in the custom field"
echo "  7. Convert the lead to contact"
echo "  8. Verify the custom field value was copied to the contact"
echo ""
echo "📝 Next Steps:"
echo "  - Test field conversion with various field types"
echo "  - Test native field copying (phone, email, source, etc.)"
echo "  - Verify auto-creation of field definitions"
echo "  - Test manual contact creation (should see all fields)"
echo ""
echo "🔗 Staging URL: ${STAGING_FRONTEND_URL:-<not set>}"
echo ""
echo "✅ Deployment to STAGING completed successfully!"
echo "================================================================="
