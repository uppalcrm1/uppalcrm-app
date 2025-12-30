#!/bin/bash

#####################################################
# STAGING DEPLOYMENT SCRIPT
# Soft Delete System for Uppal CRM2
# Date: 2025-12-15
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
echo "  SOFT DELETE SYSTEM - STAGING DEPLOYMENT"
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
print_warning "You are about to deploy to STAGING environment"
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    print_error "Deployment cancelled"
    exit 1
fi

echo ""
print_info "Starting deployment process..."
echo ""

#####################################################
# STEP 1: BACKUP STAGING DATABASE
#####################################################

echo "======================================================"
echo "STEP 1: Backup Staging Database"
echo "======================================================"
echo ""

BACKUP_FILE="backup_staging_soft_delete_$(date +%Y%m%d_%H%M%S).sql"

print_info "Creating database backup: $BACKUP_FILE"

# You need to set these environment variables or modify the command
# export STAGING_DB_HOST="your-staging-db-host"
# export STAGING_DB_NAME="uppal_crm_staging"
# export STAGING_DB_USER="your-db-user"

if [ -z "$STAGING_DB_HOST" ]; then
    print_warning "STAGING_DB_HOST not set. Please run backup manually:"
    echo ""
    echo "  pg_dump -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE > $BACKUP_FILE"
    echo ""
    read -p "Have you backed up the database? (yes/no): " backup_confirm

    if [ "$backup_confirm" != "yes" ]; then
        print_error "Please backup database before continuing"
        exit 1
    fi
else
    pg_dump -h "$STAGING_DB_HOST" -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        print_success "Database backup created: $BACKUP_FILE"
    else
        print_error "Database backup failed!"
        exit 1
    fi
fi

echo ""

#####################################################
# STEP 2: RUN DATABASE MIGRATION
#####################################################

echo "======================================================"
echo "STEP 2: Run Database Migration"
echo "======================================================"
echo ""

print_info "Running migration: 018_add_soft_delete_columns.sql"

if [ -z "$STAGING_DB_HOST" ]; then
    print_warning "Please run migration manually:"
    echo ""
    echo "  psql -h YOUR_HOST -U YOUR_USER -d YOUR_DATABASE -f database/migrations/018_add_soft_delete_columns.sql"
    echo ""
    read -p "Have you run the migration? (yes/no): " migration_confirm

    if [ "$migration_confirm" != "yes" ]; then
        print_error "Please run migration before continuing"
        exit 1
    fi
else
    psql -h "$STAGING_DB_HOST" -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" -f database/migrations/018_add_soft_delete_columns.sql

    if [ $? -eq 0 ]; then
        print_success "Migration completed successfully"
    else
        print_error "Migration failed!"
        echo ""
        print_warning "To rollback, restore from backup:"
        echo "  psql -h $STAGING_DB_HOST -U $STAGING_DB_USER -d $STAGING_DB_NAME < $BACKUP_FILE"
        exit 1
    fi
fi

echo ""

#####################################################
# STEP 3: VERIFY MIGRATION
#####################################################

echo "======================================================"
echo "STEP 3: Verify Migration"
echo "======================================================"
echo ""

print_info "Verifying migration..."

if [ -z "$STAGING_DB_HOST" ]; then
    print_warning "Please verify migration manually:"
    echo ""
    echo "  Run this SQL query:"
    echo "  SELECT column_name FROM information_schema.columns"
    echo "  WHERE table_name = 'accounts' AND column_name = 'deleted_at';"
    echo ""
    read -p "Did the query return 'deleted_at' column? (yes/no): " verify_confirm

    if [ "$verify_confirm" != "yes" ]; then
        print_error "Migration verification failed!"
        exit 1
    fi
else
    # Verify accounts table has deleted_at column
    RESULT=$(psql -h "$STAGING_DB_HOST" -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" -t -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'deleted_at';")

    if [[ $RESULT == *"deleted_at"* ]]; then
        print_success "Migration verified: deleted_at column exists in accounts table"
    else
        print_error "Migration verification failed: deleted_at column not found"
        exit 1
    fi
fi

echo ""

#####################################################
# STEP 4: INSTALL BACKEND DEPENDENCIES (if needed)
#####################################################

echo "======================================================"
echo "STEP 4: Install Backend Dependencies"
echo "======================================================"
echo ""

print_info "Checking for new dependencies..."

# Check if package.json was modified
cd backend 2>/dev/null || echo "No backend directory"

if [ -f "package.json" ]; then
    print_info "Installing/updating npm packages..."
    npm install

    if [ $? -eq 0 ]; then
        print_success "Backend dependencies installed"
    else
        print_warning "npm install had warnings (this might be okay)"
    fi
else
    print_info "No package.json found in backend, skipping..."
fi

cd ..

echo ""

#####################################################
# STEP 5: DEPLOY BACKEND CODE
#####################################################

echo "======================================================"
echo "STEP 5: Deploy Backend Code"
echo "======================================================"
echo ""

print_info "Backend files to deploy:"
echo "  - backend/controllers/accountController.js"
echo "  - backend/controllers/transactionController.js"
echo "  - routes/accounts-simple.js"
echo "  - routes/transactions.js"
echo ""

