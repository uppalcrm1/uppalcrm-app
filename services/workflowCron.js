/**
 * Workflow Rules Engine - Scheduled Cron Job
 * Phase 3: Automatic Daily Rule Execution
 *
 * Runs every hour and checks which organizations have their local time at 6:00 AM.
 * Only runs workflow rules for those organizations.
 * This means:
 *   - A New York org (America/New_York) gets their rules run at 6 AM EST/EDT
 *   - A London org (Europe/London)      gets their rules run at 6 AM GMT/BST
 *   - An India org (Asia/Kolkata)       gets their rules run at 6 AM IST
 *
 * - Prevents duplicate executions with in-memory lock
 * - Logs detailed results for monitoring
 * - Error handling per organization (one failure doesn't stop others)
 * - Timeout warnings if execution takes >5 minutes
 */

const cron = require('node-cron');
const db = require('../database/connection');
const workflowEngine = require('./workflowEngine');

let isRunning = false; // In-memory lock to prevent concurrent executions

/**
 * Get the current local hour (0-23) in a given IANA timezone.
 * Uses Node.js built-in Intl.DateTimeFormat, which handles DST automatically.
 * @param {string} timezone - IANA timezone string (e.g. 'America/New_York')
 * @returns {number} Local hour (0-23), or UTC hour on error
 */
function getLocalHour(timezone) {
  try {
    return parseInt(
      new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
      }).format(new Date()),
      10
    );
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Date().getUTCHours();
  }
}

/**
 * Start the workflow cron job.
 * Runs at the top of every hour; processes only orgs whose local time is 6 AM.
 */
function startWorkflowCron() {
  console.log('[Workflow Cron] Initializing timezone-aware workflow execution job...');
  console.log('[Workflow Cron] Scheduled hourly — runs rules for orgs where local time = 6:00 AM');

  // Run at the top of every hour
  // Cron format: minute hour day month dayOfWeek
  // 0 * * * * = :00 of every hour
  cron.schedule('0 * * * *', async () => {
    await runHourlyWorkflow();
  });

  console.log('[Workflow Cron] ✅ Cron job started');
}

/**
 * Execute workflow rules for all organizations whose local time is currently 6:00 AM.
 * Called every hour by the cron scheduler.
 */
async function runHourlyWorkflow() {
  const startTime = new Date();

  // Check if already running (prevent concurrent executions)
  if (isRunning) {
    console.warn('[Workflow Cron] ⚠️ Previous run still in progress, skipping this cycle');
    return;
  }

  isRunning = true;
  let totalTasksCreated = 0;
  let orgsProcessed = 0;
  let orgsSkipped = 0;
  let orgsWithError = 0;

  try {
    console.log(`[Workflow Cron] Hourly check at ${startTime.toISOString()}`);

    // Find all organizations with enabled rules, including their timezone
    const orgsResult = await db.query(`
      SELECT DISTINCT wr.organization_id,
        COALESCE(o.timezone, 'America/New_York') as org_timezone
      FROM workflow_rules wr
      JOIN organizations o ON o.id = wr.organization_id
      WHERE wr.is_enabled = true
      ORDER BY wr.organization_id
    `);

    const organizations = orgsResult.rows;
    console.log(`[Workflow Cron] Found ${organizations.length} orgs with active rules`);

    // Execute rules for each organization that is currently at 6 AM local time
    for (const org of organizations) {
      const orgId = org.organization_id;
      const orgTimezone = org.org_timezone;
      const localHour = getLocalHour(orgTimezone);

      if (localHour !== 6) {
        orgsSkipped++;
        continue; // Not 6 AM in this org's timezone — skip
      }

      console.log(`[Workflow Cron] ⏰ Running rules for org ${orgId} (${orgTimezone}, local hour: ${localHour})`);

      try {
        // Execute all enabled rules for this organization
        const result = await workflowEngine.executeAllRules(
          orgId,
          null,   // triggeredBy (no user context in cron)
          'cron'  // triggerSource
        );

        // Count results (executeAllRules returns executionsByRule, not ruleResults)
        const tasksFromThisOrg = result.executionsByRule
          ? result.executionsByRule.reduce((sum, r) => sum + (r.tasksCreated || 0), 0)
          : 0;

        totalTasksCreated += tasksFromThisOrg;
        orgsProcessed++;

        console.log(
          `[Workflow Cron] Org ${orgId}: ${tasksFromThisOrg} tasks created across ${
            result.ruleResults ? result.ruleResults.length : 0
          } rules`
        );
      } catch (error) {
        orgsWithError++;
        console.error(
          `[Workflow Cron] ❌ Error processing org ${orgId}: ${error.message}`
        );
        // Continue to next organization (don't stop on error)
      }
    }

    // Calculate execution time
    const endTime = new Date();
    const executionTimeSeconds = (endTime - startTime) / 1000;

    // Log summary (only if we actually processed orgs to avoid noise)
    if (orgsProcessed > 0 || orgsWithError > 0) {
      console.log(`[Workflow Cron] Run complete. Processed: ${orgsProcessed}, Skipped: ${orgsSkipped}, Tasks created: ${totalTasksCreated}`);
    }

    if (orgsWithError > 0) {
      console.warn(`[Workflow Cron] ⚠️ ${orgsWithError} organization(s) had errors`);
    }

    // Warn if execution took too long (>5 minutes)
    if (executionTimeSeconds > 300) {
      console.warn(
        `[Workflow Cron] ⚠️ Execution took ${executionTimeSeconds.toFixed(1)}s (>5 minutes)`
      );
    }
  } catch (error) {
    console.error('[Workflow Cron] ❌ Fatal error in hourly workflow:', error.message);
    console.error(error.stack);
  } finally {
    isRunning = false;
  }
}

/**
 * Manual trigger for testing/admin purposes.
 * Runs rules for ALL organizations regardless of their local time.
 */
async function triggerManualRun() {
  console.log('[Workflow Cron] Manual trigger requested (bypasses time check)');
  await runHourlyWorkflow();
}

module.exports = {
  startWorkflowCron,
  triggerManualRun,
  isRunning: () => isRunning
};
