const { query } = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

class SubscriptionController {
  // Get organization subscription details
  async getOrganizationSubscription(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { query: dbQuery } = require('../database/connection');

      // First, check if organization is on trial
      const orgResult = await dbQuery(`
        SELECT
          id,
          name,
          subscription_plan,
          is_trial,
          trial_status,
          trial_expires_at,
          max_users,
          EXTRACT(DAY FROM (trial_expires_at - NOW()))::INTEGER as days_remaining
        FROM organizations
        WHERE id = $1
      `, [organizationId]);

      if (orgResult.rows.length === 0) {
        return res.status(404).json({ error: 'Organization not found' });
      }

      const org = orgResult.rows[0];

      // If organization is on trial
      if (org.is_trial && org.trial_status === 'active') {
        const usage = await this.getCurrentUsage(organizationId);

        return res.json({
          subscription: {
            status: 'trial',
            plan_name: org.subscription_plan || 'starter',
            plan_display_name: (org.subscription_plan || 'starter').charAt(0).toUpperCase() + (org.subscription_plan || 'starter').slice(1),
            trial_ends_at: org.trial_expires_at,
            days_remaining: Math.max(0, org.days_remaining || 0),
            max_users: org.max_users,
            is_trial: true
          },
          usage,
          limits: {
            users: org.max_users,
            contacts: null, // Unlimited for trial
            leads: null,
            storage_gb: null,
            api_calls_per_month: null,
            custom_fields: null
          }
        });
      }

      // If organization is paid, check for subscription record
      const subQuery = `
        SELECT
          os.*,
          sp.name as plan_name,
          sp.display_name as plan_display_name,
          sp.description as plan_description,
          sp.monthly_price,
          sp.yearly_price,
          sp.max_users,
          sp.max_contacts,
          sp.max_leads,
          sp.max_storage_gb,
          sp.max_api_calls_per_month,
          sp.max_custom_fields,
          sp.features,
          sp.trial_days
        FROM organization_subscriptions os
        JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
        WHERE os.organization_id = $1
      `;

      const result = await dbQuery(subQuery, [organizationId]);

      if (result.rows.length === 0) {
        // Paid org but no subscription record - return basic info
        const usage = await this.getCurrentUsage(organizationId);

        return res.json({
          subscription: {
            status: 'active',
            plan_name: org.subscription_plan || 'starter',
            plan_display_name: (org.subscription_plan || 'starter').charAt(0).toUpperCase() + (org.subscription_plan || 'starter').slice(1),
            max_users: org.max_users,
            is_trial: false
          },
          usage,
          limits: {
            users: org.max_users,
            contacts: null,
            leads: null,
            storage_gb: null,
            api_calls_per_month: null,
            custom_fields: null
          }
        });
      }

      const subscription = result.rows[0];
      const usage = await this.getCurrentUsage(organizationId);

      res.json({
        subscription,
        usage,
        limits: {
          users: subscription.max_users,
          contacts: subscription.max_contacts,
          leads: subscription.max_leads,
          storage_gb: subscription.max_storage_gb,
          api_calls_per_month: subscription.max_api_calls_per_month,
          custom_fields: subscription.max_custom_fields
        }
      });
    } catch (error) {
      console.error('Error fetching organization subscription:', error);
      res.status(500).json({ error: 'Failed to fetch subscription details' });
    }
  }

  // Get current usage for organization
  async getCurrentUsage(organizationId) {
    try {
      const query = `SELECT * FROM get_current_usage($1)`;
      const result = await query(query, [organizationId]);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting current usage:', error);
      return null;
    }
  }

  // Check if organization can add more of a specific resource
  async checkUsageLimits(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { usage_type, additional_count = 1 } = req.body;

      if (!usage_type || !['users', 'contacts', 'leads', 'custom_fields'].includes(usage_type)) {
        return res.status(400).json({ error: 'Invalid usage_type. Must be: users, contacts, leads, or custom_fields' });
      }

      const query = `SELECT check_usage_limits($1, $2, $3) as can_add`;
      const result = await query(query, [organizationId, usage_type, additional_count]);

      const canAdd = result.rows[0].can_add;

      res.json({
        can_add: canAdd,
        usage_type,
        additional_count
      });
    } catch (error) {
      console.error('Error checking usage limits:', error);
      res.status(500).json({ error: 'Failed to check usage limits' });
    }
  }

  // Check if organization has access to a specific feature
  async checkFeatureAccess(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { feature_key } = req.params;

      const query = `SELECT has_feature_access($1, $2) as has_access`;
      const result = await query(query, [organizationId, feature_key]);

      const hasAccess = result.rows[0].has_access;

      res.json({
        has_access: hasAccess,
        feature_key
      });
    } catch (error) {
      console.error('Error checking feature access:', error);
      res.status(500).json({ error: 'Failed to check feature access' });
    }
  }

  // Get all available subscription plans
  async getSubscriptionPlans(req, res) {
    try {
      const query = `
        SELECT
          sp.*,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'feature_key', pf.feature_key,
                'feature_name', pf.feature_name,
                'description', pf.description,
                'feature_type', pf.feature_type,
                'feature_value', pfm.feature_value,
                'is_included', pfm.is_included
              )
            ) FILTER (WHERE pf.id IS NOT NULL),
            '[]'::json
          ) as features_list
        FROM subscription_plans sp
        LEFT JOIN plan_feature_mappings pfm ON pfm.subscription_plan_id = sp.id
        LEFT JOIN plan_features pf ON pf.id = pfm.plan_feature_id AND pf.is_active = true
        WHERE sp.is_active = true AND (sp.is_public = true OR $1 = true)
        GROUP BY sp.id
        ORDER BY sp.sort_order, sp.monthly_price
      `;

      const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
      const result = await query(query, [isAdmin]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      res.status(500).json({ error: 'Failed to fetch subscription plans' });
    }
  }

  // Create or update subscription for organization
  async createOrUpdateSubscription(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { subscription_plan_id, billing_cycle = 'monthly' } = req.body;

      if (!subscription_plan_id) {
        return res.status(400).json({ error: 'subscription_plan_id is required' });
      }

      if (!['monthly', 'yearly'].includes(billing_cycle)) {
        return res.status(400).json({ error: 'billing_cycle must be monthly or yearly' });
      }

      // Get the plan details
      const planQuery = `SELECT * FROM subscription_plans WHERE id = $1 AND is_active = true`;
      const planResult = await query(planQuery, [subscription_plan_id]);

      if (planResult.rows.length === 0) {
        return res.status(404).json({ error: 'Subscription plan not found or inactive' });
      }

      const plan = planResult.rows[0];

      // Calculate pricing
      const currentPrice = billing_cycle === 'yearly' && plan.yearly_price ?
        plan.yearly_price : plan.monthly_price;

      // Calculate subscription period
      const now = new Date();
      const periodStart = new Date(now);
      const periodEnd = new Date(now);

      if (billing_cycle === 'yearly') {
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
      } else {
        periodEnd.setMonth(periodEnd.getMonth() + 1);
      }

      // Check if subscription already exists
      const existingQuery = `SELECT id FROM organization_subscriptions WHERE organization_id = $1`;
      const existingResult = await query(existingQuery, [organizationId]);

      let subscriptionId;
      let isUpdate = false;

      if (existingResult.rows.length > 0) {
        // Update existing subscription
        subscriptionId = existingResult.rows[0].id;
        isUpdate = true;

        const updateQuery = `
          UPDATE organization_subscriptions
          SET
            subscription_plan_id = $1,
            billing_cycle = $2,
            current_price = $3,
            current_period_start = $4,
            current_period_end = $5,
            status = 'active',
            updated_at = CURRENT_TIMESTAMP
          WHERE organization_id = $6
          RETURNING *
        `;

        await query(updateQuery, [
          subscription_plan_id,
          billing_cycle,
          currentPrice,
          periodStart,
          periodEnd,
          organizationId
        ]);
      } else {
        // Create new subscription
        subscriptionId = uuidv4();

        const insertQuery = `
          INSERT INTO organization_subscriptions (
            id, organization_id, subscription_plan_id, status, billing_cycle,
            current_price, current_period_start, current_period_end
          ) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
          RETURNING *
        `;

        await query(insertQuery, [
          subscriptionId,
          organizationId,
          subscription_plan_id,
          billing_cycle,
          currentPrice,
          periodStart,
          periodEnd
        ]);
      }

      // Log the subscription event
      await this.logSubscriptionEvent(
        organizationId,
        subscriptionId,
        isUpdate ? 'plan_changed' : 'subscription_created',
        `Subscription ${isUpdate ? 'updated to' : 'created with'} ${plan.display_name} plan`,
        req.user.id
      );

      res.json({
        message: `Subscription ${isUpdate ? 'updated' : 'created'} successfully`,
        subscription_id: subscriptionId,
        plan: plan.display_name,
        billing_cycle,
        current_price: currentPrice
      });
    } catch (error) {
      console.error('Error creating/updating subscription:', error);
      res.status(500).json({ error: 'Failed to create/update subscription' });
    }
  }

  // Cancel subscription
  async cancelSubscription(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { reason, cancel_at_period_end = true } = req.body;

      const updateQuery = `
        UPDATE organization_subscriptions
        SET
          status = CASE WHEN $3 = true THEN status ELSE 'cancelled' END,
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = $2,
          cancel_at_period_end = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = $1
        RETURNING *
      `;

      const result = await query(updateQuery, [organizationId, reason, cancel_at_period_end]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No subscription found for organization' });
      }

      // Log the cancellation event
      await this.logSubscriptionEvent(
        organizationId,
        result.rows[0].id,
        'subscription_cancelled',
        `Subscription cancelled: ${reason || 'No reason provided'}`,
        req.user.id
      );

      res.json({
        message: cancel_at_period_end ?
          'Subscription will be cancelled at the end of current period' :
          'Subscription cancelled immediately',
        cancelled_at: result.rows[0].cancelled_at,
        cancel_at_period_end
      });
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({ error: 'Failed to cancel subscription' });
    }
  }

  // Record usage for billing period
  async recordUsage(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { period_start, period_end } = req.body;

      if (!period_start || !period_end) {
        return res.status(400).json({ error: 'period_start and period_end are required' });
      }

      // Get subscription
      const subQuery = `SELECT id FROM organization_subscriptions WHERE organization_id = $1`;
      const subResult = await query(subQuery, [organizationId]);

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'No subscription found for organization' });
      }

      const subscriptionId = subResult.rows[0].id;

      // Get current usage
      const usage = await this.getCurrentUsage(organizationId);

      if (!usage) {
        return res.status(500).json({ error: 'Failed to get current usage' });
      }

      // Insert or update usage record
      const upsertQuery = `
        INSERT INTO subscription_usage (
          organization_id, subscription_id, period_start, period_end,
          active_users, total_contacts, total_leads, storage_used_gb,
          api_calls, custom_fields_used
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (organization_id, period_start, period_end)
        DO UPDATE SET
          active_users = EXCLUDED.active_users,
          total_contacts = EXCLUDED.total_contacts,
          total_leads = EXCLUDED.total_leads,
          storage_used_gb = EXCLUDED.storage_used_gb,
          api_calls = EXCLUDED.api_calls,
          custom_fields_used = EXCLUDED.custom_fields_used,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `;

      const result = await query(upsertQuery, [
        organizationId,
        subscriptionId,
        period_start,
        period_end,
        usage.active_users,
        usage.total_contacts,
        usage.total_leads,
        usage.storage_used_gb,
        usage.api_calls,
        usage.custom_fields_used
      ]);

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error recording usage:', error);
      res.status(500).json({ error: 'Failed to record usage' });
    }
  }

  // Get usage history
  async getUsageHistory(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { limit = 12 } = req.query;

      const query = `
        SELECT * FROM subscription_usage
        WHERE organization_id = $1
        ORDER BY period_start DESC
        LIMIT $2
      `;

      const result = await query(query, [organizationId, limit]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching usage history:', error);
      res.status(500).json({ error: 'Failed to fetch usage history' });
    }
  }

  // Log subscription events for audit trail
  async logSubscriptionEvent(organizationId, subscriptionId, eventType, description, performedBy = null) {
    try {
      const insertQuery = `
        INSERT INTO subscription_events (
          organization_id, subscription_id, event_type, description, performed_by
        ) VALUES ($1, $2, $3, $4, $5)
      `;

      await query(insertQuery, [
        organizationId,
        subscriptionId,
        eventType,
        description,
        performedBy
      ]);
    } catch (error) {
      console.error('Error logging subscription event:', error);
    }
  }

  // Get subscription events/audit trail
  async getSubscriptionEvents(req, res) {
    try {
      const organizationId = req.user.organization_id;
      const { limit = 50 } = req.query;

      const query = `
        SELECT
          se.*,
          u.first_name,
          u.last_name,
          u.email
        FROM subscription_events se
        LEFT JOIN users u ON u.id = se.performed_by
        WHERE se.organization_id = $1
        ORDER BY se.created_at DESC
        LIMIT $2
      `;

      const result = await query(query, [organizationId, limit]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching subscription events:', error);
      res.status(500).json({ error: 'Failed to fetch subscription events' });
    }
  }

  // Calculate and preview billing for next period
  async previewBilling(req, res) {
    try {
      const organizationId = req.user.organization_id;

      // Get current subscription
      const subQuery = `
        SELECT
          os.*,
          sp.name as plan_name,
          sp.display_name as plan_display_name,
          sp.monthly_price,
          sp.yearly_price
        FROM organization_subscriptions os
        JOIN subscription_plans sp ON sp.id = os.subscription_plan_id
        WHERE os.organization_id = $1 AND os.status IN ('trial', 'active')
      `;

      const subResult = await query(subQuery, [organizationId]);

      if (subResult.rows.length === 0) {
        return res.status(404).json({ error: 'No active subscription found' });
      }

      const subscription = subResult.rows[0];
      const usage = await this.getCurrentUsage(organizationId);

      // Calculate base cost
      let baseCost = subscription.current_price;

      // Calculate any overage costs (if applicable)
      let overageCost = 0;

      // Future enhancement: Add overage calculations here
      // based on plan limits and current usage

      const totalCost = baseCost + overageCost;

      res.json({
        subscription: {
          plan_name: subscription.plan_display_name,
          billing_cycle: subscription.billing_cycle,
          current_period_end: subscription.current_period_end
        },
        usage,
        billing_preview: {
          base_cost: baseCost,
          overage_cost: overageCost,
          total_cost: totalCost,
          currency: 'USD'
        }
      });
    } catch (error) {
      console.error('Error calculating billing preview:', error);
      res.status(500).json({ error: 'Failed to calculate billing preview' });
    }
  }
}

module.exports = new SubscriptionController();