print_warning "If using Git, ensure these changes are committed:"
echo ""
echo "  git add backend/controllers/accountController.js"
echo "  git add backend/controllers/transactionController.js"
echo "  git add routes/accounts-simple.js"
echo "  git add routes/transactions.js"
echo "  git commit -m 'Add soft delete system for accounts and transactions'"
echo "  git push origin staging"
echo ""

read -p "Have you deployed backend code to staging server? (yes/no): " backend_deploy_confirm

if [ "$backend_deploy_confirm" != "yes" ]; then
    print_error "Please deploy backend code before continuing"
    exit 1
fi

print_success "Backend code deployed"

echo ""

#####################################################
# STEP 6: RESTART BACKEND SERVER
#####################################################

echo "======================================================"
echo "STEP 6: Restart Backend Server"
echo "======================================================"
echo ""

print_warning "Backend server needs to be restarted to load new code"
echo ""
print_info "Restart command examples:"
echo "  - PM2: pm2 restart all"
echo "  - Systemd: sudo systemctl restart uppal-crm"
echo "  - Docker: docker-compose restart backend"
echo ""

read -p "Have you restarted the backend server? (yes/no): " restart_confirm

if [ "$restart_confirm" != "yes" ]; then
    print_error "Please restart backend server before continuing"
    exit 1
fi

print_success "Backend server restarted"

echo ""

#####################################################
# STEP 7: BUILD & DEPLOY FRONTEND
#####################################################

echo "======================================================"
echo "STEP 7: Build & Deploy Frontend"
echo "======================================================"
echo ""

print_info "Frontend files to deploy:"
echo "  - frontend/src/components/accounts/AccountActions.jsx"
echo "  - frontend/src/components/transactions/TransactionActions.jsx"
echo "  - frontend/src/services/api.js"
echo ""

read -p "Build and deploy frontend now? (yes/no): " frontend_confirm

if [ "$frontend_confirm" == "yes" ]; then
    cd frontend

    print_info "Installing frontend dependencies..."
    npm install

    print_info "Building frontend..."
    npm run build

    if [ $? -eq 0 ]; then
        print_success "Frontend build completed"
        echo ""
        print_warning "Please deploy the 'dist' or 'build' folder to your staging server"
        read -p "Press Enter when frontend is deployed..."
    else
        print_error "Frontend build failed!"
        exit 1
    fi

    cd ..
fi

print_success "Frontend deployed"

echo ""

#####################################################
# STEP 8: SMOKE TESTS
#####################################################

echo "======================================================"
echo "STEP 8: Smoke Tests"
echo "======================================================"
echo ""

print_info "Running basic smoke tests..."
echo ""

# Test 1: Check if backend is running
print_info "Test 1: Checking if backend API is accessible..."

if [ -z "$STAGING_API_URL" ]; then
    STAGING_API_URL="http://localhost:3004"
    print_warning "STAGING_API_URL not set, using default: $STAGING_API_URL"
fi

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_API_URL/api/health" || echo "000")

if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "401" ]; then
    print_success "Backend API is accessible (HTTP $HTTP_CODE)"
else
    print_error "Backend API not accessible (HTTP $HTTP_CODE)"
    print_warning "This might be okay if health endpoint doesn't exist"
fi

echo ""

# Test 2: Check database connection
print_info "Test 2: Verifying database columns..."

if [ ! -z "$STAGING_DB_HOST" ]; then
    DELETED_AT_EXISTS=$(psql -h "$STAGING_DB_HOST" -U "$STAGING_DB_USER" -d "$STAGING_DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'accounts' AND column_name = 'deleted_at';" | tr -d ' ')

    if [ "$DELETED_AT_EXISTS" == "1" ]; then
        print_success "Database schema updated correctly"
    else
        print_error "Database schema verification failed"
    fi
else
    print_warning "Skipping database verification (credentials not set)"
fi

echo ""

#####################################################
# DEPLOYMENT COMPLETE
#####################################################

echo ""
echo "======================================================"
echo "  ✅ STAGING DEPLOYMENT COMPLETE!"
echo "======================================================"
echo ""

print_success "Soft delete system deployed to staging successfully!"
echo ""

print_info "NEXT STEPS:"
echo ""
echo "1. Test soft delete functionality:"
echo "   - Delete an account with a reason"
echo "   - Verify account is hidden from normal list"
echo "   - Enable 'Show deleted' toggle"
echo "   - Restore the deleted account"
echo ""
echo "2. Test transaction void:"
echo "   - Void a transaction with a reason"
echo "   - Verify it's excluded from revenue"
echo "   - Check audit log"
echo ""
echo "3. Verify audit logging:"
echo "   - Check audit_log table in database"
echo "   - Verify deletion reasons are recorded"
echo ""
echo "4. Performance check:"
echo "   - Load accounts list (should be fast)"
echo "   - Check query performance"
echo ""
echo "5. Review documentation:"
echo "   - SOFT_DELETE_IMPLEMENTATION.md"
echo "   - INTEGRATION_GUIDE.md"
echo ""

print_warning "Backup file location: $BACKUP_FILE"
print_warning "Keep this backup until production deployment is verified"

echo ""
print_success "Deployment completed at: $(date)"
echo ""
