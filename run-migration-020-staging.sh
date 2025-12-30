#!/bin/bash
# Deploy migration 020 to staging environment
# Load environment variables from .env file
set -a
source .env
set +a

# Run the migration for staging
node deploy-fix-contact-constraints.js staging
