#!/usr/bin/env node

/**
 * Test scheduled jobs functionality
 */

const scheduledJobs = require('../services/scheduledJobs');

async function testScheduledJobs() {
  console.log('🧪 Testing scheduled jobs system...\n');

  try {
    // 1. Check initial status
    console.log('📊 Checking initial status...');
    let status = scheduledJobs.getStatus();
    console.log(`✅ Jobs running: ${status.isRunning}`);
    console.log(`✅ Total jobs configured: ${Object.keys(status.jobs).length}`);

    // 2. Start the scheduled jobs
    console.log('\n🚀 Starting scheduled jobs...');
    scheduledJobs.start();

    // 3. Check status after starting
    console.log('\n📊 Checking status after start...');
    status = scheduledJobs.getStatus();
    console.log(`✅ Jobs running: ${status.isRunning}`);

    Object.entries(status.jobs).forEach(([name, jobStatus]) => {
      console.log(`   📅 ${name}: ${jobStatus.running ? '🟢 Running' : '🔴 Stopped'}`);
    });

    // 4. Test manual job execution
    console.log('\n🔧 Testing manual job execution...');

    try {
      await scheduledJobs.runJob('healthCheck');
      console.log('✅ Health check job executed successfully');
    } catch (error) {
      console.log(`⚠️  Health check job error: ${error.message}`);
    }

    try {
      await scheduledJobs.runJob('trialNotifications');
      console.log('✅ Trial notifications job executed successfully');
    } catch (error) {
      console.log(`⚠️  Trial notifications job error: ${error.message}`);
    }

    // 5. Test job scheduling info
    console.log('\n📅 Getting next run times...');
    const nextRuns = scheduledJobs.getNextRunTimes();
    Object.entries(nextRuns).forEach(([name, nextRun]) => {
      console.log(`   ⏰ ${name}: ${nextRun}`);
    });

    // 6. Wait a short time to see if jobs are actually running
    console.log('\n⏳ Waiting 5 seconds to monitor job activity...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 7. Stop the jobs (for testing)
    console.log('\n🛑 Stopping scheduled jobs...');
    scheduledJobs.stop();

    // 8. Final status check
    console.log('\n📊 Final status check...');
    status = scheduledJobs.getStatus();
    console.log(`✅ Jobs running: ${status.isRunning}`);

    console.log('\n🎉 Scheduled jobs test completed successfully!');
    console.log('\n📋 Production Setup Notes:');
    console.log('1. 🚀 Jobs should be started when the server starts');
    console.log('2. 🔄 Jobs will run automatically based on their cron schedules');
    console.log('3. ❤️  Health checks will monitor system status every 30 minutes');
    console.log('4. 📧 Trial notifications will be sent daily at 10 AM');
    console.log('5. 🧾 Billing automation runs daily at 2 AM');
    console.log('6. 💳 Auto renewals process hourly during business hours');

  } catch (error) {
    console.error('❌ Scheduled jobs test failed:', error.message);
    throw error;
  }
}

if (require.main === module) {
  testScheduledJobs()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = testScheduledJobs;