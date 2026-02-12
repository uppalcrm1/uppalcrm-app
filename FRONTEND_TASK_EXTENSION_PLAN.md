# Frontend Task Extension - Implementation Plan

**Date:** 2026-02-11
**Status:** Planning Phase
**Objective:** Support tasks linked to contacts and accounts (not just leads)

---

## Phase 1: API Service Updates

### File: `frontend/src/services/api.js`

**Add new methods to taskAPI:**

```javascript
// Create a general task (not tied to a specific entity)
createGeneralTask: async (data) => {
  const response = await api.post(`/api/tasks`, data)
  return response.data
},

// Get all tasks across organization
getAllTasks: async (params = {}) => {
  const response = await api.get(`/api/tasks`, { params })
  return response.data
},

// Get task statistics
getTaskStats: async () => {
  const response = await api.get(`/api/tasks/stats`)
  return response.data
}
```

**Modify existing methods:**
- Keep `createTask(leadId, data)` for backward compatibility
- Update to handle both lead-based and general task creation

---

## Phase 2: AddTaskModal Component Updates

### File: `frontend/src/components/AddTaskModal.jsx`

**Changes:**
1. Make `leadId` prop optional
2. Add optional `contactId` and `accountId` props
3. Add form fields for selecting contact/account
4. Update validation to require at least one entity if no leadId
5. Update submission logic:
   - If leadId provided → use `/leads/{leadId}/tasks` (existing)
   - If no leadId → use `/api/tasks` (new general endpoint)
6. Add support for editing tasks (currently read-only contact/account)

**New form fields:**
- Contact selector (dropdown/search)
- Account selector (dropdown/search)
- Show selected entities as chips/tags

---

## Phase 3: Task List Display Updates

### File: `frontend/src/components/TaskManager.jsx`

**Changes:**
1. Display contact and account information for each task
2. Show entity badges/tags (Lead, Contact, Account)
3. Add filters for entity type
4. Update task actions (edit, delete, complete)

---

## Phase 4: TasksDashboard Updates

### File: `frontend/src/pages/TasksDashboard.jsx`

**Changes:**
1. Switch from lead-based to global task fetching
2. Update task query to use `getAllTasks()` instead of per-lead queries
3. Add entity-based filtering/grouping
4. Update task creation to use general modal
5. Add "Create task" button that opens modal with no pre-selected entity

---

## Phase 5: Lead Detail Page Integration

### Relevant Files:
- Lead detail pages that show lead-specific tasks
- Keep showing lead-related tasks in context of the lead
- Add option to create task for other entities

---

## Database Integration

The backend now supports:

### POST /api/tasks
```json
{
  "subject": "Task title",
  "description": "Optional description",
  "lead_id": "uuid or null",
  "contact_id": "uuid or null",
  "account_id": "uuid or null",
  "scheduled_at": "2026-02-15T10:00:00Z",
  "priority": "low|medium|high",
  "assigned_to": "user uuid (optional)"
}
```

**Requirements:**
- At least one of: lead_id, contact_id, account_id must be provided
- subject is required
- scheduled_at is optional
- priority defaults to 'medium'
- assigned_to defaults to current user

### GET /api/tasks
```json
{
  "tasks": [
    {
      "id": "uuid",
      "lead_id": "uuid or null",
      "contact_id": "uuid or null",
      "account_id": "uuid or null",
      "lead_name": "Lead Name",
      "contact_name": "Contact Name",
      "account_name": "Account Name",
      "subject": "Task subject",
      "description": "Task description",
      "status": "pending|scheduled|completed|cancelled",
      "priority": "low|medium|high",
      "scheduled_at": "timestamp",
      "completed_at": "timestamp or null",
      "assigned_to": "user uuid",
      "assigned_to_name": "User Name",
      "created_at": "timestamp"
    }
  ],
  "stats": {
    "total": 42,
    "pending": 10,
    "completed": 25,
    "overdue": 2,
    "high_priority": 5,
    "medium_priority": 15,
    "low_priority": 20
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 42
  }
}
```

---

## Implementation Order

1. ✅ **API Service** - Add new task API methods
2. ⏳ **AddTaskModal** - Make entity selection flexible
3. ⏳ **TaskManager** - Display entity information
4. ⏳ **TasksDashboard** - Show all tasks globally
5. ⏳ **Lead Integration** - Keep lead-specific task views

---

## Testing Checklist

### API Integration
- [ ] Create task with lead only
- [ ] Create task with contact only
- [ ] Create task with account only
- [ ] Create task with multiple entities
- [ ] Get all tasks returns all entity fields
- [ ] Task statistics work correctly

### UI/UX
- [ ] AddTaskModal works from lead page (leadId provided)
- [ ] AddTaskModal works as standalone (no leadId)
- [ ] Contact/account selectors populate correctly
- [ ] Validation requires at least one entity
- [ ] Task list displays all entity types
- [ ] Entity badges show correctly

### Backward Compatibility
- [ ] Existing lead-based task creation still works
- [ ] Lead detail page still shows lead tasks
- [ ] Task completion/editing works for all entity types
- [ ] Auto-created follow-up tasks still appear

---

## Notes

- AddTaskModal is used in multiple places - ensure backward compatibility
- TaskManager may be used in different contexts (lead detail, dashboard)
- Consider mobile responsiveness for new entity selectors
- May need to add skeleton/loading states for entity lookups
