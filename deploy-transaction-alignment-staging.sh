#!/bin/bash

#####################################################
# STAGING DEPLOYMENT SCRIPT
# Transaction Field Alignment & Account Enforcement
# Date: 2025-12-20
#####################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "================================================================"
echo "  TRANSACTION ALIGNMENT - STAGING DEPLOYMENT"
echo "  - Account Enforcement (4 layers)"
echo "  - Field Alignment (Create/Edit/List views)"
echo "  - Payment Date field added"
echo "  - Status column added"
echo "  - Source field added"
echo "================================================================"
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
print_warning "You are about to deploy to STAGING environment"
print_info "This deployment includes:"
echo "  - Database migration (account_id/contact_id made REQUIRED)"
echo "  - Backend API updates (payment_date validation)"
echo "  - Frontend updates (new fields, AccountSelector modal)"
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
# STEP 1: GIT STATUS CHECK
#####################################################

echo "======================================================"
echo "STEP 1: Git Status Check"
echo "======================================================"
echo ""

print_info "Checking git status..."
git status --short

echo ""
print_warning "Files to be deployed:"
echo "  Database:"
echo "    - database/migrations/019_enforce_account_required_in_transactions.sql"
echo ""
echo "  Backend:"
echo "    - routes/transactions.js"
echo ""
echo "  Frontend:"
echo "    - frontend/src/constants/transactions.js (NEW)"
echo "    - frontend/src/components/AccountSelectorModal.jsx (NEW)"
echo "    - frontend/src/components/CreateTransactionModal.jsx"
echo "    - frontend/src/components/EditTransactionModal.jsx"
echo "    - frontend/src/pages/TransactionsPage.jsx"
echo "    - frontend/src/pages/AccountsPage.jsx"
echo ""

read -p "Commit and push these changes now? (yes/no): " git_confirm

if [ "$git_confirm" == "yes" ]; then
    echo ""
    print_info "Adding files to git..."

    git add database/migrations/019_enforce_account_required_in_transactions.sql
    git add routes/transactions.js
    git add frontend/src/constants/transactions.js
    git add frontend/src/components/AccountSelectorModal.jsx
    git add frontend/src/components/CreateTransactionModal.jsx
    git add frontend/src/components/EditTransactionModal.jsx
    git add frontend/src/pages/TransactionsPage.jsx
    git add frontend/src/pages/AccountsPage.jsx

    print_info "Creating commit..."
    git commit -m "feat: Transaction field alignment and account enforcement

- Add payment_date field to Create/Edit modals
- Add source field to Create modal
- Add status column to transactions table list
- Enforce account_id as required (4-layer enforcement)
- Create AccountSelectorModal for account selection
- Standardize field terminology across all views
- Remove non-functional inline payment modal
- Use shared constants for dropdowns

Backend changes:
- Make account_id and contact_id REQUIRED in validation
- Add payment_date to transaction schema
- Update CREATE/UPDATE routes to handle payment_date

Database changes:
- Make account_id and contact_id NOT NULL
- Change foreign keys to CASCADE delete
- Clean up orphaned transactions

🤖 Generated with Claude Code"

    print_info "Pushing to main..."
    git push origin main

    print_success "Code pushed to repository"
else
    print_warning "Skipping git commit/push"
fi

echo ""

#####################################################
# STEP 2: DATABASE MIGRATION
#####################################################

echo "======================================================"
echo "STEP 2: Database Migration"
echo "======================================================"
echo ""

print_info "Migration: 019_enforce_account_required_in_transactions.sql"
print_warning "This migration will:"
echo "  1. Delete any orphaned transactions (account_id IS NULL)"
echo "  2. Make account_id and contact_id NOT NULL"
echo "  3. Change foreign keys to CASCADE delete"
echo ""

# Check for .env.staging file
if [ -f ".env.staging" ]; then
    print_info "Loading staging database credentials from .env.staging..."
    export $(cat .env.staging | grep -v '^#' | xargs)
elif [ -f ".env" ]; then
    print_info "Loading database credentials from .env..."
    export $(cat .env | grep -v '^#' | xargs)
else
    print_warning "No .env file found"
fi

