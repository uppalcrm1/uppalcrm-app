# Development Workflow - Quick Reference

## 🚀 Standard Feature Development

```bash
# 1. Create feature branch
git checkout main && git pull
git checkout -b feature/my-feature

# 2. Develop & test locally
# ... make changes ...
git add . && git commit -m "Description"

# 3. Deploy to STAGING
git checkout staging && git pull
git merge feature/my-feature
git push origin staging
# ⏰ Wait & test based on risk level

# 4. Deploy to PRODUCTION (after staging success)
git checkout main && git pull
git merge staging
git push origin main
# ✅ Monitor production
```

---

## ⏱️ Monitoring Times

| Change Type | Staging | Production |
|-------------|---------|------------|
| 🔴 Database | 24-48h | 24h close watch |
| 🟡 Features | 4-24h | 4-8h |
| 🟡 Bug Fixes | 2-4h | 2-4h |
| 🟢 UI Only | 1-2h | 1-2h |

---

## 🔥 Emergency Hotfix

```bash
# Still deploy to staging first!
git checkout main && git pull
git checkout -b hotfix/critical-fix

# ... fix bug ...

git checkout staging && git pull
git merge hotfix/critical-fix
git push origin staging
# ⏰ Test 30-60 min minimum

git checkout main && git pull
git merge hotfix/critical-fix
git push origin main
```

---

## 🗄️ Database Changes

```bash
# 1. Test locally
psql < migration.sql

# 2. Deploy to staging
node scripts/migrate.js staging
# ⏰ Monitor 24-48 hours

# 3. Backup production
# Create backup in database admin panel

# 4. Deploy to production
node scripts/production-migrate.js
# ✅ Monitor 24 hours closely
```

---

## ↩️ Rollback

```bash
# Code only (no DB changes)
git revert <bad-commit>
git push origin main

# With database
git revert <bad-commit>
git push origin main
node scripts/rollback-migration.js <number>
```

---

## 🚨 Critical Rules

1. ❌ NEVER commit to main/staging directly
2. ❌ NEVER skip staging
3. ❌ NEVER force push to main/staging
4. ✅ ALWAYS test locally first
5. ✅ ALWAYS backup before DB changes
6. ✅ ALWAYS document deployments

---

## 🔗 Quick Links

- Staging Backend: https://uppalcrm-api-staging.onrender.com
- Staging Frontend: https://uppalcrm-frontend-staging.onrender.com
- Production Backend: https://uppalcrm-api.onrender.com
- Production Frontend: https://uppalcrm-frontend.onrender.com
- Render Dashboard: https://dashboard.render.com

---

## 📋 Pre-Deploy Checklist

- [ ] Tested locally
- [ ] Tested on staging
- [ ] Monitoring period complete
- [ ] Team notified (if major)
- [ ] Backup created (if DB change)
- [ ] Rollback plan ready

---

## 📖 Full Documentation

See `DEVELOPMENT_WORKFLOW.md` for complete details
