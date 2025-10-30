# Push Multi-Tenant AI Configuration to GitHub

Your code is **committed locally** but needs to be pushed to GitHub.

## ✅ What's Already Done

- Database migration completed on Render PostgreSQL (3 organizations configured)
- All features verified and working
- Code committed locally: **commit 52eae52**

## ⏳ What You Need to Do

### Option 1: Use GitHub Desktop (EASIEST)

1. Open **GitHub Desktop** (installed at: `C:\Users\uppal\AppData\Local\GitHubDesktop`)
2. Select repository: `uppal-crm-project`
3. You should see: **1 commit ready to push** (52eae52)
4. Click **"Push origin"** button
5. After push completes, push to other branches:
   - In GitHub Desktop, go to **Branch → New Branch**
   - Or use the terminal steps below

### Option 2: Use Command Line with New Token

#### Step 1: Create New GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Give it a name: `uppal-crm-deployment-2025`
4. Select scopes:
   - ✅ `repo` (Full control of private repositories)
5. Click **"Generate token"**
6. **COPY THE TOKEN** (you'll only see it once!)

#### Step 2: Update Git Remote and Push

```bash
cd C:\Users\uppal\uppal-crm-project

# Set the new token (replace YOUR_NEW_TOKEN with the token you copied)
git remote set-url origin https://uppalcrm1:YOUR_NEW_TOKEN@github.com/uppalcrm1/uppalcrm-app.git

# Push to main
git push origin main

# Push to staging (for frontend deployment)
git push origin main:staging

# Push to production
git push origin main:production
```

### Option 3: Use SSH Keys (More Secure)

If you want to set up SSH authentication (recommended for long-term):

```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "uppalcrm1@github.com"

# Copy public key
cat ~/.ssh/id_ed25519.pub

# Add to GitHub:
# 1. Go to: https://github.com/settings/ssh/new
# 2. Paste the public key
# 3. Click "Add SSH key"

# Update remote to use SSH
git remote set-url origin git@github.com:uppalcrm1/uppalcrm-app.git

# Push
git push origin main
git push origin main:staging
git push origin main:production
```

## 🔍 Verify Push Succeeded

After pushing, verify the commit appears on GitHub:

1. **Check GitHub**: https://github.com/uppalcrm1/uppalcrm-app/commits/main
   - You should see: "feat: Add multi-tenant AI configuration..."
   - Commit hash: `52eae52`

2. **Check Render Auto-Deploy**:
   - Backend: https://dashboard.render.com/
   - Should show new deployment in progress
   - Look for: "feat: Add multi-tenant AI configuration..."

3. **Test API Endpoints** (after Render deploys):
   ```bash
   # Get AI settings
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://uppalcrm-api.onrender.com/api/organizations/current/ai-settings

   # Should return: {"success": true, "settings": {...}}
   ```

## 📊 What Gets Deployed

After you push, Render will automatically deploy:

### Files Being Deployed:
- ✅ `database/migrations/007_organization_ai_settings.sql` (already run manually)
- ✅ `routes/ai-settings.js` (5 new API endpoints)
- ✅ `services/sentimentAnalysis.js` (multi-tenant sentiment analysis)
- ✅ `server.js` (registers AI settings routes)
- ✅ Documentation files

### Database:
- ✅ Already deployed and verified
- ✅ 3 organizations configured
- ✅ All triggers and functions working

### API Endpoints Now Available:
```
GET    /api/organizations/current/ai-settings
PUT    /api/organizations/current/ai-settings
POST   /api/organizations/current/ai-settings/test
GET    /api/organizations/current/ai-settings/usage
POST   /api/organizations/current/ai-settings/reset-defaults
```

## ❓ Need Help?

**Issue**: "Invalid username or token"
- **Solution**: Your GitHub token expired. Follow Option 2 above to create a new one.

**Issue**: GitHub Desktop not showing commit
- **Solution**: Make sure you're in the correct repository: `uppal-crm-project`

**Issue**: Push rejected / conflicts
- **Solution**:
  ```bash
  git pull origin main --rebase
  git push origin main
  ```

## 🎯 Next Steps After Push

1. **Wait for Render to deploy** (~3-5 minutes)
2. **Test API endpoints** (see commands above)
3. **Build frontend AI settings page**
4. **Configure notification channels** for each organization

---

**Current Status**: Code is committed locally, waiting for push to GitHub.

**Commit**: 52eae52 - feat: Add multi-tenant AI configuration for sentiment analysis
