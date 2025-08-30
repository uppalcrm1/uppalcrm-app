# UppalCRM Render Deployment Checklist

## Prerequisites ✅
- [ ] GitHub repository with your UppalCRM code
- [ ] Render account (sign up at https://render.com)
- [ ] Generated JWT secrets using `npm run generate:secrets`

## Step 1: PostgreSQL Database 🗄️
- [ ] Go to Render Dashboard: https://dashboard.render.com
- [ ] Click "New +" → "PostgreSQL"
- [ ] Configure database:
  - **Name**: `uppalcrm-database`
  - **Database**: `uppalcrm`
  - **User**: `uppalcrm_user`
  - **Region**: Ohio (or closest to your users)
  - **PostgreSQL Version**: 15
  - **Plan**: Free (upgrade for production)
- [ ] Click "Create Database"
- [ ] **SAVE**: Copy the Internal Database URL
- [ ] **SAVE**: Copy the External Database URL (for migrations)

## Step 2: Database Migrations 📋
- [ ] Wait for database to be ready (shows "Available")
- [ ] Run migrations locally using external URL:
  ```bash
  DATABASE_URL="your_external_postgres_url_here" npm run migrate:production
  ```
- [ ] Verify migration success (should see "All migrations completed successfully!")

## Step 3: Backend API Service 🚀
- [ ] Click "New +" → "Web Service"
- [ ] Connect your GitHub repository
- [ ] Configure service:
  - **Name**: `uppalcrm-api`
  - **Root Directory**: (leave empty)
  - **Runtime**: Node
  - **Build Command**: `npm install`
  - **Start Command**: `node server.js`
  - **Plan**: Free (upgrade for production)
- [ ] Add Environment Variables:
  ```
  NODE_ENV=production
  DATABASE_URL=[paste INTERNAL database URL from Step 1]
  JWT_SECRET=[from generate:secrets command]
  JWT_REFRESH_SECRET=[from generate:secrets command]
  JWT_EXPIRES_IN=1h
  JWT_REFRESH_EXPIRES_IN=7d
  BCRYPT_ROUNDS=12
  RATE_LIMIT_WINDOW_MS=900000
  RATE_LIMIT_MAX=100
  FRONTEND_URL=https://uppalcrm-frontend.onrender.com
  ```
- [ ] Click "Create Web Service"
- [ ] Wait for deployment to complete
- [ ] **SAVE**: Copy the service URL (e.g., https://uppalcrm-api.onrender.com)
- [ ] Test health endpoint: `[backend_url]/health`

## Step 4: Frontend Static Site 🎨
- [ ] Click "New +" → "Static Site"
- [ ] Connect your GitHub repository
- [ ] Configure site:
  - **Name**: `uppalcrm-frontend`
  - **Root Directory**: `frontend`
  - **Build Command**: `npm install && npm run build`
  - **Publish Directory**: `dist`
- [ ] Add Environment Variables:
  ```
  VITE_API_URL=https://uppalcrm-api.onrender.com/api
  ```
  (Use your actual backend URL from Step 3)
- [ ] Click "Create Static Site"
- [ ] Wait for build and deployment to complete
- [ ] **SAVE**: Copy the frontend URL

## Step 5: Update CORS Configuration 🔒
- [ ] Go back to backend service settings
- [ ] Update `FRONTEND_URL` environment variable with actual frontend URL
- [ ] Redeploy backend service

## Step 6: Testing & Verification ✅
- [ ] **Frontend Access**: Visit your frontend URL
- [ ] **Backend Health**: Test `[backend_url]/health`
- [ ] **API Documentation**: Test `[backend_url]/api`
- [ ] **Registration**: Create a new organization account
- [ ] **Login**: Test authentication
- [ ] **Dashboard**: Verify statistics load
- [ ] **Lead Management**: 
  - [ ] Create a new lead
  - [ ] Edit a lead
  - [ ] Delete a lead
  - [ ] Test filtering and search
  - [ ] Test team assignment
- [ ] **Mobile Responsiveness**: Test on mobile device

## Step 7: Production Optimization (Optional) 🚀
- [ ] Upgrade to paid plans for better performance
- [ ] Set up custom domains
- [ ] Configure monitoring and alerts
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Enable SSL certificates (automatic on Render)

## Troubleshooting 🛠️
If something doesn't work:
- [ ] Check service logs in Render dashboard
- [ ] Verify all environment variables are set correctly
- [ ] Ensure database migrations ran successfully
- [ ] Check CORS configuration if frontend can't reach backend
- [ ] Verify database connection string format
- [ ] Confirm build commands are correct

## URLs After Deployment 📍
- **Database**: [Your database internal URL]
- **Backend API**: https://uppalcrm-api.onrender.com
- **Frontend App**: https://uppalcrm-frontend.onrender.com
- **Marketing Site**: https://uppalcrm-api.onrender.com (serves static files)

## Important Notes 📝
- Free tier services sleep after 15 minutes of inactivity
- First request after sleeping may take 30-60 seconds
- Database has connection limits on free tier
- Consider paid plans for production workloads
- Keep your JWT secrets secure and never commit them

## Generated Files Available 📄
- `render.yaml` - Blueprint for one-click deployment
- `.env.production` - Environment variable templates
- `docs/render-deployment-steps.md` - Detailed step-by-step guide
- `scripts/production-migrate.js` - Production migration script
- `scripts/generate-secrets.js` - JWT secret generator

---
✅ **Deployment Complete!** Your customers can now access your CRM system at the live URLs.