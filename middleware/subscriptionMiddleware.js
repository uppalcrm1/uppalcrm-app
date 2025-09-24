const db = require('../config/database');

// Middleware to check if organization has access to a feature
const requireFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const organizationId = req.user.organization_id;

      // Check if organization has access to the feature
      const query = `SELECT has_feature_access($1, $2) as has_access`;
      const result = await db.query(query, [organizationId, featureKey]);

      const hasAccess = result.rows[0].has_access;

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Feature not available',
          message: `Your current subscription plan does not include access to ${featureKey}. Please upgrade your plan to use this feature.`,
          feature_key: featureKey,
          upgrade_required: true
        });
      }

      next();
    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({ error: 'Failed to verify feature access' });
    }
  };
};

// Middleware to check usage limits before allowing resource creation
const checkUsageLimit = (resourceType) => {
  return async (req, res, next) => {
    try {
      const organizationId = req.user.organization_id;
      const additionalCount = req.body.count || 1; // Allow specifying how many resources are being added

      // Check if organization can add more resources
      const query = `SELECT check_usage_limits($1, $2, $3) as can_add`;
      const result = await db.query(query, [organizationId, resourceType, additionalCount]);

      const canAdd = result.rows[0].can_add;

      if (!canAdd) {
        // Get current limits and usage for better error message
        const limitsQuery = `
          SELECT
            sp.max_users,
            sp.max_contacts,
            sp.max_leads,
            sp.max_custom_fields,
            sp.display_name as plan_name
          FROM organization_subscriptions os
          JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
          WHERE os.organization_id = $1 AND os.status IN ('trial', 'active')
        `;

        const limitsResult = await db.query(limitsQuery, [organizationId]);
        const limits = limitsResult.rows[0];

        let currentLimit;
        switch (resourceType) {
          case 'users':
            currentLimit = limits?.max_users;
            break;
          case 'contacts':
            currentLimit = limits?.max_contacts;
            break;
          case 'leads':
            currentLimit = limits?.max_leads;
            break;
          case 'custom_fields':
            currentLimit = limits?.max_custom_fields;
            break;
        }

        return res.status(409).json({
          error: 'Usage limit exceeded',
          message: `You have reached the ${resourceType} limit for your ${limits?.plan_name || 'current'} plan.`,
          resource_type: resourceType,
          current_limit: currentLimit,
          upgrade_required: true
        });
      }

      next();
    } catch (error) {
      console.error('Error checking usage limits:', error);
      res.status(500).json({ error: 'Failed to verify usage limits' });
    }
  };
};

// Middleware to check if subscription is active
const requireActiveSubscription = async (req, res, next) => {
  try {
    const organizationId = req.user.organization_id;

    const query = `
      SELECT status, current_period_end, trial_end
      FROM organization_subscriptions
      WHERE organization_id = $1
    `;

    const result = await db.query(query, [organizationId]);

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: 'No subscription found',
        message: 'Your organization does not have an active subscription. Please subscribe to a plan to continue.',
        subscription_required: true
      });
    }

    const subscription = result.rows[0];
    const now = new Date();

    // Check if subscription is expired
    if (subscription.status === 'trial' && subscription.trial_end && new Date(subscription.trial_end) < now) {
      return res.status(403).json({
        error: 'Trial expired',
        message: 'Your trial period has expired. Please subscribe to a paid plan to continue.',
        trial_expired: true
      });
    }

    if (subscription.status === 'active' && subscription.current_period_end && new Date(subscription.current_period_end) < now) {
      return res.status(403).json({
        error: 'Subscription expired',
        message: 'Your subscription has expired. Please renew your subscription to continue.',
        subscription_expired: true
      });
    }

    if (!['trial', 'active'].includes(subscription.status)) {
      return res.status(403).json({
        error: 'Subscription inactive',
        message: `Your subscription is ${subscription.status}. Please contact support or renew your subscription.`,
        subscription_status: subscription.status
      });
    }

    next();
  } catch (error) {
    console.error('Error checking subscription status:', error);
    res.status(500).json({ error: 'Failed to verify subscription status' });
  }
};

// Middleware to track API usage (for API rate limiting)
const trackApiUsage = async (req, res, next) => {
  try {
    const organizationId = req.user.organization_id;
    const endpoint = req.route?.path || req.path;
    const method = req.method;

    // Track API call in database (you might want to use Redis for better performance)
    const trackingQuery = `
      INSERT INTO api_usage_tracking (
        organization_id,
        endpoint,
        method,
        user_id,
        timestamp
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
    `;

    // Note: You'll need to create the api_usage_tracking table if you want to implement this
    // For now, we'll just proceed without error
    try {
      await db.query(trackingQuery, [organizationId, endpoint, method, req.user.id]);
    } catch (dbError) {
      // Table might not exist yet - continue without tracking
      console.log('API usage tracking table not found - skipping tracking');
    }

    next();
  } catch (error) {
    console.error('Error tracking API usage:', error);
    // Don't fail the request if tracking fails
    next();
  }
};

// Middleware to add subscription context to requests
const addSubscriptionContext = async (req, res, next) => {
  try {
    const organizationId = req.user.organization_id;

    const query = `
      SELECT
        os.*,
        sp.name as plan_name,
        sp.display_name as plan_display_name,
        sp.max_users,
        sp.max_contacts,
        sp.max_leads,
        sp.max_storage_gb,
        sp.max_api_calls_per_month,
        sp.max_custom_fields,
        sp.features
      FROM organization_subscriptions os
      JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
      WHERE os.organization_id = $1
    `;

    const result = await db.query(query, [organizationId]);

    if (result.rows.length > 0) {
      req.subscription = result.rows[0];
    } else {
      req.subscription = null;
    }

    next();
  } catch (error) {
    console.error('Error adding subscription context:', error);
    req.subscription = null;
    next();
  }
};

// Helper function to check if user can perform bulk operations
const checkBulkOperationLimits = (resourceType, maxCount = 100) => {
  return async (req, res, next) => {
    try {
      const organizationId = req.user.organization_id;
      const items = req.body.items || req.body.data || [];
      const itemCount = Array.isArray(items) ? items.length : 1;

      // Check if bulk operation exceeds reasonable limits
      if (itemCount > maxCount) {
        return res.status(400).json({
          error: 'Bulk operation limit exceeded',
          message: `You can only process ${maxCount} ${resourceType} at a time.`,
          max_allowed: maxCount,
          requested: itemCount
        });
      }

      // Check if organization has enough capacity for the bulk operation
      const query = `SELECT check_usage_limits($1, $2, $3) as can_add`;
      const result = await db.query(query, [organizationId, resourceType, itemCount]);

      const canAdd = result.rows[0].can_add;

      if (!canAdd) {
        return res.status(409).json({
          error: 'Insufficient capacity',
          message: `Adding ${itemCount} ${resourceType} would exceed your plan limits.`,
          requested_count: itemCount,
          upgrade_required: true
        });
      }

      next();
    } catch (error) {
      console.error('Error checking bulk operation limits:', error);
      res.status(500).json({ error: 'Failed to verify bulk operation limits' });
    }
  };
};

module.exports = {
  requireFeature,
  checkUsageLimit,
  requireActiveSubscription,
  trackApiUsage,
  addSubscriptionContext,
  checkBulkOperationLimits
};