#!/bin/bash
# Deploy migration 020 to fix leads.linked_contact_id constraint
# Load environment variables from .env file
set -a
source .env
set +a

# Run the migration
node deploy-fix-contact-constraints.js production
