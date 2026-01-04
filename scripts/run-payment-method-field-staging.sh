#!/bin/bash

echo "🚀 Running payment method field deployment on STAGING database..."
echo ""

# Load staging environment variables
if [ -f .env.staging ]; then
  export $(cat .env.staging | grep -v '^#' | xargs)
  echo "✅ Loaded .env.staging"
else
  echo "⚠️  .env.staging not found, using .env"
  export $(cat .env | grep -v '^#' | xargs)
fi

# Run the deployment script
node scripts/deploy-payment-method-field-all-orgs.js

echo ""
echo "✅ Staging deployment complete"
