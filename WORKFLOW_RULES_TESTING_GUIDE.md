# Workflow Rules Engine - Testing Guide & Deployment Status

## Current Status: ✅ Code Complete, ⏳ Deployment Pending

### Summary

**Phase 1 (Database Schema)**: ✅ COMPLETE
- Migration 042 deployed to all three environments (DevTest, Staging, Production)
- All tables, indexes, RLS policies, and constraints verified

**Phase 2 (Backend Engine & API Routes)**: ✅ CODE COMPLETE
- `services/workflowEngine.js` - Full implementation with executeRule() and executeAllRules()
- `routes/workflowRules.js` - All 8 API endpoints implemented
- Routes registered in `server.js`
- Code committed to `devtest` branch as commit `0ef9a61`

**Deployment Status**: ⏳ PENDING
- Code is committed and pushed to origin/devtest
- Render automatic deployment is likely in progress or pending
- DevTest API at `https://uppalcrm-api-devtest.onrender.com` hasn't received the new code yet
- `/api/workflow-rules` endpoint currently returns 404: "Endpoint not found"

---

## Testing Instructions

### Prerequisites

1. **DevTest API Deployment**
   - Monitor Render dashboard for DevTest deployment status
   - Once `/api/workflow-rules` endpoint is available, proceed to Step 2

2. **Verify Deployment**
   ```bash
   curl https://uppalcrm-api-devtest.onrender.com/api | grep workflow-rules
   ```
   - Should show workflow-rules endpoints in available_endpoints list

### Step 1: Login to DevTest

```bash
curl -X POST https://uppalcrm-api-devtest.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@staging.uppalcrm.com",
    "password": "staging123"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {...}
}
```

### Step 2: Create a Test Rule (30-Day Renewal Trigger)

```bash
curl -X POST https://uppalcrm-api-devtest.onrender.com/api/workflow-rules \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{
    "name": "Test Renewal Rule - 30 Days",
    "description": "Integration test rule",
    "trigger_type": "renewal_within_days",
    "trigger_conditions": {"days": 30},
    "action_config": {
      "subject_template": "🔄 Renewal: {{contact_name}} - {{account_name}}",
      "description_template": "Account {{account_name}} renewal due on {{renewal_date}}. {{days_remaining}} days remaining.",
      "priority": "auto",
      "days_before_due": 7,
      "assignee_strategy": "account_owner"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "rule-uuid-here",
    "name": "Test Renewal Rule - 30 Days",
    "is_enabled": true,
    "prevent_duplicates": true,
    ...
  }
}
```

### Step 3: Execute Rule - First Execution

```bash
curl -X POST https://uppalcrm-api-devtest.onrender.com/api/workflow-rules/<RULE_ID>/execute \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Results:**
- `recordsEvaluated`: Number of accounts in organization
- `recordsMatched`: Accounts with renewal_date between today and today+30 days
- `tasksCreated`: Number of tasks created (should be > 0 if matches found)
- `recordsSkippedDuplicate`: 0 (first execution)
- `status`: "success"

**Sample Output:**
```json
{
  "success": true,
  "data": {
    "recordsEvaluated": 245,
    "recordsMatched": 8,
    "tasksCreated": 8,
    "recordsSkippedDuplicate": 0,
    "status": "success",
    "executionTimeMs": 1234,
    "details": [
      {
        "account_id": "uuid",
        "account_name": "Example Corp",
        "contact_name": "John Doe",
        "task_subject": "🔄 Renewal: John Doe - Example Corp",
        "task_id": "uuid",
        "priority": "high",
        "days_remaining": 15
      },
      ...
    ]
  }
}
```

### Step 4: Execute Rule - Second Execution (Duplicate Prevention Test)

```bash
curl -X POST https://uppalcrm-api-devtest.onrender.com/api/workflow-rules/<RULE_ID>/execute \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Results:**
- `recordsEvaluated`: Same as first execution
- `recordsMatched`: Same as first execution (8 in example)
- `tasksCreated`: 0 (duplicate prevention working)
- `recordsSkippedDuplicate`: 8 (same accounts as first execution)
- `status`: "success"

**This proves:**
✅ Duplicate prevention is working correctly
✅ No duplicate tasks created
✅ Same accounts identified on re-execution

### Step 5: View Execution Logs

