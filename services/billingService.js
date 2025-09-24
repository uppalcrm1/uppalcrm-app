/**
 * Billing automation service
 */

const { query } = require('../database/connection');
const crypto = require('crypto');

class BillingService {
  /**
   * Check for expired trials and update statuses
   */
  async processExpiredTrials() {
    console.log('🔍 Processing expired trials...');

    try {
      // Find trials that have expired
      const expiredTrials = await query(`
        SELECT id, organization_id, plan_name, trial_ends_at
        FROM organization_subscriptions
        WHERE status = 'trial'
        AND trial_ends_at <= NOW()
      `);

      console.log(`Found ${expiredTrials.rows.length} expired trials`);

      for (const trial of expiredTrials.rows) {
        // Update subscription status to expired
        await query(`
          UPDATE organization_subscriptions
          SET status = 'expired',
              grace_period_ends_at = NOW() + INTERVAL '7 days',
              updated_at = NOW()
          WHERE id = $1
        `, [trial.id]);

        // Log the event
        await this.logSubscriptionEvent(
          trial.organization_id,
          trial.id,
          'trial_expired',
          'Trial period expired, moved to grace period'
        );

        console.log(`✅ Expired trial for organization: ${trial.organization_id}`);
      }

      return expiredTrials.rows.length;
    } catch (error) {
      console.error('❌ Error processing expired trials:', error);
      throw error;
    }
  }

  /**
   * Process grace period expirations
   */
  async processExpiredGracePeriods() {
    console.log('🔍 Processing expired grace periods...');

    try {
      // Find grace periods that have expired
      const expiredGrace = await query(`
        SELECT id, organization_id, plan_name, grace_period_ends_at
        FROM organization_subscriptions
        WHERE status = 'expired'
        AND grace_period_ends_at <= NOW()
      `);

      console.log(`Found ${expiredGrace.rows.length} expired grace periods`);

      for (const subscription of expiredGrace.rows) {
        // Update subscription status to suspended
        await query(`
          UPDATE organization_subscriptions
          SET status = 'suspended',
              updated_at = NOW()
          WHERE id = $1
        `, [subscription.id]);

        // Log the event
        await this.logSubscriptionEvent(
          subscription.organization_id,
          subscription.id,
          'grace_period_expired',
          'Grace period expired, subscription suspended'
        );

        console.log(`✅ Suspended subscription for organization: ${subscription.organization_id}`);
      }

      return expiredGrace.rows.length;
    } catch (error) {
      console.error('❌ Error processing expired grace periods:', error);
      throw error;
    }
  }

  /**
   * Generate invoices for active subscriptions
   */
  async generateMonthlyInvoices() {
    console.log('🧾 Generating monthly invoices...');

    try {
      // Find active subscriptions due for billing
      const dueBilling = await query(`
        SELECT
          os.id,
          os.organization_id,
          os.plan_name,
          os.billing_cycle,
          os.price_per_month,
          os.next_billing_date,
          o.name as organization_name,
          sp.monthly_price as plan_monthly_price,
          sp.max_users as plan_max_users
        FROM organization_subscriptions os
        JOIN organizations o ON o.id = os.organization_id
        LEFT JOIN subscription_plans sp ON sp.name = os.plan_name
        WHERE os.status = 'active'
        AND os.next_billing_date <= NOW()
        AND os.billing_cycle = 'monthly'
      `);

      console.log(`Found ${dueBilling.rows.length} subscriptions due for billing`);

      for (const subscription of dueBilling.rows) {
        await this.createInvoice(subscription);
      }

      return dueBilling.rows.length;
    } catch (error) {
      console.error('❌ Error generating invoices:', error);
      throw error;
    }
  }

