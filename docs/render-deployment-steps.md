# Step-by-Step Render Deployment Guide

## Prerequisites
- GitHub repository with your UppalCRM code
- Render account (sign up at https://render.com)

## Step 1: Create PostgreSQL Database

1. Log into Render Dashboard: https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Configure database:
   - **Name**: `uppalcrm-database`
   - **Database**: `uppalcrm`  
   - **User**: `uppalcrm_user`
   - **Region**: Ohio (or closest to your users)
   - **PostgreSQL Version**: 15
   - **Plan**: Free (upgrade for production)
4. Click "Create Database"
5. **SAVE**: Copy the Internal Database URL (you'll need this)

## Step 2: Run Database Migrations

After database is ready, run migrations:

```bash
# Use the EXTERNAL database URL for migrations
DATABASE_URL="your_external_postgres_url_here" node scripts/production-migrate.js
```

## Step 3: Deploy Backend API

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure service:
   - **Name**: `uppalcrm-api`
   - **Root Directory**: (leave empty)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: Free (upgrade for production)

4. **Environment Variables** (add these):
   ```
   NODE_ENV=production
   DATABASE_URL=[paste the INTERNAL database URL from Step 1]
   JWT_SECRET=[generate a 32+ character random string]
   JWT_REFRESH_SECRET=[generate another 32+ character random string]
   JWT_EXPIRES_IN=1h
   JWT_REFRESH_EXPIRES_IN=7d
   BCRYPT_ROUNDS=12
   RATE_LIMIT_WINDOW_MS=900000
   RATE_LIMIT_MAX=100
   FRONTEND_URL=https://uppalcrm-frontend.onrender.com
   ```

5. Click "Create Web Service"
6. **SAVE**: Copy the service URL (e.g., https://uppalcrm-api.onrender.com)

## Step 4: Deploy Frontend

1. Click "New +" → "Static Site"
2. Connect your GitHub repository  
3. Configure site:
   - **Name**: `uppalcrm-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`

4. **Environment Variables** (add this):
   ```
   VITE_API_URL=https://uppalcrm-api.onrender.com/api
   ```
   (Use the actual backend URL from Step 3)

5. Click "Create Static Site"

## Step 5: Update CORS (if needed)

If you used different service names, update the backend environment variables:
- Go to your backend service settings
- Update `FRONTEND_URL` with your actual frontend URL

## Step 6: Test Your Deployment

1. **Frontend**: Visit your frontend URL (e.g., https://uppalcrm-frontend.onrender.com)
2. **Backend API**: Test at your backend URL + `/health` (e.g., https://uppalcrm-api.onrender.com/health)
3. **Register**: Create a new organization account
4. **Test Features**: Create leads, view dashboard, assign team members

## Important Notes

### Free Tier Limitations
- Services sleep after 15 minutes of inactivity
- First request after sleeping takes 30-60 seconds to wake up
- Database has connection limits

### Production Recommendations
- Upgrade to paid plans for better performance
- Set up monitoring and alerts
- Configure custom domains
- Set up SSL certificates (automatic on Render)

### Troubleshooting
- Check service logs in Render dashboard
- Verify environment variables are set correctly
- Ensure database migrations ran successfully
- Check CORS configuration if frontend can't reach backend

## Generated Secrets

To generate secure secrets for JWT:

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run this twice to get two different secrets for JWT_SECRET and JWT_REFRESH_SECRET.

## Security Best Practices

1. Use strong, unique secrets for JWT tokens
2. Enable automatic SSL (included with Render)
3. Set up monitoring for your services
4. Regularly update dependencies
5. Use paid plans for production workloads