# Render Deployment Guide for UppalCRM

## Step 1: Create PostgreSQL Database on Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Create New PostgreSQL Database**:
   - Click "New +" → "PostgreSQL"
   - Name: `uppalcrm-database`
   - Database: `uppalcrm`
   - User: `uppalcrm_user`
   - Region: Choose closest to your users
   - PostgreSQL Version: 15
   - Plan: Free (or paid for production)

3. **Save Connection Details** (you'll get these after creation):
   - Internal Database URL (for backend service)
   - External Database URL (for migrations)

## Step 2: Deploy Backend API Service

1. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Name: `uppalcrm-api`
   - Root Directory: `/` (leave empty)
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Plan: Free (or paid for production)

2. **Environment Variables** (add these in Render dashboard):
   ```
   NODE_ENV=production
   DATABASE_URL=[your render postgres internal URL]
   JWT_SECRET=[generate a strong secret]
   JWT_REFRESH_SECRET=[generate another strong secret]
   FRONTEND_URL=https://your-frontend-name.onrender.com
   ```

## Step 3: Deploy Frontend Static Site

1. **Create Static Site**:
   - Click "New +" → "Static Site"
   - Connect your GitHub repository
   - Name: `uppalcrm-frontend`
   - Root Directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

2. **Environment Variables** (add these in Render dashboard):
   ```
   VITE_API_URL=https://your-backend-name.onrender.com/api
   ```

## Step 4: Run Database Migrations

After the database is created, run migrations using the external connection URL:

1. Connect to database using external URL
2. Run the migration scripts in order

## URLs After Deployment

- **Database**: [Internal URL from Render]
- **Backend API**: https://uppalcrm-api.onrender.com
- **Frontend App**: https://uppalcrm-frontend.onrender.com

## Important Notes

- Free tier services sleep after 15 minutes of inactivity
- First request after sleeping may take 30-60 seconds
- Consider paid plans for production use
- Set up custom domains if needed