  /**
   * Create an invoice for a subscription
   */
  async createInvoice(subscription) {
    try {
      const invoiceId = crypto.randomUUID();
      const invoiceNumber = await this.generateInvoiceNumber();
      const periodStart = new Date(subscription.next_billing_date);
      const periodEnd = new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Calculate usage and overages
      const usage = await this.calculateUsage(subscription.organization_id, periodStart);
      const baseAmount = subscription.plan_monthly_price || subscription.price_per_month * 100; // convert to cents
      const overageAmount = await this.calculateOverages(subscription, usage);
      const totalAmount = baseAmount + overageAmount;

      // Create line items
      const lineItems = [
        {
          description: `${subscription.plan_name} plan - Monthly subscription`,
          quantity: 1,
          unit_price: baseAmount,
          total: baseAmount
        }
      ];

      if (overageAmount > 0) {
        lineItems.push({
          description: 'Usage overages',
          quantity: 1,
          unit_price: overageAmount,
          total: overageAmount
        });
      }

      // Insert invoice record
      await query(`
        INSERT INTO subscription_invoices (
          id, organization_id, subscription_id, invoice_number,
          status, period_start, period_end,
          subtotal, total_amount, amount_due,
          line_items, due_date, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'draft', $5, $6, $7, $8, $9, $10, $11, NOW(), NOW()
        )
      `, [
        invoiceId,
        subscription.organization_id,
        subscription.id,
        invoiceNumber,
        periodStart,
        periodEnd,
        totalAmount,
        totalAmount,
        totalAmount,
        JSON.stringify(lineItems),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      ]);

      // Update subscription next billing date
      const nextBillingDate = new Date(periodEnd.getTime() + 1); // day after period ends
      await query(`
        UPDATE organization_subscriptions
        SET next_billing_date = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [nextBillingDate, subscription.id]);

      // Log the event
      await this.logSubscriptionEvent(
        subscription.organization_id,
        subscription.id,
        'invoice_generated',
        `Invoice ${invoiceNumber} generated for $${(totalAmount / 100).toFixed(2)}`
      );

      console.log(`✅ Created invoice ${invoiceNumber} for ${subscription.organization_name}`);
      return invoiceId;

    } catch (error) {
      console.error(`❌ Error creating invoice for subscription ${subscription.id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate usage for a billing period
   */
  async calculateUsage(organizationId, periodStart) {
    try {
      const usage = await query(`
        SELECT
          (SELECT COUNT(*) FROM users WHERE organization_id = $1 AND is_active = TRUE) as active_users,
          (SELECT COUNT(*) FROM contacts WHERE organization_id = $1) as total_contacts,
          (SELECT COUNT(*) FROM leads WHERE organization_id = $1) as total_leads
      `, [organizationId]);

      return usage.rows[0];
    } catch (error) {
      console.error('❌ Error calculating usage:', error);
      return { active_users: 0, total_contacts: 0, total_leads: 0 };
    }
  }

  /**
   * Calculate overage charges
   */
  async calculateOverages(subscription, usage) {
    try {
      // Get plan limits
      const planLimits = await query(`
        SELECT max_users, max_contacts, max_leads
        FROM subscription_plans
        WHERE name = $1
      `, [subscription.plan_name]);

      if (planLimits.rows.length === 0) {
        return 0; // No plan found, no overages
      }

      const limits = planLimits.rows[0];
      let overageAmount = 0;

      // Calculate user overages (if plan has limits)
      if (limits.max_users && usage.active_users > limits.max_users) {
        const userOverage = usage.active_users - limits.max_users;
        overageAmount += userOverage * 500; // $5 per extra user in cents
      }

      // Calculate contact overages (if plan has limits)
      if (limits.max_contacts && usage.total_contacts > limits.max_contacts) {
        const contactOverage = usage.total_contacts - limits.max_contacts;
        overageAmount += Math.ceil(contactOverage / 100) * 100; // $1 per 100 extra contacts
      }

      // Calculate lead overages (if plan has limits)
      if (limits.max_leads && usage.total_leads > limits.max_leads) {
        const leadOverage = usage.total_leads - limits.max_leads;
        overageAmount += Math.ceil(leadOverage / 50) * 50; // $0.50 per 50 extra leads
      }

      return overageAmount;
    } catch (error) {
      console.error('❌ Error calculating overages:', error);
      return 0;
    }
  }

  /**
   * Generate unique invoice number
   */
  async generateInvoiceNumber() {
    try {
      const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');

      const lastInvoice = await query(`
        SELECT invoice_number
        FROM subscription_invoices
        WHERE invoice_number LIKE $1
        ORDER BY invoice_number DESC
        LIMIT 1
      `, [`INV-${yearMonth}%`]);

      let sequence = 1;
      if (lastInvoice.rows.length > 0) {
        const lastNumber = lastInvoice.rows[0].invoice_number;
        const lastSequence = parseInt(lastNumber.split('-')[1].slice(6));
        sequence = lastSequence + 1;
      }

      return `INV-${yearMonth}${sequence.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('❌ Error generating invoice number:', error);
      return `INV-${Date.now()}`;
    }
  }

  /**
   * Send trial expiration notifications
   */
  async sendTrialExpirationNotifications() {
    const emailService = require('./emailService');

    try {
      const sentCount = await emailService.sendTrialExpirationNotifications();
      return sentCount;
    } catch (error) {
      console.error('❌ Error sending trial notifications:', error);
      throw error;
    }
  }

  /**
   * Process automatic renewals
   */
  async processAutomaticRenewals() {
    console.log('🔄 Processing automatic renewals...');

    try {
      // Find subscriptions due for renewal
      const dueRenewals = await query(`
        SELECT
          os.id,
          os.organization_id,
          os.plan_name,
          os.payment_method_id,
          os.price_per_month,
          si.id as invoice_id,
          si.total_amount
        FROM organization_subscriptions os
        JOIN subscription_invoices si ON si.subscription_id = os.id
        WHERE os.status = 'active'
        AND si.status = 'draft'
        AND si.due_date <= NOW()
        AND os.payment_method_id IS NOT NULL
      `);

      console.log(`Found ${dueRenewals.rows.length} renewals to process`);

      for (const renewal of dueRenewals.rows) {
        // In a real implementation, you would process payment here
        // For now, we'll simulate successful payment
        const success = Math.random() > 0.1; // 90% success rate for simulation

        if (success) {
          // Mark invoice as paid
          await query(`
            UPDATE subscription_invoices
            SET status = 'paid',
                payment_date = NOW(),
                amount_paid = total_amount,
                amount_due = 0,
                payment_method = 'auto_renewal',
                updated_at = NOW()
            WHERE id = $1
          `, [renewal.invoice_id]);

          // Log successful payment
          await this.logSubscriptionEvent(
            renewal.organization_id,
            renewal.id,
            'payment_successful',
            `Automatic renewal payment processed: $${(renewal.total_amount / 100).toFixed(2)}`
          );

          console.log(`✅ Processed renewal for organization: ${renewal.organization_id}`);
        } else {
          // Mark invoice as failed
          await query(`
            UPDATE subscription_invoices
            SET status = 'failed',
                updated_at = NOW()
            WHERE id = $1
          `, [renewal.invoice_id]);

          // Update subscription to expired status
          await query(`
            UPDATE organization_subscriptions
            SET status = 'expired',
                grace_period_ends_at = NOW() + INTERVAL '7 days',
                updated_at = NOW()
            WHERE id = $1
          `, [renewal.id]);

          // Log failed payment
          await this.logSubscriptionEvent(
            renewal.organization_id,
            renewal.id,
            'payment_failed',
            'Automatic renewal payment failed, subscription moved to grace period'
          );

          console.log(`❌ Failed renewal for organization: ${renewal.organization_id}`);
        }
      }

      return dueRenewals.rows.length;
    } catch (error) {
      console.error('❌ Error processing renewals:', error);
      throw error;
    }
  }

  /**
   * Log subscription events
   */
  async logSubscriptionEvent(organizationId, subscriptionId, eventType, description) {
    try {
      await query(`
        INSERT INTO subscription_events (
          organization_id, subscription_id, event_type, description, created_at
        ) VALUES ($1, $2, $3, $4, NOW())
      `, [organizationId, subscriptionId, eventType, description]);
    } catch (error) {
      // Fail silently if events table doesn't exist
      console.log(`⚠️  Could not log event: ${error.message}`);
    }
  }

  /**
   * Run all billing automation tasks
   */
  async runBillingAutomation() {
    console.log('🤖 Starting billing automation run...\n');

    try {
      const results = {
        expiredTrials: await this.processExpiredTrials(),
        expiredGracePeriods: await this.processExpiredGracePeriods(),
        generatedInvoices: await this.generateMonthlyInvoices(),
        sentNotifications: await this.sendTrialExpirationNotifications(),
        processedRenewals: await this.processAutomaticRenewals()
      };

      console.log('\n🎉 Billing automation completed!');
      console.log('📊 Summary:');
      console.log(`   🔄 Expired trials: ${results.expiredTrials}`);
      console.log(`   ⏰ Expired grace periods: ${results.expiredGracePeriods}`);
      console.log(`   🧾 Generated invoices: ${results.generatedInvoices}`);
      console.log(`   📧 Sent notifications: ${results.sentNotifications}`);
      console.log(`   💳 Processed renewals: ${results.processedRenewals}`);

      return results;
    } catch (error) {
      console.error('❌ Billing automation failed:', error);
      throw error;
    }
  }
}

module.exports = new BillingService();