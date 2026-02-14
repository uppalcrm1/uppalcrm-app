/**
 * Workflow Rules Engine - Scheduled Cron Job
 * Phase 3: Automatic Daily Rule Execution
 *
 * Runs all enabled workflow rules for all organizations once daily at 6:00 AM UTC.
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
 * Start the workflow cron job
 * Runs daily at 6:00 AM UTC
 */
function startWorkflowCron() {
  console.log('[Workflow Cron] Initializing daily workflow execution job...');
  console.log('[Workflow Cron] Scheduled for 06:00 UTC daily');

  // Run at 6:00 AM UTC every day
  // Cron format: minute hour day month dayOfWeek
  // 0 6 * * * = 6:00 AM every day
  cron.schedule('0 6 * * *', async () => {
    await runDailyWorkflow();
  });

  console.log('[Workflow Cron] ✅ Cron job started');
}

/**
 * Execute all enabled workflow rules for all organizations
 */
async function runDailyWorkflow() {
  const startTime = new Date();

  // Check if already running (prevent concurrent executions)
  if (isRunning) {
    console.warn('[Workflow Cron] ⚠️ Previous run still in progress, skipping this cycle');
    return;
  }

  isRunning = true;
  let totalTasksCreated = 0;
  let orgsProcessed = 0;
  let orgsWithError = 0;

  try {
    console.log('[Workflow Cron] Starting daily run...');

    // Find all organizations that have at least one enabled workflow rule
    // NOTE: run_mode column would be used here for finer control if added:
    //       AND run_mode IN ('manual_and_auto', 'auto_only')
    const orgsResult = await db.query(`
      SELECT DISTINCT organization_id
      FROM workflow_rules
      WHERE is_enabled = true
      ORDER BY organization_id;
    `);

    const organizations = orgsResult.rows;
    console.log(`[Workflow Cron] Found ${organizations.length} organizations with active rules`);

    // Execute rules for each organization
    for (const org of organizations) {
      const orgId = org.organization_id;

      try {
        // Execute all enabled rules for this organization
        const result = await workflowEngine.executeAllRules(
          orgId,
          null, // triggeredBy (no user context in cron)
          'cron' // triggerSource
        );

        // Count results
        const tasksFromThisOrg = result.ruleResults
          ? result.ruleResults.reduce((sum, r) => sum + r.tasksCreated, 0)
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

    // Log summary
    console.log('[Workflow Cron] Daily run complete.');
    console.log(`[Workflow Cron] Summary: ${orgsProcessed} orgs processed, ${totalTasksCreated} tasks created`);

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
    console.error('[Workflow Cron] ❌ Fatal error in daily workflow:', error.message);
    console.error(error.stack);
  } finally {
    isRunning = false;
  }
}

/**
 * Manual trigger for testing/admin purposes
 * Allows immediate execution outside of scheduled time
 */
async function triggerManualRun() {
  console.log('[Workflow Cron] Manual trigger requested');
  await runDailyWorkflow();
}

module.exports = {
  startWorkflowCron,
  triggerManualRun,
  isRunning: () => isRunning
};
