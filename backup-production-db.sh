#!/bin/bash

# Production Database Backup Script
# This script creates a backup of the production PostgreSQL database before migration

echo "🔐 Production Database Backup Script"
echo "===================================="
echo ""

# Note: Production database credentials are stored in Render environment
# You'll need to get them from Render dashboard or use Render CLI

# Option 1: Using Render Backup System (RECOMMENDED)
echo "✅ Option 1: Using Render Backup System (RECOMMENDED)"
echo "   - Go to: https://dashboard.render.com"
echo "   - Select: uppalcrm-database (production)"
echo "   - Click: 'Backups' tab"
echo "   - Click: 'Create Manual Backup'"
echo "   - Wait for backup to complete (10-20 minutes)"
echo ""

# Option 2: Using pg_dump via Render CLI
echo "✅ Option 2: Using pg_dump via Render CLI"
echo ""
echo "If you have Render CLI installed:"
echo "   render backup create --service uppalcrm-database-prod"
echo ""

# Option 3: Using pg_dump directly (if you have credentials)
echo "✅ Option 3: Using pg_dump directly (requires production credentials)"
echo ""
echo "export PROD_DB_HOST=<production-db-host>"
echo "export PROD_DB_PORT=5432"
echo "export PROD_DB_NAME=<production-db-name>"
echo "export PROD_DB_USER=<production-db-user>"
echo "export PROD_DB_PASSWORD=<production-db-password>"
echo ""
echo "PGPASSWORD=\$PROD_DB_PASSWORD pg_dump -h \$PROD_DB_HOST -p \$PROD_DB_PORT -U \$PROD_DB_USER \$PROD_DB_NAME | gzip > production_backup_\$(date +%Y%m%d_%H%M%S).sql.gz"
echo ""

echo "===================================="
echo ""
echo "⚠️ DO NOT PROCEED WITH DEPLOYMENT UNTIL BACKUP IS CONFIRMED!"
echo ""
echo "Steps:"
echo "1. Create backup using one of the options above"
echo "2. Verify backup was created successfully"
echo "3. Confirm backup size is reasonable (>100MB expected)"
echo "4. Then run: ./deploy-to-production.sh"