```bash
curl -X GET "https://uppalcrm-api-devtest.onrender.com/api/workflow-rules/<RULE_ID>/logs?limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Response:**
- Array with 2+ log entries
- Each showing: run_at, records_evaluated, records_matched, tasks_created, records_skipped_duplicate
- Details array with task information

**Sample Output:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "run_at": "2026-02-14T04:15:00.000Z",
        "records_evaluated": 245,
        "records_matched": 8,
        "tasks_created": 0,
        "records_skipped_duplicate": 8,
        "status": "success",
        "details": [...]
      },
      {
        "id": "log-uuid",
        "run_at": "2026-02-14T04:13:00.000Z",
        "records_evaluated": 245,
        "records_matched": 8,
        "tasks_created": 8,
        "records_skipped_duplicate": 0,
        "status": "success",
        "details": [
          {
            "account_id": "uuid",
            "account_name": "Example Corp",
            "contact_name": "John Doe",
            "task_subject": "🔄 Renewal: John Doe - Example Corp",
            "priority": "high",
            "days_remaining": 15,
            "task_id": "uuid"
          },
          ...
        ]
      }
    ]
  }
}
```

### Step 6: Cleanup - Delete Test Rule

```bash
curl -X DELETE https://uppalcrm-api-devtest.onrender.com/api/workflow-rules/<RULE_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Workflow rule deleted successfully"
}
```

---

## Automated Testing Script

A ready-to-run test script has been created: `run_devtest_api_test.js`

**Usage:**
```bash
npm install  # If not already done
node run_devtest_api_test.js
```

**What it does:**
1. Logs in with admin credentials
2. Creates a test rule with 30-day renewal trigger
3. Executes rule first time (creates tasks)
4. Executes rule second time (tests duplicate prevention)
5. Retrieves and displays execution logs
6. Deletes test rule (cleanup)

**Expected Output:**
```
==========================================================================================
  DEVTEST WORKFLOW RULES ENGINE - API INTEGRATION TEST
==========================================================================================

✅ ALL TESTS COMPLETED SUCCESSFULLY!

Key Findings:
  ✓ Rule created with ID: <uuid>
  ✓ First execution: 8 tasks created
  ✓ Second execution: 0 tasks created (duplicate prevention active)
  ✓ Execution logs verified (showing 2+ entries)
  ✓ Test rule deleted (cleanup complete)

🎉 Workflow Rules Engine is fully functional on DevTest!
```

---

## Database Schema Summary

### workflow_rules Table (16 columns)
- Core rule configuration
- JSONB fields: `trigger_conditions`, `action_config`
- RLS isolation by organization_id
- Support for future trigger types and actions

### workflow_rule_logs Table (14 columns)
- Detailed execution audit trail
- JSONB `details` array with per-task results
- Queryable execution history

**Indexes Created:**
- Organization, status, trigger_type, created_at (optimized queries)
- 11 total indexes for performance

**RLS Policies:**
- Row-level security on both tables
- Organization-based isolation
- Users only see their own organization's rules and logs

---

## Implementation Details

### Trigger Types Supported

**Phase 1 - Implemented:**
- `renewal_within_days` - Accounts with renewal dates within X days

**Future Trigger Types (extensible):**
- Account status changes
- Contact updates
- License expirations
- Custom webhooks

### Action Types Supported

**Phase 1 - Implemented:**
- `create_task` - Auto-creates lead_interactions (tasks)

**Future Action Types (extensible):**
- Send email
- Create notification
- Trigger webhook
- Update custom field

### Template Variables

Available in subject_template and description_template:

| Variable | Example | When Empty |
|----------|---------|-----------|
| `{{contact_name}}` | "John Doe" | "" (empty string) |
| `{{account_name}}` | "Example Corp" | "" (empty string) |
| `{{renewal_date}}` | "2026-03-15" | "" (empty string) |
| `{{days_remaining}}` | "30" | "" (empty string) |

### Priority Auto-Calculation

- **high**: ≤ 7 days until renewal
- **medium**: 8-14 days until renewal
- **low**: 15+ days until renewal

Overridable per rule via `action_config.priority`

### Duplicate Prevention Logic

When `prevent_duplicates` is enabled:
1. Check for existing pending/open tasks in `lead_interactions`
2. Match by: `activity_metadata->>'rule_id' = rule_id` AND `status = 'pending'`
3. Skip creating new task for matching account
4. Increment `recordsSkippedDuplicate` counter

