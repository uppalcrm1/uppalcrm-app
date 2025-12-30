#!/bin/bash
# Load environment variables from .env file
set -a
source .env
set +a

# Run the migration
node deploy-fix-accounts-cascade.js production
