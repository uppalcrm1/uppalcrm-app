#!/bin/bash

# Health Check Script for UppalCRM
# Run this after deployments to verify system health

echo ""
echo "🏥 UppalCRM Health Check"
echo "========================"
echo ""

# Check which environment to test
if [ "$1" = "staging" ]; then
    BACKEND_URL="https://uppalcrm-api-staging.onrender.com"
    FRONTEND_URL="https://uppalcrm-frontend-staging.onrender.com"
    ENV_NAME="STAGING"
elif [ "$1" = "production" ]; then
    BACKEND_URL="https://uppalcrm-api.onrender.com"
    FRONTEND_URL="https://uppalcrm-frontend.onrender.com"
    ENV_NAME="PRODUCTION"
else
    echo "Usage: ./health-check.sh [staging|production]"
    echo "Example: ./health-check.sh production"
    exit 1
fi

echo "Environment: $ENV_NAME"
echo ""

# Backend Health Check
echo "Checking backend health..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/health")
BACKEND_RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BACKEND_URL/health")

if [ "$BACKEND_STATUS" = "200" ]; then
    echo "  ✅ Backend is healthy (HTTP $BACKEND_STATUS)"
    echo "  ⏱️  Response time: ${BACKEND_RESPONSE_TIME}s"
else
    echo "  ❌ Backend health check failed (HTTP $BACKEND_STATUS)"
    echo "  ⚠️  Check Render logs immediately!"
fi

echo ""

# Frontend Health Check
echo "Checking frontend..."
FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL")
FRONTEND_RESPONSE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$FRONTEND_URL")

if [ "$FRONTEND_STATUS" = "200" ]; then
    echo "  ✅ Frontend is accessible (HTTP $FRONTEND_STATUS)"
    echo "  ⏱️  Response time: ${FRONTEND_RESPONSE_TIME}s"
else
    echo "  ❌ Frontend check failed (HTTP $FRONTEND_STATUS)"
    echo "  ⚠️  Check Render logs immediately!"
fi

echo ""

# API Endpoint Checks
echo "Checking API endpoints..."

# Check API root
API_ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api")
if [ "$API_ROOT_STATUS" = "200" ]; then
    echo "  ✅ API root accessible (HTTP $API_ROOT_STATUS)"
else
    echo "  ❌ API root failed (HTTP $API_ROOT_STATUS)"
fi

echo ""

# Summary
echo "========================"
echo "Summary:"
echo ""

if [ "$BACKEND_STATUS" = "200" ] && [ "$FRONTEND_STATUS" = "200" ]; then
    echo "✅ All systems operational!"
    echo ""
    echo "Next steps:"
    echo "1. Test key functionality manually"
    echo "2. Monitor logs for errors"
    echo "3. Watch for customer-reported issues"
    echo "4. Update DEPLOYMENT_LOG.md"
else
    echo "❌ Some systems are not healthy!"
    echo ""
    echo "Immediate actions:"
    echo "1. Check Render dashboard: https://dashboard.render.com"
    echo "2. Review application logs"
    echo "3. Consider rollback if critical"
    echo "4. Notify team"
fi

echo ""
echo "Render Dashboard: https://dashboard.render.com"
echo "Backend URL: $BACKEND_URL"
echo "Frontend URL: $FRONTEND_URL"
echo ""
