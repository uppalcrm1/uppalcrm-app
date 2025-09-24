# Subscription Management System - Testing Guide

## Step-by-Step Testing Instructions

### Prerequisites
1. ✅ Database schema applied (`database/subscription_management_schema.sql`)
2. ✅ Backend server running on port 3004
3. ✅ Frontend running on port 3003

### Step 1: Database Setup Verification

First, verify the subscription tables were created:

```sql
-- Connect to your PostgreSQL database and run:
\dt subscription*
\dt plan*

-- You should see these tables:
-- organization_subscriptions
-- subscription_plans
-- subscription_usage
-- subscription_invoices
-- subscription_events
-- plan_features
-- plan_feature_mappings
```

### Step 2: Check Default Plans

Verify the default subscription plans were inserted:

```sql
SELECT name, display_name, monthly_price, max_users, max_contacts, max_leads
FROM subscription_plans
WHERE is_active = true;
```

Expected output:
- trial: Free Trial (0, 3 users, 100 contacts, 50 leads)
- starter: Starter ($29, 5 users, 1000 contacts, 500 leads)
- professional: Professional ($99, 25 users, 10000 contacts, 5000 leads)
- enterprise: Enterprise ($299, unlimited)

### Step 3: Frontend Testing

1. **Access the CRM Dashboard**
   - Open http://localhost:3003
   - Login with your existing credentials

2. **Navigate to Subscription Management**
   - Look for "Subscription" in the left sidebar navigation
   - Click on "Subscription"

3. **Expected Behavior**
   - If no subscription exists: You'll see "No Subscription Found"
   - If subscription exists: You'll see current subscription details

### Step 4: API Endpoint Testing

Use these curl commands to test the API endpoints:

```bash
# Get authentication token first (replace with your login credentials)
curl -X POST http://localhost:3004/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-email@example.com","password":"your-password"}'

# Save the returned token and use it in subsequent requests
export TOKEN="your-jwt-token-here"

# Test 1: Get available subscription plans
curl -X GET http://localhost:3004/api/subscription/plans \
  -H "Authorization: Bearer $TOKEN"

# Test 2: Get current subscription (might return 404 if none exists)
curl -X GET http://localhost:3004/api/subscription \
  -H "Authorization: Bearer $TOKEN"

# Test 3: Create a subscription (replace plan_id with actual UUID from plans)
curl -X POST http://localhost:3004/api/subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"subscription_plan_id":"plan-uuid-here","billing_cycle":"monthly"}'

# Test 4: Check usage limits
curl -X POST http://localhost:3004/api/subscription/check-limits \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"usage_type":"users","additional_count":1}'

# Test 5: Check feature access
curl -X GET http://localhost:3004/api/subscription/feature/api_access \
  -H "Authorization: Bearer $TOKEN"
```

### Step 5: Organization Model Integration Testing

Test the enhanced Organization model methods:

```javascript
// In your Node.js console or a test script:
const Organization = require('./models/Organization');

// Test checking if organization can add users
const canAdd = await Organization.canAddUsers('your-org-id');
console.log('Can add users:', canAdd);

// Test getting subscription details
const subscription = await Organization.getSubscription('your-org-id');
console.log('Subscription:', subscription);

// Test feature access
const hasAPI = await Organization.hasFeatureAccess('your-org-id', 'api_access');
console.log('Has API access:', hasAPI);

// Test usage limits
const canAddContacts = await Organization.checkUsageLimits('your-org-id', 'contacts', 10);
console.log('Can add 10 contacts:', canAddContacts);

// Test current usage
const usage = await Organization.getCurrentUsage('your-org-id');
console.log('Current usage:', usage);
```

### Step 6: Trial Subscription Testing

When you create a new organization, it should automatically get a trial subscription:

1. Register a new organization through your registration process
2. Check the database for the auto-created trial subscription:

```sql
SELECT os.*, sp.display_name, sp.trial_days
FROM organization_subscriptions os
JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
WHERE os.organization_id = 'new-org-id';
```

### Step 7: Usage Tracking Testing

Test the usage tracking functionality:

1. Create some leads, contacts, and users in your CRM
2. Check the calculated usage:

```sql
SELECT * FROM get_current_usage('your-org-id');
```

3. Test usage limits:

```sql
SELECT check_usage_limits('your-org-id', 'users', 1);
SELECT check_usage_limits('your-org-id', 'contacts', 100);
SELECT check_usage_limits('your-org-id', 'leads', 50);
```

### Step 8: Middleware Testing

Test the subscription middleware by trying to exceed limits:

1. Try creating more users than your plan allows
2. Try accessing features not included in your plan
3. Check that proper error messages are returned

### Step 9: Frontend Features Testing

In the subscription management interface:

1. **View Current Subscription**
   - Check subscription status, plan details, billing cycle
   - Verify usage meters show correct percentages

2. **Usage Overview**
   - Verify usage bars show correct data
   - Check color coding (green=good, yellow=warning, red=critical)

3. **Plan Upgrade**
   - Click "Change Plan" button
   - Select a different plan
   - Verify the upgrade process works

4. **Billing Preview**
   - Check if billing preview shows correct amounts
   - Verify billing cycle information

### Common Issues and Solutions

1. **"No Subscription Found" Error**
   - Run the trial initialization manually:
   ```sql
   SELECT * FROM subscription_plans WHERE name = 'trial';
   -- Copy the trial plan ID and run:
   INSERT INTO organization_subscriptions (id, organization_id, subscription_plan_id, status, billing_cycle, current_price, trial_start, trial_end, current_period_start, current_period_end)
   VALUES (gen_random_uuid(), 'your-org-id', 'trial-plan-id', 'trial', 'monthly', 0, NOW(), NOW() + INTERVAL '14 days', NOW(), NOW() + INTERVAL '14 days');
   ```

2. **Database Function Errors**
   - Ensure all functions from the schema file were created successfully
   - Check PostgreSQL logs for any errors

3. **Authentication Issues**
   - Verify JWT token is valid and not expired
   - Check that the user belongs to the organization being tested

### Success Criteria

Your subscription system is working correctly if:

- ✅ All database tables and functions are created
- ✅ Default subscription plans are available
- ✅ Organizations get trial subscriptions automatically
- ✅ Usage limits are enforced correctly
- ✅ Feature access control works
- ✅ Frontend displays subscription information
- ✅ Plan upgrades/changes work
- ✅ API endpoints respond correctly with proper authentication

### Next Steps

Once testing is complete:

1. **Payment Integration**: Add Stripe or other payment processing
2. **Billing Jobs**: Set up automated billing and usage calculation
3. **Email Notifications**: Add trial expiration and payment reminders
4. **Admin Dashboard**: Create super admin interface for managing all subscriptions
5. **Analytics**: Add subscription analytics and reporting

---

## File Summary

The subscription system consists of these key files:

### Backend Files
- `database/subscription_management_schema.sql` - Complete database schema
- `controllers/subscriptionController.js` - Main subscription logic
- `middleware/subscriptionMiddleware.js` - Usage and feature enforcement
- `routes/subscription.js` - API endpoints
- `models/Organization.js` - Enhanced with subscription methods

### Frontend Files
- `frontend/src/pages/SubscriptionManagement.jsx` - Main subscription interface
- `frontend/src/components/DashboardLayout.jsx` - Updated navigation
- `frontend/src/App.jsx` - Added subscription route

### Configuration Files
- `server.js` - Added subscription routes