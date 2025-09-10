const { query, transaction } = require('../database/connection');

class Trial {
  constructor(data = {}) {
    this.id = data.id;
    this.organization_id = data.organization_id;
    this.trial_started_at = data.trial_started_at;
    this.trial_ends_at = data.trial_ends_at;
    this.trial_status = data.trial_status;
    this.trial_days = data.trial_days;
    this.payment_status = data.payment_status;
    this.subscription_ends_at = data.subscription_ends_at;
    this.grace_period_ends_at = data.grace_period_ends_at;
    this.total_trial_count = data.total_trial_count;
    this.last_trial_at = data.last_trial_at;
  }

  /**
   * Get trial status for organization
   */
  static async getTrialStatus(organizationId) {
    try {
      const result = await query(`
        SELECT 
          o.id,
          o.name,
          o.trial_started_at,
          o.trial_ends_at,
          o.trial_status,
          o.trial_days,
          o.payment_status,
          o.subscription_ends_at,
          o.grace_period_ends_at,
          o.total_trial_count,
          o.last_trial_at,
          o.is_active,
          CASE 
            WHEN o.trial_ends_at IS NOT NULL AND o.trial_ends_at > NOW() 
            THEN EXTRACT(DAY FROM o.trial_ends_at - NOW())::INTEGER
            ELSE 0
          END as days_remaining,
          CASE 
            WHEN o.trial_ends_at IS NOT NULL AND o.trial_ends_at > NOW() 
            THEN EXTRACT(EPOCH FROM o.trial_ends_at - NOW())::INTEGER
            ELSE 0
          END as seconds_remaining
        FROM organizations o
        WHERE o.id = $1
      `, [organizationId], organizationId);

      if (result.rows.length === 0) {
        return null;
      }

      const trialData = result.rows[0];
      
      // Calculate additional trial metrics
      const trialInfo = {
        ...trialData,
        is_trial_active: trialData.trial_status === 'active',
        is_trial_expired: trialData.trial_status === 'expired',
        has_never_trialed: trialData.trial_status === 'never_started',
        can_extend_trial: trialData.trial_status === 'active' && trialData.days_remaining <= 3,
        trial_progress_percentage: trialData.trial_days > 0 ? 
          Math.max(0, Math.min(100, ((trialData.trial_days - trialData.days_remaining) / trialData.trial_days) * 100)) : 0
      };

      return trialInfo;
    } catch (error) {
      console.error('Error getting trial status:', error);
      throw new Error('Failed to get trial status');
    }
  }

  /**
   * Check if organization can start a new trial
   */
  static async canStartTrial(organizationId) {
    try {
      const result = await query(`
        SELECT can_start_new_trial($1) as can_start
      `, [organizationId], organizationId);

      return result.rows[0].can_start;
    } catch (error) {
      console.error('Error checking trial eligibility:', error);
      throw new Error('Failed to check trial eligibility');
    }
  }

  /**
   * Start a new trial for organization
   */
  static async startTrial(organizationId, trialDays = 30) {
    try {
      // Check if can start trial
      const canStart = await this.canStartTrial(organizationId);
      if (!canStart) {
        throw new Error('Organization is not eligible to start a trial');
      }

      const result = await query(`
        SELECT start_organization_trial($1, $2) as success
      `, [organizationId, trialDays], organizationId);

      if (!result.rows[0].success) {
        throw new Error('Failed to start trial');
      }

      // Return updated trial status
      return await this.getTrialStatus(organizationId);
    } catch (error) {
      console.error('Error starting trial:', error);
      throw error;
    }
  }

  /**
   * Extend trial by specified days
   */
  static async extendTrial(organizationId, additionalDays) {
    try {
      const trialStatus = await this.getTrialStatus(organizationId);
      if (!trialStatus || !trialStatus.is_trial_active) {
        throw new Error('No active trial to extend');
      }

      const result = await query(`
        UPDATE organizations 
        SET 
          trial_ends_at = trial_ends_at + make_interval(days => $2),
          trial_days = trial_days + $2,
          updated_at = NOW()
        WHERE id = $1
        RETURNING trial_ends_at, trial_days
      `, [organizationId, additionalDays], organizationId);

      if (result.rows.length === 0) {
        throw new Error('Organization not found');
      }

      // Update subscription record
      await query(`
        UPDATE organization_subscriptions 
        SET trial_ends_at = $2, updated_at = NOW()
        WHERE organization_id = $1 AND status = 'trial'
      `, [organizationId, result.rows[0].trial_ends_at], organizationId);

      return await this.getTrialStatus(organizationId);
    } catch (error) {
      console.error('Error extending trial:', error);
      throw error;
    }
  }

  /**
   * Convert trial to paid subscription
   */
  static async convertTrial(organizationId, paymentData) {
    return await transaction(async (client) => {
      try {
        // Update organization
        await client.query(`
          UPDATE organizations 
          SET 
            trial_status = 'converted',
            payment_status = 'active',
            subscription_ends_at = NOW() + interval '1 month',
            is_active = true,
            updated_at = NOW()
          WHERE id = $1
        `, [organizationId]);

        // Update subscription
        await client.query(`
          UPDATE organization_subscriptions 
          SET 
            status = 'active',
            subscription_started_at = NOW(),
            subscription_ends_at = NOW() + interval '1 month',
            next_billing_date = NOW() + interval '1 month',
            last_payment_at = NOW(),
            last_payment_amount = price_per_month,
            payment_method_id = $2,
            payment_processor = $3,
            updated_at = NOW()
          WHERE organization_id = $1 AND status = 'trial'
        `, [organizationId, paymentData.payment_method_id, paymentData.payment_processor || 'stripe']);

        // Update trial history
        await client.query(`
          UPDATE organization_trial_history 
          SET 
            trial_outcome = 'converted',
            converted_at = NOW()
          WHERE organization_id = $1 AND trial_outcome = 'active'
        `, [organizationId]);

        return await this.getTrialStatus(organizationId);
      } catch (error) {
        console.error('Error converting trial:', error);
        throw error;
      }
    });
  }

