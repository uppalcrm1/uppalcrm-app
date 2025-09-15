# 🚀 Production Deployment Guide - Zapier Integration System

## 📋 Pre-Deployment Checklist

### ✅ Code Ready for Production
- [x] Database migration created (`006_api_keys_webhooks.sql`)
- [x] API key management system implemented
- [x] Webhook endpoints created
- [x] Field mapping system implemented
- [x] Frontend UI for API key management
- [x] Multi-tenant security implemented
- [x] Rate limiting configured
- [x] Environment validation added
- [x] Comprehensive test suite created

### ✅ Security Validation
- [x] API keys use secure format: `uppal_{org_slug}_{random}`
- [x] bcrypt hashing for API key storage
- [x] Multi-tenant Row Level Security (RLS)
- [x] Rate limiting for webhooks
- [x] Organization-scoped access controls
- [x] CORS configuration for Zapier domains

## 🔧 Step 1: Environment Variables Setup

### Required Production Environment Variables

```bash
# Core Application
NODE_ENV=production
PORT=3000
DATABASE_URL=your_production_database_url

# Security (CRITICAL - Generate new values)
JWT_SECRET=your_production_jwt_secret_64_characters_minimum
SESSION_SECRET=your_production_session_secret_64_characters_minimum
API_KEY_ENCRYPTION_KEY=your_production_encryption_key_32_characters_minimum

# Webhook Configuration (NEW)
WEBHOOK_BASE_URL=https://your-production-domain.com
WEBHOOK_RATE_LIMIT_WINDOW_MS=900000
WEBHOOK_RATE_LIMIT_MAX=5

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend-domain.com,https://zapier.com,https://hooks.zapier.com
FRONTEND_URL=https://your-frontend-domain.com

# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your_production_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Encryption Rounds
BCRYPT_ROUNDS=12
```

### 🔑 Generate Secure Keys

Run these commands to generate production-ready secrets:

```bash
# Generate JWT Secret (64+ characters)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate Session Secret (64+ characters)  
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"

# Generate API Key Encryption Key (32+ characters)
node -e "console.log('API_KEY_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

## 🗄️ Step 2: Database Migration

### Run the API Keys & Webhooks Migration

```sql
-- Connect to your production database and run:
\i database/migrations/006_api_keys_webhooks.sql

-- Verify tables were created:
\dt api_keys
\dt api_key_usage_logs  
\dt webhook_endpoints
\dt webhook_delivery_logs

-- Verify RLS policies:
\d+ api_keys
```

### Migration Verification Checklist

- [ ] `api_keys` table created with proper structure
- [ ] `api_key_usage_logs` table created
- [ ] `webhook_endpoints` table created
- [ ] `webhook_delivery_logs` table created
- [ ] Row Level Security (RLS) policies enabled
- [ ] Indexes created for performance
- [ ] Triggers and functions working

## 🚢 Step 3: Code Deployment

### Deploy Updated Codebase

```bash
# 1. Commit all changes
git add .
git commit -m "Add Zapier integration system with API keys and webhooks

🔧 Added comprehensive Zapier integration:
- API key management system with secure generation
- Webhook endpoints for lead capture
- Field mapping for Google Forms, Typeform, Mailchimp, etc.
- Multi-tenant security and rate limiting
- Frontend UI for API key management
- Environment validation and configuration
- Comprehensive test suite

Generated with Claude Code"

# 2. Push to production branch
git push origin main

# 3. Deploy to your production platform
# (Render, Heroku, Vercel, etc.)
```

### Frontend Build & Deploy

```bash
# Build frontend with production config
cd frontend
npm run build

# Deploy frontend to your hosting platform
# (Netlify, Vercel, etc.)
```

## 🧪 Step 4: Production Testing

### Test Environment Validation

```bash
# Test environment configuration
curl https://your-domain.com/health

# Check API documentation includes new endpoints
curl https://your-domain.com/api
```

### Test API Key Management

1. **Login to production app**
2. **Navigate to Settings → Integrations → Zapier**
3. **Create a test API key**
4. **Verify key format**: `uppal_{org_slug}_{random_string}`
5. **Test webhook endpoint**:

```bash
curl -X POST https://your-domain.com/api/webhooks/leads \
  -H "X-API-Key: your_generated_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User", 
    "email": "test@production.com",
    "company": "Production Test Corp"
  }'
