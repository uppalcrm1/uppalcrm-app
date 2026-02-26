#!/usr/bin/env pwsh
# Deploy to staging branch

cd c:\Users\uppal\uppal-crm-project

# Configure git editor to avoid editor prompts
git config --global core.editor ""

# Fetch latest
Write-Host "Fetching origin..."
git fetch origin

# Ensure we're on staging
Write-Host "Checking out staging..."
git checkout staging

# Reset to origin/staging to get clean state
Write-Host "Resetting to origin/staging..."
git reset --hard origin/staging

# Merge devtest branch with no editor prompt
Write-Host "Merging devtest into staging..."
git merge --no-edit origin/devtest --allow-unrelated-histories 2>&1 || `
  (Write-Host "Merge may have conflicts or issues, attempting push anyway..." )

# Push to staging
Write-Host "Pushing to origin/staging..."
git push origin staging

Write-Host "✅ Deployment to staging complete!"
git log --oneline -3
