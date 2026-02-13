# Phase 2 Testing Guide - Entity Display in TaskManager

**Date:** 2026-02-12
**Status:** Deployed to DevTest, Staging, Production

---

## What Phase 2 Includes

### New Entity Badge Component
- Displays which entities (Lead, Contact, Account) each task is linked to
- Color-coded badges with icons:
  - 📌 **Lead** (blue) - lead_name
  - 👤 **Contact** (green) - contact_name
  - 📊 **Account** (purple) - account_name

### TaskManager Updates
- Now accepts optional `contactId` and `accountId` props
- Displays entity badges on each task card
- Passes entity context to AddTaskModal
- Multi-entity tasks show all linked entities

### UI Changes
- New badges display under task subject
- Show linked entity names (e.g., "John Smith", "Acme Corp")
- Support for multiple entity badges per task
- Badges are responsive and truncate if names are long

---

## Deployment Status

| Environment | Branch | Commit | Status |
|-------------|--------|--------|--------|
| **DevTest** | devtest | 9909912 | ✅ Deployed |
| **Staging** | staging | d0f1542 | ✅ Deployed |
| **Production** | production | 80a6fbb | ✅ Deployed |

---

## Testing Checklist

### Test 1: Entity Badge Display (DevTest)

**Prerequisites:**
- DevTest environment running
- Existing tasks with lead_id linked (all tasks)

**Steps:**
1. Navigate to any Lead detail page
2. Scroll to "Tasks & Activities" section
3. **Verify:** Tasks show 📌 Lead badge with lead name
4. **Verify:** Badge is blue with lead name displayed
5. **Verify:** No contact or account badges (since tasks only link to leads currently)

**Expected Result:** ✅ All tasks show lead name in blue badge

---

### Test 2: TaskManager with Manual Task Creation (DevTest)

**Steps:**
1. On Lead detail page, click "Add Task"
2. Fill in task details:
   - Subject: "Test Phase 2 Display"
   - Due Date: Tomorrow
   - Priority: Medium
3. Submit task
4. **Verify:** Task appears in list with lead badge
5. **Verify:** Badge displays correctly with entity name

**Expected Result:** ✅ New task shows entity badge immediately

---

### Test 3: General Task Creation (DevTest)

**Steps:**
1. Navigate to Tasks Dashboard
2. Click "Add Task"
3. Fill in task with:
   - Subject: "Multi-Entity Task"
   - Contact or Account selection (if UI supports it)
   - Due date: Tomorrow
4. Submit task
5. **Verify:** Task appears with appropriate entity badges
6. **Verify:** All linked entities display as badges

**Expected Result:** ✅ Task shows all linked entity badges

---

### Test 4: Auto-Created Follow-Up Tasks (DevTest)

**Steps:**
1. Create a new Lead with "Next follow up" date set
2. Navigate to Tasks section
3. **Verify:** Auto-created task appears
4. **Verify:** Task shows lead badge

**Expected Result:** ✅ Auto-created task displays with proper entity badge

---

### Test 5: Task Completion (DevTest)

**Steps:**
1. Click checkbox on any task to mark complete
2. **Verify:** Task UI updates (strikethrough, checkmark)
3. **Verify:** Entity badge still displays
4. **Verify:** "Completed" badge appears

**Expected Result:** ✅ Badges persist after completion

---

### Test 6: Filter & Sort (DevTest)

**Steps:**
1. In TaskManager, use filters (All, Pending, Completed, Overdue)
2. **Verify:** Entity badges display correctly in filtered view
3. Try sorting by different columns
4. **Verify:** Badges remain intact after sorting

**Expected Result:** ✅ Badges display correctly with filters/sorting

---

### Test 7: Staging Environment

Repeat Tests 1-6 on Staging environment to verify:
- Entity badges display
- No console errors
- Performance is acceptable
- Mobile responsiveness (if applicable)

---

### Test 8: Production Environment

Repeat critical tests (1-3) on Production to verify:
- Backward compatibility with existing tasks
- No breaking changes
- Display works with real data

---

## Known Limitations

**Current Behavior:**
- All existing tasks are lead-only (linked via lead_id)
- contact_id and account_id are NULL for existing tasks
- New tasks created before Phase 1/2 won't have contact/account data
- AddTaskModal UI still being built out (Phase 3+)

**Expected After Phase 3-5:**
- Frontend will support creating tasks with contact/account
- UI will allow selecting contact/account in task creation
- Tasks can link to multiple entities
- Full contact/account support will be enabled

---

## Testing Notes

### What Should Work Now
✅ View entity badges on task cards
✅ Filter and sort tasks (badges persist)
✅ Complete tasks (badges remain visible)
✅ Lead-based task creation (shows lead badge)
✅ Auto-created follow-up tasks (shows badges)

### What's Being Built
⏳ UI controls for contact/account selection
⏳ General task creation modal
⏳ Multi-entity task filters
⏳ Contact/Account detail pages with tasks

---

## Troubleshooting

**Issue: No entity badges visible**
- Check browser console for errors
- Verify task has `lead_name`, `contact_name`, or `account_name` fields
- Clear browser cache and refresh

**Issue: Badges appear but names are blank**
- Check database to ensure entity names are populated
- Verify API is returning entity fields
- Check AddTaskModal is passing correct data

**Issue: Performance degradation**
- Check Network tab for query performance
- Verify indexes were created (migration verification)
- Monitor browser performance metrics

---

## Rollback Instructions

If issues occur, rollback Phase 2 with:

```bash
# DevTest
git checkout devtest
git revert 9909912
git push origin devtest

# Staging
git checkout staging
git revert d0f1542
git push origin staging

# Production
git checkout production
git revert 80a6fbb
git push origin production
```

---

## Next Steps After Phase 2 Testing

If all tests pass:
1. Proceed with Phase 3 - TasksDashboard updates
2. Add general task creation from dashboard
3. Implement contact/account selection UI
4. Deploy to all environments

If issues found:
1. Document the issue
2. Create fix commit
3. Deploy fix to affected environment
4. Re-test
5. Proceed to Phase 3

---

## Contact & Support

For issues or questions about Phase 2 testing, refer to:
- Migration: `database/migrations/041_extend_interactions_to_contacts_and_accounts.sql`
- Plan: `FRONTEND_TASK_EXTENSION_PLAN.md`
- Backend Routes: `routes/tasks.js`, `routes/leads.js`
- Frontend Components: `AddTaskModal.jsx`, `TaskManager.jsx`
