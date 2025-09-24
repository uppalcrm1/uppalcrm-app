/**
 * Scheduled jobs for billing automation
 */

const cron = require('node-cron');
const billingService = require('./billingService');

class ScheduledJobs {
  constructor() {
    this.jobs = new Map();
    this.isStarted = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isStarted) {
      console.log('⚠️  Scheduled jobs are already running');
      return;
    }

    console.log('🚀 Starting scheduled billing jobs...\n');

    // Job 1: Daily billing automation (runs every day at 2:00 AM)
    const dailyBilling = cron.schedule('0 2 * * *', async () => {
      console.log('\n🕐 Running daily billing automation...');
      try {
        await billingService.runBillingAutomation();
      } catch (error) {
        console.error('❌ Daily billing automation failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    // Job 2: Trial expiration notifications (runs every day at 10:00 AM)
    const trialNotifications = cron.schedule('0 10 * * *', async () => {
      console.log('\n📧 Sending trial expiration notifications...');
      try {
        await billingService.sendTrialExpirationNotifications();
      } catch (error) {
        console.error('❌ Trial notification job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    // Job 3: Monthly invoice generation (runs on the 1st of every month at 1:00 AM)
    const monthlyInvoicing = cron.schedule('0 1 1 * *', async () => {
      console.log('\n🧾 Running monthly invoice generation...');
      try {
        await billingService.generateMonthlyInvoices();
      } catch (error) {
        console.error('❌ Monthly invoicing job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    // Job 4: Grace period cleanup (runs every day at 3:00 AM)
    const gracePeriodCleanup = cron.schedule('0 3 * * *', async () => {
      console.log('\n🧹 Processing expired grace periods...');
      try {
        await billingService.processExpiredGracePeriods();
      } catch (error) {
        console.error('❌ Grace period cleanup failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    // Job 5: Automatic renewal processing (runs every hour between 9 AM and 6 PM)
    const autoRenewals = cron.schedule('0 9-18 * * *', async () => {
      console.log('\n🔄 Processing automatic renewals...');
      try {
        await billingService.processAutomaticRenewals();
      } catch (error) {
        console.error('❌ Auto renewal processing failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    // Job 6: Health check and monitoring (runs every 30 minutes)
    const healthCheck = cron.schedule('*/30 * * * *', async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, {
      scheduled: false,
      timezone: "America/New_York"
    });

    // Store jobs for management
    this.jobs.set('dailyBilling', dailyBilling);
    this.jobs.set('trialNotifications', trialNotifications);
    this.jobs.set('monthlyInvoicing', monthlyInvoicing);
    this.jobs.set('gracePeriodCleanup', gracePeriodCleanup);
    this.jobs.set('autoRenewals', autoRenewals);
    this.jobs.set('healthCheck', healthCheck);

    // Start all jobs
    this.jobs.forEach((job, name) => {
      job.start();
      console.log(`✅ Started job: ${name}`);
    });

    this.isStarted = true;
    console.log('\n🎉 All scheduled billing jobs are now running!');
    this.printSchedule();
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isStarted) {
      console.log('⚠️  Scheduled jobs are not running');
      return;
    }

    console.log('🛑 Stopping scheduled billing jobs...');

    this.jobs.forEach((job, name) => {
      job.stop();
      console.log(`✅ Stopped job: ${name}`);
    });

    this.isStarted = false;
    console.log('🎉 All scheduled billing jobs have been stopped!');
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    const status = {
      isRunning: this.isStarted,
      jobs: {}
    };

    this.jobs.forEach((job, name) => {
      status.jobs[name] = {
        running: job.running,
        scheduled: job.scheduled
      };
    });

    return status;
  }

  /**
   * Run a specific job manually
   */
  async runJob(jobName) {
    console.log(`🔧 Manually running job: ${jobName}`);

    switch (jobName) {
      case 'dailyBilling':
        await billingService.runBillingAutomation();
        break;
      case 'trialNotifications':
        await billingService.sendTrialExpirationNotifications();
        break;
      case 'monthlyInvoicing':
        await billingService.generateMonthlyInvoices();
        break;
      case 'gracePeriodCleanup':
        await billingService.processExpiredGracePeriods();
        break;
      case 'autoRenewals':
        await billingService.processAutomaticRenewals();
        break;
      case 'healthCheck':
        await this.performHealthCheck();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }

    console.log(`✅ Completed manual run of job: ${jobName}`);
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    const { query } = require('../database/connection');

    try {
      // Check database connectivity
      await query('SELECT 1');

      // Check for critical subscription states
      const criticalStates = await query(`
        SELECT
          COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count,
          COUNT(CASE WHEN status = 'suspended' THEN 1 END) as suspended_count,
          COUNT(CASE WHEN trial_ends_at < NOW() + INTERVAL '1 day' AND status = 'trial' THEN 1 END) as expiring_trials
        FROM organization_subscriptions
      `);

      const stats = criticalStates.rows[0];

      if (stats.expired_count > 10) {
        console.log(`⚠️  High number of expired subscriptions: ${stats.expired_count}`);
      }

      if (stats.suspended_count > 5) {
        console.log(`⚠️  High number of suspended subscriptions: ${stats.suspended_count}`);
      }

      if (stats.expiring_trials > 0) {
        console.log(`📅 ${stats.expiring_trials} trials expiring within 24 hours`);
      }

      // Check for failed invoices
      const failedInvoices = await query(`
        SELECT COUNT(*) as failed_count
        FROM subscription_invoices
        WHERE status = 'failed'
        AND created_at > NOW() - INTERVAL '7 days'
      `).catch(() => ({ rows: [{ failed_count: 0 }] }));

      if (failedInvoices.rows[0].failed_count > 0) {
        console.log(`⚠️  ${failedInvoices.rows[0].failed_count} failed invoices in the last 7 days`);
      }

    } catch (error) {
      console.error('❌ Health check detected issues:', error);
    }
  }

  /**
   * Print the schedule of all jobs
   */
  printSchedule() {
    console.log('\n📅 Job Schedule:');
    console.log('   🕐 Daily Billing Automation: Every day at 2:00 AM');
    console.log('   📧 Trial Notifications: Every day at 10:00 AM');
    console.log('   🧾 Monthly Invoicing: 1st of every month at 1:00 AM');
    console.log('   🧹 Grace Period Cleanup: Every day at 3:00 AM');
    console.log('   🔄 Auto Renewals: Every hour from 9 AM to 6 PM');
    console.log('   ❤️  Health Check: Every 30 minutes');
    console.log('   🌐 Timezone: America/New_York\n');
  }

  /**
   * Get next run times for all jobs
   */
  getNextRunTimes() {
    const nextRuns = {};

    this.jobs.forEach((job, name) => {
      if (job.running) {
        // This is a simplified approach since node-cron doesn't expose next run time directly
        // In a production system, you might want to use a more sophisticated scheduler
        nextRuns[name] = 'Running (check cron schedule)';
      } else {
        nextRuns[name] = 'Stopped';
      }
    });

    return nextRuns;
  }
}

// Create singleton instance
const scheduledJobs = new ScheduledJobs();

module.exports = scheduledJobs;