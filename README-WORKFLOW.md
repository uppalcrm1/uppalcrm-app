# Development Workflow Documentation - Quick Start

This directory now contains comprehensive documentation for safe development and deployment practices.

## 📚 Documentation Files Created

### 1. **DEVELOPMENT_WORKFLOW.md** (Main Guide)
Comprehensive guide covering:
- Complete development workflow (local → staging → production)
- Emergency hotfix procedures
- Database migration processes
- Rollback procedures
- Risk assessment guidelines
- Best practices and critical rules

**When to use:** Reference this for detailed guidance on any deployment scenario

### 2. **QUICK_REFERENCE.md** (Cheat Sheet)
One-page quick reference with:
- Common git commands for deployment
- Monitoring time guidelines
- Critical rules reminder
- Quick links to all environments

**When to use:** Keep this open while developing for quick command reference

### 3. **DEPLOYMENT_LOG.md** (History Tracker)
Template and log for tracking:
- All production deployments
- Deployment results
- Issues encountered
- Rollback actions taken

**When to use:** Update after every production deployment

## 🛠️ Helper Scripts Created

### 1. **scripts/pre-deploy-check.sh**
Interactive checklist that runs before deploying to production
```bash
./scripts/pre-deploy-check.sh
```

### 2. **scripts/health-check.sh**
System health verification for staging or production
```bash
# Check staging
./scripts/health-check.sh staging

# Check production
./scripts/health-check.sh production
```

## 🚀 Quick Start

### For a New Feature:
1. Review `QUICK_REFERENCE.md` for commands
2. Follow the workflow:
   - Create feature branch
   - Develop & test locally
   - Deploy to staging
   - Monitor (check QUICK_REFERENCE for how long)
   - Deploy to production
   - Run health check
   - Update deployment log

### For an Emergency Hotfix:
1. Check `DEVELOPMENT_WORKFLOW.md` → "Emergency Hotfix Process"
2. **Still deploy to staging first** (minimum 30 minutes testing)
3. Use `pre-deploy-check.sh` before production
4. Deploy to production
5. Run `health-check.sh production`
6. Monitor closely

### For Database Changes:
1. Check `DEVELOPMENT_WORKFLOW.md` → "Database Migration Process"
2. **Always test locally first**
3. Deploy to staging and monitor 24-48 hours
4. Create production backup
5. Use `pre-deploy-check.sh`
6. Deploy during low-traffic window
7. Monitor production for 24 hours

## 📋 Your Current Environments

| Environment | Branch | URLs |
|-------------|--------|------|
| **Local** | feature/* | localhost:3004, localhost:3001 |
| **Staging** | staging | uppalcrm-api-staging.onrender.com, uppalcrm-frontend-staging.onrender.com |
| **Production** | main | uppalcrm-api.onrender.com, uppalcrm-frontend.onrender.com |

## 🚨 Golden Rules

1. **NEVER skip staging** - Even for small changes
2. **NEVER commit directly to main or staging** - Always use feature branches
3. **ALWAYS backup before database changes** - Production data is precious
4. **ALWAYS monitor after deployment** - Catch issues early
5. **WHEN IN DOUBT, ASK** - Better safe than sorry with active clients

## 🔗 Related Existing Documentation

These files complement your existing documentation:
- `DEPLOYMENT.md` - General deployment guide
- `DEPLOYMENT_GUIDE.md` - Detailed deployment procedures
- `DEPLOYMENT-CHECKLIST.md` - Render deployment checklist
- `render.yaml` - Render environment configuration

## 💡 Tips

- Keep `QUICK_REFERENCE.md` open while working
- Run `pre-deploy-check.sh` before every production deployment
- Run `health-check.sh production` immediately after deploying
- Update `DEPLOYMENT_LOG.md` after each deployment
- Review `DEVELOPMENT_WORKFLOW.md` when handling new scenarios

## 🆘 Need Help?

1. Check `QUICK_REFERENCE.md` first
2. Look up the specific scenario in `DEVELOPMENT_WORKFLOW.md`
3. Review past deployments in `DEPLOYMENT_LOG.md`
4. Check Render dashboard logs
5. Consider asking your team

---

**Remember:** Taking time to follow the process protects your active clients and saves time in the long run!
