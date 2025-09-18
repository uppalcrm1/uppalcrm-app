# UppalCRM Deployment Guide

## Overview
This project uses a **staging → production** deployment strategy to ensure safe releases.

## Environment Structure

| Environment | Branch | Backend URL | Frontend URL | Database |
|-------------|--------|-------------|--------------|----------|
| **Local** | any | localhost:3004 | localhost:3001 | Local DB |
| **Staging** | `staging` | uppalcrm-api-staging.onrender.com | uppalcrm-frontend-staging.onrender.com | Staging DB |
| **Production** | `main` | uppalcrm-api.onrender.com | uppalcrm-frontend.onrender.com | Production DB |

## Deployment Process

### 1. Develop Locally
```bash
# Work on your feature branch
git checkout -b feature/new-feature
# Make your changes...
git add .
git commit -m "Add new feature"
```

### 2. Deploy to Staging
```bash
# Deploy to staging for testing
./scripts/deploy.sh staging

# Or manually:
git checkout main
git pull origin main
git checkout staging || git checkout -b staging
git merge main
git push origin staging
```

### 3. Test on Staging
- Visit https://uppalcrm-frontend-staging.onrender.com
- Test all functionality thoroughly
- Verify no breaking changes

### 4. Deploy to Production
```bash
# Only after staging tests pass
./scripts/deploy.sh production

# Or manually:
git checkout main
git merge staging
git push origin main
```

## Quick Commands

```bash
# Make script executable (first time only)
chmod +x scripts/deploy.sh

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production
./scripts/deploy.sh production
```

## Environment Variables

### Staging Environment
- `NODE_ENV=staging`
- `VITE_API_URL=https://uppalcrm-api-staging.onrender.com/api`
- Separate database from production

### Production Environment
- `NODE_ENV=production`
- `VITE_API_URL=https://uppalcrm-api.onrender.com/api`
- Production database

## Safety Features

1. **Staging First**: All changes must go through staging
2. **Confirmation Prompt**: Production deployment requires confirmation
3. **Branch Protection**: Production deploys only from main branch
4. **Rollback**: Easy to revert by deploying previous commit

## Rollback Process

If production has issues:

```bash
# Find the last good commit
git log --oneline -10

# Reset to last good commit
git reset --hard <good-commit-hash>
git push origin main --force-with-lease

# Or deploy specific commit
git checkout <good-commit-hash>
git checkout -b hotfix
git push origin hotfix
# Then deploy hotfix branch
```

## Database Migrations

For database changes:
1. Test migration on staging first
2. Backup production database before deploying
3. Monitor logs during deployment

## Monitoring

- **Staging**: Monitor render dashboard during testing
- **Production**: Check logs after deployment
- **Health Checks**: Both environments have `/health` endpoints