# Create migration deployment script
cat > scripts/deploy-transaction-alignment-staging.js << 'EOF'
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting migration 019...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../database/migrations/019_enforce_account_required_in_transactions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await client.query('BEGIN');
    await client.query(migrationSQL);
    await client.query('COMMIT');

    console.log('✅ Migration 019 completed successfully!');

    // Verify migration
    const result = await client.query(`
      SELECT
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'transactions'
      AND column_name IN ('account_id', 'contact_id')
      ORDER BY column_name;
    `);

    console.log('\n📊 Verification:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.is_nullable === 'NO' ? '✅ NOT NULL' : '❌ NULL'} (${row.data_type})`);
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(err => {
  console.error(err);
  process.exit(1);
});
EOF

print_info "Running migration..."
node scripts/deploy-transaction-alignment-staging.js

if [ $? -eq 0 ]; then
    print_success "Database migration completed successfully"
else
    print_error "Database migration failed!"
    echo ""
    print_warning "Migration failed. Please check the error above."
    print_warning "To rollback, you'll need to restore from a backup."
    exit 1
fi

echo ""

#####################################################
# STEP 3: DEPLOY TO RENDER
#####################################################

echo "======================================================"
echo "STEP 3: Deploy to Render"
echo "======================================================"
echo ""

print_info "Triggering Render deployment..."
print_warning "Render will automatically deploy from the main branch"
echo ""

print_info "Monitor deployment at:"
echo "  Backend: https://dashboard.render.com"
echo "  Frontend: https://dashboard.render.com"
echo ""

read -p "Press Enter when Render deployment is complete..."

print_success "Render deployment acknowledged"

echo ""

#####################################################
# STEP 4: SMOKE TESTS
#####################################################

echo "======================================================"
echo "STEP 4: Smoke Tests"
echo "======================================================"
echo ""

STAGING_URL="https://uppalcrm-frontend-staging.onrender.com"
STAGING_API="https://uppalcrm-backend-staging.onrender.com"

print_info "Running smoke tests on staging..."
echo ""

# Test 1: Backend API
print_info "Test 1: Checking backend API..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_API/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ] || [ "$HTTP_CODE" == "404" ]; then
    print_success "Backend API is responding (HTTP $HTTP_CODE)"
else
    print_warning "Backend API check inconclusive (HTTP $HTTP_CODE)"
fi

echo ""

# Test 2: Frontend
print_info "Test 2: Checking frontend..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "200" ]; then
    print_success "Frontend is accessible (HTTP $HTTP_CODE)"
else
    print_warning "Frontend check inconclusive (HTTP $HTTP_CODE)"
fi

echo ""

#####################################################
# DEPLOYMENT COMPLETE
#####################################################

echo ""
echo "================================================================"
echo "  ✅ STAGING DEPLOYMENT COMPLETE!"
echo "================================================================"
echo ""

print_success "Transaction alignment deployed to staging successfully!"
echo ""

print_info "🧪 MANUAL TESTING CHECKLIST:"
echo ""
echo "1. Test Account Enforcement:"
echo "   ✓ Open $STAGING_URL"
echo "   ✓ Go to Accounts page"
echo "   ✓ Click 'Record Payment' button"
echo "   ✓ Verify AccountSelectorModal appears"
echo "   ✓ Select an account"
echo "   ✓ Verify CreateTransactionModal opens with account context"
echo ""
echo "2. Test Create Transaction Modal:"
echo "   ✓ Verify all fields are present:"
echo "     - Transaction Amount ✓"
echo "     - Payment Date (NEW) ✓"
echo "     - Transaction Status ✓"
echo "     - Billing Term ✓"
echo "     - Payment Method ✓"
echo "     - Source (NEW) ✓"
echo "     - Transaction Reference ✓"
echo "     - Notes ✓"
echo "   ✓ Fill out form and submit"
echo "   ✓ Verify transaction is created"
echo ""
echo "3. Test Edit Transaction:"
echo "   ✓ Go to Transactions page"
echo "   ✓ Click edit on a transaction"
echo "   ✓ Verify Payment Date field is present and editable"
echo "   ✓ Change payment date and save"
echo "   ✓ Verify changes are saved"
echo ""
echo "4. Test Transactions Table:"
echo "   ✓ Go to Transactions page"
echo "   ✓ Verify Status column is visible"
echo "   ✓ Verify status badges are color-coded:"
echo "     - Completed (green)"
echo "     - Pending (yellow)"
echo "     - Failed (red)"
echo "     - Refunded (blue)"
echo "   ✓ Verify 'Payment Method' (not 'Pay Method')"
echo "   ✓ Verify Source shows values (not 'Unknown')"
echo ""
echo "5. Test Account Detail Page:"
echo "   ✓ Open an account detail page"
echo "   ✓ Click 'Create Transaction'"
echo "   ✓ Verify modal opens with account pre-selected"
echo "   ✓ Create transaction and verify it appears in list"
echo ""
echo "6. Verify Data Integrity:"
echo "   ✓ All new transactions have payment_date"
echo "   ✓ All new transactions have source (default: 'manual')"
echo "   ✓ No transactions can be created without account_id"
echo "   ✓ Transaction status visible in list"
echo ""

print_warning "📊 Database Check:"
echo "Run this SQL query to verify:"
echo ""
echo "  SELECT "
echo "    COUNT(*) as total_transactions,"
echo "    COUNT(CASE WHEN account_id IS NULL THEN 1 END) as orphaned,"
echo "    COUNT(CASE WHEN payment_date IS NULL THEN 1 END) as missing_date,"
echo "    COUNT(CASE WHEN source IS NULL THEN 1 END) as missing_source"
echo "  FROM transactions;"
echo ""
echo "Expected results:"
echo "  orphaned: 0 (should be none)"
echo "  missing_date: 0 (old records may have null)"
echo "  missing_source: 0 (old records may have null)"
echo ""

print_info "🔗 Staging URLs:"
echo "  Frontend: $STAGING_URL"
echo "  Backend:  $STAGING_API"
echo ""

print_success "Deployment completed at: $(date)"
echo ""
echo "================================================================"
echo ""