```

### Test Zapier Integration

1. **Create Zapier account** (if needed)
2. **Set up a test Zap**:
   - Trigger: Google Forms (or any supported source)
   - Action: Webhook to `https://your-domain.com/api/webhooks/leads`
   - Headers: `X-API-Key: your_api_key`
3. **Test the Zap** with sample data
4. **Verify lead appears** in your CRM

## 📊 Step 5: Monitoring & Verification

### Health Checks

- [ ] Server responds to health endpoint
- [ ] Database connections working
- [ ] Email notifications sending
- [ ] API endpoints responding correctly
- [ ] Frontend loading and functional

### Webhook Monitoring

- [ ] Webhook rate limiting working
- [ ] API key authentication working
- [ ] Field mapping processing correctly
- [ ] Leads being created successfully
- [ ] Multi-tenant isolation working
- [ ] Usage statistics tracking

### Performance Monitoring

```bash
# Monitor webhook performance
tail -f /var/log/your-app.log | grep "webhook"

# Monitor API key usage
curl https://your-domain.com/api/organizations/current/api-keys \
  -H "Authorization: Bearer your_jwt_token"
```

## 🔒 Step 6: Security Verification

### Security Checklist

- [ ] All default secrets changed
- [ ] HTTPS enabled for all endpoints
- [ ] CORS configured correctly
- [ ] Rate limiting active
- [ ] API key authentication working
- [ ] Multi-tenant isolation verified
- [ ] No sensitive data in logs
- [ ] Environment variables secured

### Test Security Boundaries

```bash
# Test invalid API key rejection
curl -X POST https://your-domain.com/api/webhooks/leads \
  -H "X-API-Key: invalid_key" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@security.com"}'
# Should return 401

# Test rate limiting
# Make multiple rapid requests to trigger rate limit
# Should return 429 after limit exceeded
```

## 📋 Step 7: Documentation & Training

### Update Documentation

1. **Add API documentation** for webhook endpoints
2. **Create Zapier setup guide** for users
3. **Document supported integrations**:
   - Google Forms
   - Typeform
   - Mailchimp
   - LinkedIn Lead Gen
   - Facebook Lead Ads
   - HubSpot
   - Calendly
   - Shopify

### User Training Materials

Create guides for:
- How to create API keys
- How to set up Zapier integrations
- Troubleshooting common issues
- Understanding field mapping

## 🚨 Rollback Plan

If issues occur during deployment:

```bash
# 1. Revert database migration (if needed)
# Run rollback SQL commands

# 2. Revert code deployment
git revert HEAD
git push origin main

# 3. Restore previous environment variables

# 4. Verify system functionality
```

## 📞 Post-Deployment Support

### Monitor These Metrics

- API key creation rate
- Webhook success/failure rates
- Rate limiting triggers
- Database performance
- User adoption of new features

### Support Resources

- Check server logs for webhook errors
- Monitor database for orphaned records
- Track API key usage patterns
- User feedback on integration setup

## 🎉 Success Criteria

Deployment is successful when:

- [ ] All existing functionality still works
- [ ] Users can create API keys through UI
- [ ] Webhook endpoints are responding
- [ ] Zapier integrations work end-to-end
- [ ] Multi-tenant security is maintained
- [ ] Rate limiting is enforced
- [ ] No security vulnerabilities introduced
- [ ] Performance remains acceptable

---

## 🔗 Quick Links

- **API Documentation**: `https://your-domain.com/api`
- **Health Check**: `https://your-domain.com/health`
- **Admin Interface**: `https://your-domain.com/settings`
- **Zapier Integration**: `https://your-domain.com/settings/integrations/zapier`

## 📧 Need Help?

If you encounter issues during deployment:

1. Check the server logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure database migration completed successfully
4. Test individual components (API keys, webhooks) separately
5. Roll back if critical issues are discovered

**The system is now ready for production with comprehensive Zapier integration capabilities!** 🚀