---

## Files Created/Modified

### New Files Created
- `services/workflowEngine.js` (18 KB)
  - Core business logic for rule execution
  - Template variable replacement
  - Priority calculation
  - Duplicate prevention

- `routes/workflowRules.js` (18 KB)
  - 8 REST API endpoints
  - Authentication & organization context
  - Input validation
  - Standard response formatting

- `database/migrations/042_workflow_rules_engine.sql` (12 KB)
  - Complete schema definition
  - RLS policies
  - Indexes and constraints

### Modified Files
- `server.js`
  - Added workflow rules route registration
  - Added workflowEngine import

---

## Deployment Checklist

- [x] Migration 042 created with full schema
- [x] Migration applied to DevTest ✅
- [x] Migration applied to Staging ✅
- [x] Migration applied to Production ✅
- [x] Workflow engine service created
- [x] API routes created with 8 endpoints
- [x] Routes registered in server.js
- [x] Code committed to devtest branch
- [x] Code pushed to origin/devtest
- [ ] Render automatic deployment triggered (in progress)
- [ ] DevTest API serving /api/workflow-rules endpoints
- [ ] Run integration tests on DevTest
- [ ] Merge to staging (after testing)
- [ ] Run integration tests on Staging
- [ ] Merge to production (after staging validation)

---

## Troubleshooting

### Issue: 404 - Endpoint not found

**Cause:** DevTest hasn't deployed the latest code yet

**Solution:**
1. Check Render dashboard for deployment status
2. Wait 5-10 minutes for auto-deployment
3. If still not deployed, manually trigger redeploy in Render dashboard
4. Verify with: `curl https://uppalcrm-api-devtest.onrender.com/api | grep workflow`

### Issue: 401 - Unauthorized

**Cause:** Invalid or missing authorization token

**Solution:**
1. Ensure login was successful (got valid token)
2. Include `Authorization: Bearer <TOKEN>` header
3. Token may have expired - re-login if needed

### Issue: 403 - Forbidden

**Cause:** Attempting to access another organization's rules

**Solution:**
- All rules are organization-scoped via RLS
- Can only access rules from your organization
- Admin token required for rule management

### Issue: No accounts matched

**Cause:** No accounts with renewal dates in the specified window

**Solutions:**
1. Check test data: accounts must have `next_renewal_date` set
2. Verify date is within trigger window (e.g., 0-30 days from today)
3. Create test account with near-future renewal date

---

## Next Steps

1. **Monitor Deployment**
   - Watch Render dashboard for DevTest deployment completion

2. **Run Integration Tests**
   - Once `/api/workflow-rules` endpoint is available
   - Run: `node run_devtest_api_test.js`
   - Verify all 6 test steps pass

3. **Staging Deployment**
   - After DevTest validation complete
   - Create PR from devtest → staging
   - Run same integration tests on Staging

4. **Production Deployment**
   - After Staging validation complete
   - Create PR from staging → production
   - Monitor production deployment

5. **Future Enhancement (Phase 3)**
   - Dashboard/UI for rule management
   - Scheduled execution (cron jobs)
   - Multi-channel actions (email, SMS, webhooks)
   - Advanced trigger conditions
   - Rule templates library

---

## Technical Documentation

### Database Relationships

```
organizations (1) ──── (M) workflow_rules
                            ├── is_enabled: boolean
                            ├── trigger_type: enum
                            ├── action_type: enum
                            ├── prevent_duplicates: boolean
                            └── created_by: users.id

workflow_rules (1) ──── (M) workflow_rule_logs
                            ├── records_evaluated: integer
                            ├── records_matched: integer
                            ├── tasks_created: integer
                            └── details: JSONB array

workflow_rules (via activity_metadata) ──── lead_interactions (tasks)
                                            └── activity_metadata.rule_id
```

### API Response Format

All endpoints use standardized response format:

**Success:**
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message": "Optional success message"
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Rate Limiting

All workflow rule endpoints are subject to:
- General rate limit: 100 requests per 15 minutes
- Per-rule execution limit: 100 executions per hour
- Log retrieval: unlimited pagination (20 entries/page)

---

## Support & Questions

For issues or questions:
1. Check troubleshooting section above
2. Review database schema in migration 042
3. Check execution logs via GET /api/workflow-rules/:id/logs
4. Review server logs on Render dashboard