  /**
   * Cancel trial
   */
  static async cancelTrial(organizationId, reason = null) {
    try {
      await query(`
        UPDATE organizations 
        SET 
          trial_status = 'cancelled',
          payment_status = 'cancelled',
          is_active = false,
          updated_at = NOW()
        WHERE id = $1
      `, [organizationId], organizationId);

      // Update subscription
      await query(`
        UPDATE organization_subscriptions 
        SET status = 'cancelled', updated_at = NOW()
        WHERE organization_id = $1 AND status IN ('trial', 'active')
      `, [organizationId], organizationId);

      // Update trial history
      await query(`
        UPDATE organization_trial_history 
        SET trial_outcome = 'cancelled'
        WHERE organization_id = $1 AND trial_outcome = 'active'
      `, [organizationId], organizationId);

      return await this.getTrialStatus(organizationId);
    } catch (error) {
      console.error('Error cancelling trial:', error);
      throw error;
    }
  }

  /**
   * Get trial history for organization
   */
  static async getTrialHistory(organizationId) {
    try {
      const result = await query(`
        SELECT 
          h.*,
          s.plan_name,
          s.price_per_month,
          s.billing_cycle
        FROM organization_trial_history h
        LEFT JOIN organization_subscriptions s ON s.organization_id = h.organization_id
        WHERE h.organization_id = $1
        ORDER BY h.trial_start_date DESC
      `, [organizationId], organizationId);

      return result.rows;
    } catch (error) {
      console.error('Error getting trial history:', error);
      throw new Error('Failed to get trial history');
    }
  }

  /**
   * Get subscription details
   */
  static async getSubscription(organizationId) {
    try {
      const result = await query(`
        SELECT 
          s.*,
          CASE 
            WHEN s.next_billing_date IS NOT NULL AND s.next_billing_date > NOW() 
            THEN EXTRACT(DAY FROM s.next_billing_date - NOW())::INTEGER
            ELSE 0
          END as days_until_billing
        FROM organization_subscriptions s
        WHERE s.organization_id = $1
        ORDER BY s.created_at DESC
        LIMIT 1
      `, [organizationId], organizationId);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting subscription:', error);
      throw new Error('Failed to get subscription details');
    }
  }

  /**
   * Expire trials (admin function)
   */
  static async expireTrials() {
    try {
      const result = await query(`SELECT expire_trials() as expired_count`);
      return result.rows[0].expired_count;
    } catch (error) {
      console.error('Error expiring trials:', error);
      throw new Error('Failed to expire trials');
    }
  }

  /**
   * Get all organizations with trial data (admin function)
   */
  static async getTrialOrganizations() {
    try {
      const result = await query(`
        SELECT 
          o.id,
          o.name,
          o.slug,
          o.created_at,
          o.trial_started_at,
          o.trial_ends_at,
          o.trial_status,
          o.trial_days,
          o.payment_status,
          o.subscription_ends_at,
          o.grace_period_ends_at,
          o.total_trial_count,
          o.last_trial_at,
          o.is_active,
          CASE 
            WHEN o.trial_ends_at IS NOT NULL AND o.trial_ends_at > NOW() 
            THEN EXTRACT(DAY FROM o.trial_ends_at - NOW())::INTEGER
            ELSE 0
          END as days_remaining,
          s.plan_name,
          s.billing_cycle,
          s.price_per_month,
          s.last_payment_amount,
          s.last_payment_at,
          s.next_billing_date,
          (SELECT COUNT(*) FROM users WHERE organization_id = o.id AND is_active = true) as user_count
        FROM organizations o
        LEFT JOIN organization_subscriptions s ON s.organization_id = o.id
        WHERE o.trial_status IS NOT NULL
        ORDER BY 
          CASE o.trial_status
            WHEN 'active' THEN 1
            WHEN 'expired' THEN 2
            WHEN 'converted' THEN 3
            WHEN 'cancelled' THEN 4
            ELSE 5
          END,
          o.trial_ends_at ASC NULLS LAST,
          o.created_at DESC
      `);

      return result.rows;
    } catch (error) {
      console.error('Error getting trial organizations:', error);
      throw new Error('Failed to get trial organizations');
    }
  }

  /**
   * Get trial statistics (admin function)
   */
  static async getTrialStatistics() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_organizations,
          COUNT(CASE WHEN trial_status = 'active' THEN 1 END) as active_trials,
          COUNT(CASE WHEN trial_status = 'expired' THEN 1 END) as expired_trials,
          COUNT(CASE WHEN trial_status = 'converted' THEN 1 END) as converted_trials,
          COUNT(CASE WHEN trial_status = 'cancelled' THEN 1 END) as cancelled_trials,
          COUNT(CASE WHEN trial_status = 'never_started' THEN 1 END) as never_started,
          ROUND(
            COUNT(CASE WHEN trial_status = 'converted' THEN 1 END)::DECIMAL / 
            NULLIF(COUNT(CASE WHEN trial_status IN ('converted', 'expired', 'cancelled') THEN 1 END), 0) * 100, 2
          ) as conversion_rate,
          AVG(total_trial_count) as avg_trials_per_org
        FROM organizations
      `);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting trial statistics:', error);
      throw new Error('Failed to get trial statistics');
    }
  }
}

module.exports = Trial;