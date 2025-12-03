# INTERACTIONS MODULE AUDIT & IMPLEMENTATION PLAN

**Date:** December 2, 2025
**Audited by:** Claude Code - Interactions Agent
**Project:** Uppal CRM2

---

## EXECUTIVE SUMMARY

### Current State
The interactions management system in Uppal CRM2 is **60% complete**. The foundation is solid with full interaction logging capabilities for Leads and Contacts, but critical enterprise features like Gmail integration, SLA tracking, email templates, and account interactions are missing.

### Key Findings
- ✅ **Strong Foundation**: Lead and Contact interactions fully functional
- ✅ **Timeline Tracking**: Interaction events system enables detailed activity history
- ✅ **Task Management**: Task creation and tracking integrated with interactions
- ❌ **No Email Automation**: Missing Gmail sync and auto-lead creation
- ❌ **No SLA Tracking**: No 1-hour response time monitoring
- ❌ **No Email Templates**: Manual email composition only
- ❌ **No Account Interactions**: Support/renewal communications not tracked

### Completeness Assessment
- **Database**: 50% complete (3 of 6 core tables exist)
- **Backend API**: 60% complete (lead/contact routes exist, email/tasks/SLA missing)
- **Frontend UI**: 65% complete (basic logging works, missing templates/SLA dashboard)
- **Overall**: **60% implemented**

### Critical Gaps
1. Gmail integration for email sync and auto-lead creation
2. SLA monitoring (1-hour response time tracking)
3. Email template system with admin approval workflow
4. Account-level interaction tracking
5. Cross-entity interaction linking
6. Email composer within CRM
7. Interaction search and analytics

### Estimated Effort to Complete
- **Priority 1 (Essential)**: 40-50 hours
- **Priority 2 (Important)**: 30-35 hours
- **Priority 3 (Enhancement)**: 20-25 hours
- **Total**: 90-110 hours (11-14 working days)

---

## DATABASE AUDIT

### ✅ Existing Tables

#### 1. `lead_interactions` ✅ FULLY IMPLEMENTED
**Status**: Production-ready
**Location**: `database/comprehensive-leads-migration.sql`
**Enhancement**: `database/migrations/016_enhance_lead_interactions.sql`

**Structure**:
```sql
CREATE TABLE lead_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    organization_id UUID NOT NULL,
    created_by UUID,

    -- Interaction Details
    interaction_type VARCHAR(50) NOT NULL,  -- call, email, meeting, note, task
    subject VARCHAR(255),
    description TEXT,
    outcome VARCHAR(100),

    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,

    -- Additional Fields
    status VARCHAR(50) DEFAULT 'completed',  -- scheduled, completed, cancelled
    priority VARCHAR(20) DEFAULT 'medium',
    participants JSONB,
    activity_metadata JSONB,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Tracks all communication and activities with leads (calls, emails, meetings, notes, tasks)

**Indexes**:
- `idx_lead_interactions_lead_id` - Fast lookup by lead
- `idx_lead_interactions_user_id` - Filter by user
- `idx_lead_interactions_scheduled_at` - Upcoming tasks
- `idx_lead_interactions_organization` - Multi-tenant isolation
- `idx_lead_interactions_type` - Filter by interaction type

**RLS Policy**: ✅ Enabled - `lead_interactions_isolation` via lead's organization_id

**Assessment**: ✅ **Production-ready** - All necessary fields present, properly indexed, secure

---

#### 2. `interaction_events` ✅ FULLY IMPLEMENTED
**Status**: Production-ready
**Location**: `database/migrations/017_interaction_events.sql`

**Structure**:
```sql
CREATE TABLE interaction_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id UUID NOT NULL REFERENCES lead_interactions(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,

  -- Event details
  event_type VARCHAR(50) NOT NULL,  -- 'created', 'assigned', 'reassigned', 'priority_changed', 'date_changed', 'completed', 'cancelled'
  event_description TEXT,

  -- Change tracking
  field_changed VARCHAR(100),
  old_value TEXT,
  new_value TEXT,

  -- User tracking
  changed_by UUID REFERENCES users(id),
  event_metadata JSONB DEFAULT '{}',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Tracks lifecycle events for interactions to enable detailed activity timeline (task created, reassigned, completed, etc.)

**Triggers**:
- `trigger_create_interaction_event` - Auto-creates event when interaction is inserted
- `trigger_track_interaction_updates` - Auto-tracks completion, reassignment, priority changes, etc.

**Indexes**:
- `idx_interaction_events_interaction` - Link to interaction
- `idx_interaction_events_lead` - Fast lead timeline
- `idx_interaction_events_organization` - Multi-tenant
- `idx_interaction_events_lead_date` - Sorted timeline queries
- `idx_interaction_events_org_lead_date` - Composite for common queries

**RLS Policy**: ✅ Enabled - `interaction_events_org_isolation`

**Assessment**: ✅ **Excellent** - Enables rich timeline with separate entries for task creation, completion, reassignment

---

#### 3. `contact_interactions` ✅ FULLY IMPLEMENTED
**Status**: Production-ready
**Location**: `database/contact-management-schema.sql`

**Structure**:
```sql
CREATE TABLE contact_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,

    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL,  -- email, call, meeting, note, support_ticket
    direction VARCHAR(20) NOT NULL,  -- inbound, outbound
    subject VARCHAR(500),
    content TEXT,

    -- Metadata
    duration_minutes INTEGER,
    email_message_id VARCHAR(500),  -- for email tracking

    -- User tracking
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Purpose**: Tracks all communication with existing customers (contacts)

**Notable Differences from lead_interactions**:
- ✅ Has `direction` field (inbound/outbound)
- ✅ Has `email_message_id` for email tracking
- ✅ Includes `support_ticket` as interaction type
- ❌ Missing `scheduled_at`, `completed_at`, `status` (no task scheduling)
- ❌ Missing `outcome` field
- ❌ Missing `priority` field

**Indexes**:
- `idx_contact_interactions_contact` - Fast contact lookup
- `idx_contact_interactions_org` - Multi-tenant
- `idx_contact_interactions_type` - Filter by type
- `idx_contact_interactions_created` - Date sorting

**RLS Policy**: ✅ Enabled - `contact_interactions_isolation`

**Assessment**: ⚠️ **Functional but incomplete** - Works for basic logging but missing scheduling/task features

---

### ❌ Missing Critical Tables

#### 4. `account_interactions` ❌ NOT FOUND
**Status**: **MISSING**
**Urgency**: **HIGH** - Needed for tracking support, renewals, license discussions

**Recommended Structure**:
```sql
CREATE TABLE account_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),  -- which contact we spoke with
    organization_id UUID NOT NULL,

    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL,  -- support, renewal, license_discussion, upgrade, issue
    direction VARCHAR(20) NOT NULL,  -- inbound, outbound
    subject VARCHAR(500),
    content TEXT,
    outcome VARCHAR(100),

    -- Support-specific
    ticket_number VARCHAR(100),
    severity VARCHAR(20),  -- low, medium, high, critical
    resolution TEXT,

    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,

    -- User tracking
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Why Needed**:
- Track license renewal discussions
- Log support tickets and resolutions
- Monitor account health
- Document upgrade conversations

**Estimated Time**: 3-4 hours (schema + RLS + backend + frontend)

---

#### 5. `email_sync_records` ❌ NOT FOUND
**Status**: **MISSING**
**Urgency**: **CRITICAL** - Core requirement for Gmail integration

**Recommended Structure**:
```sql
CREATE TABLE email_sync_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Gmail integration
    gmail_message_id VARCHAR(500) UNIQUE NOT NULL,
    thread_id VARCHAR(500),

    -- Email details
    from_email VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    cc_emails TEXT[],
    subject VARCHAR(1000),
    body_text TEXT,
    body_html TEXT,

    -- Entity linking (auto-matched or manually linked)
    lead_id UUID REFERENCES leads(id),
    contact_id UUID REFERENCES contacts(id),
    account_id UUID REFERENCES accounts(id),

    -- SLA tracking
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_needed BOOLEAN DEFAULT TRUE,
    responded_at TIMESTAMP WITH TIME ZONE,
    sla_violated BOOLEAN DEFAULT FALSE,

    -- Attachments
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,
    attachment_metadata JSONB,

    -- Status
    sync_status VARCHAR(50) DEFAULT 'synced',  -- synced, failed, ignored
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Why Needed**:
- Gmail integration foundation
- Auto-lead creation from unknown senders
- SLA tracking (1-hour response time)
- Email history and audit trail

**Estimated Time**: 8-10 hours (schema + Gmail API integration + sync service + cron job)

---

#### 6. `email_templates` ❌ NOT FOUND
**Status**: **MISSING**
**Urgency**: **HIGH** - Important for email consistency

**Recommended Structure**:
```sql
CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Template details
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,  -- welcome, follow_up, trial, renewal, support
    subject VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,  -- supports placeholders like {{firstName}}

    -- Approval workflow
    is_approved BOOLEAN DEFAULT FALSE,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,

    -- Ownership
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    UNIQUE(organization_id, name)
);
```

**Why Needed**:
- Consistent messaging across team
- Admin approval workflow
- Template analytics (which templates convert best)
- Time savings for sales team

**Estimated Time**: 5-6 hours (schema + backend CRUD + frontend template selector + renderer)

---

#### 7. `tasks` Table ❌ PARTIALLY IMPLEMENTED
**Status**: **Tasks exist as `interaction_type='task'` in `lead_interactions`**
**Issue**: Not a dedicated table, limiting task-specific features

**Current Implementation**:
- Tasks stored in `lead_interactions` with `interaction_type = 'task'`
- Basic fields: subject, description, scheduled_at, completed_at, priority, status
- Works for lead-specific tasks

**Limitations**:
- ❌ Cannot have org-wide tasks (not linked to any entity)
- ❌ Cannot link single task to multiple entities (lead + contact + account)
- ❌ No task categories/labels
- ❌ No recurring tasks
- ❌ Limited filtering/sorting

**Recommendation**: **Keep current implementation** for now, consider separate `tasks` table in Phase 3 if needed

---

### 📊 Database Completeness Summary

| Table | Status | Completeness | Priority |
|-------|--------|--------------|----------|
| lead_interactions | ✅ Exists | 100% | - |
| interaction_events | ✅ Exists | 100% | - |
| contact_interactions | ⚠️ Partial | 70% | P1 - Enhance |
| account_interactions | ❌ Missing | 0% | P1 - Create |
| email_sync_records | ❌ Missing | 0% | P1 - Create |
| email_templates | ❌ Missing | 0% | P2 - Create |
| tasks (dedicated) | ⚠️ Partial | 50% | P3 - Optional |
| sla_violations | ❌ Missing | 0% | P2 - Create |

**Overall Database Completion**: **50%** (3 of 6 core tables exist and production-ready)

---

## CODE AUDIT

### ✅ Backend Implementation

#### 1. Lead Interactions API ✅ FULLY IMPLEMENTED
**File**: `routes/leadInteractions.js`
**Status**: Production-ready

**Endpoints**:
```
GET    /api/leads/:leadId/interactions          ✅ List all interactions
POST   /api/leads/:leadId/interactions          ✅ Create interaction
PUT    /api/leads/:leadId/interactions/:id      ✅ Update interaction
DELETE /api/leads/:leadId/interactions/:id      ✅ Delete interaction
PATCH  /api/leads/:leadId/interactions/:id/complete  ✅ Mark as completed
```

**Features**:
- ✅ Full CRUD operations
- ✅ Joi validation for all inputs
- ✅ Multi-tenant security (checks organization_id)
- ✅ Auto-updates lead's `last_contact_date` on completed interactions
- ✅ Supports all interaction types: call, email, meeting, note, task
- ✅ Scheduled vs completed status handling
- ✅ Priority levels (low, medium, high)
- ✅ Duration tracking for calls/meetings
- ✅ Outcome tracking

**Code Quality**: ✅ **Excellent** - Follows best practices, properly secured

---

#### 2. Contact Interactions API ✅ FULLY IMPLEMENTED
**File**: `routes/contacts.js` (lines 1076-1275)
**Status**: Production-ready

**Endpoints**:
```
POST   /api/contacts/:id/interactions                ✅ Create interaction
GET    /api/contacts/:id/interactions                ✅ List interactions with filters
GET    /api/contacts/:id/interactions/stats          ✅ Get interaction statistics
PUT    /api/contacts/:id/interactions/:interactionId ✅ Update interaction
DELETE /api/contacts/:id/interactions/:interactionId ✅ Delete interaction
GET    /api/contacts/interactions/recent             ✅ Recent interactions across all contacts
```

**Features**:
- ✅ Full CRUD operations
- ✅ Direction tracking (inbound/outbound)
- ✅ Interaction statistics (count by type, direction)
- ✅ Pagination and filtering
- ✅ Multi-tenant security
- ✅ Contact model integration (`Contact.createInteraction()`, etc.)

**Code Quality**: ✅ **Excellent**

---

#### 3. Task Management API ✅ PARTIALLY IMPLEMENTED
**Implementation**: Frontend API only, backend uses lead_interactions endpoints

**Frontend API Methods** (`frontend/src/services/api.js`):
```javascript
// All task methods use /leads/:leadId/interactions endpoints
taskAPI.getTasks(leadId)                    ✅ Filter interactions by type='task'
taskAPI.createTask(leadId, data)            ✅ Create interaction with type='task'
taskAPI.updateTask(leadId, taskId, data)    ✅ Update interaction
taskAPI.completeTask(leadId, taskId, data)  ✅ Mark as completed
taskAPI.deleteTask(leadId, taskId)          ✅ Delete interaction
taskAPI.getOverdueTasks()                   ⚠️ Implemented but backend missing
taskAPI.getUpcomingTasks(days)              ⚠️ Implemented but backend missing
taskAPI.bulkCompleteTasks(leadId, taskIds)  ⚠️ Implemented but backend missing
```

**Status**:
- ✅ Basic CRUD works (uses lead_interactions API)
- ❌ Advanced features not implemented on backend (overdue, upcoming, bulk operations)

---

### ❌ Missing Backend Implementation

#### 4. Account Interactions API ❌ NOT FOUND
**Status**: **COMPLETELY MISSING**
**Priority**: **HIGH**

**Needed Endpoints**:
```
POST   /api/accounts/:accountId/interactions               - Create interaction
GET    /api/accounts/:accountId/interactions               - List interactions
GET    /api/accounts/:accountId/interactions/stats         - Get stats
PUT    /api/accounts/:accountId/interactions/:id          - Update interaction
DELETE /api/accounts/:accountId/interactions/:id          - Delete interaction
GET    /api/accounts/:accountId/interactions/timeline      - Timeline view
```

**Use Cases**:
- Log renewal discussions
- Track support tickets
- Document upgrade conversations
- Monitor account health

**Estimated Time**: 4-5 hours (similar to lead interactions, copy and adapt)

---

#### 5. Email Sync Service ❌ NOT FOUND
**Status**: **COMPLETELY MISSING**
**Priority**: **CRITICAL**
**Urgency**: **Core requirement for Gmail integration**

**Needed Components**:

**A) Email Sync Service** (`services/emailSyncService.js`)
```javascript
// Main sync function
async function syncGmailEmails(organizationId) {
  // 1. Connect to Gmail API with org's OAuth credentials
  // 2. Fetch emails since last sync
  // 3. For each email:
  //    - Check if sender exists in leads/contacts
  //    - If NOT found → create new lead
  //    - If found → log interaction
  //    - Store in email_sync_records
  //    - Set response_needed = TRUE for incoming
  // 4. Update last sync timestamp
}
```

**B) Gmail OAuth Setup** (`services/gmailAuth.js`)
- OAuth 2.0 flow for Gmail access
- Store refresh tokens per organization
- Handle token expiration and renewal

**C) Auto-Lead Creation Logic**
```javascript
async function handleUnknownSender(email, organizationId) {
  // Extract name from email
  const firstName = extractFirstName(email.from);
  const lastName = extractLastName(email.from);

  // Create lead
  const lead = await createLead({
    first_name: firstName,
    last_name: lastName,
    email: email.from,
    source: 'Email Inbound',
    status: 'New',
    organization_id: organizationId
  });

  // Log interaction
  await createLeadInteraction({
    lead_id: lead.id,
    interaction_type: 'email',
    subject: email.subject,
    description: email.body,
    response_needed: true
  });

  return lead;
}
```

**D) Cron Job** (`cron/emailSync.js`)
```javascript
// Run every 5-15 minutes
cron.schedule('*/10 * * * *', async () => {
  const orgs = await getOrgsWithGmailIntegration();
  for (const org of orgs) {
    await syncGmailEmails(org.id);
  }
});
```

**Estimated Time**: 12-15 hours
- Gmail OAuth integration: 4-5 hours
- Email sync service: 4-5 hours
- Auto-lead creation: 2-3 hours
- Cron job setup: 1 hour
- Testing: 2 hours

---

#### 6. Email Template System ❌ NOT FOUND
**Status**: **COMPLETELY MISSING**
**Priority**: **HIGH**

**Needed Components**:

**A) Email Templates API** (`routes/emailTemplates.js`)
```
POST   /api/email-templates                  - Create template (draft)
GET    /api/email-templates                  - List all templates
GET    /api/email-templates/:id              - Get single template
PUT    /api/email-templates/:id              - Update template
DELETE /api/email-templates/:id              - Delete template
POST   /api/email-templates/:id/approve      - Approve template (admin only)
POST   /api/email-templates/:id/preview      - Preview with sample data
POST   /api/email-templates/:id/use          - Increment usage_count
```

**B) Template Rendering Service** (`services/emailTemplateService.js`)
```javascript
function renderTemplate(template, data) {
  let rendered = template.body;

  // Replace {{placeholder}} with actual values
  rendered = rendered.replace(/{{firstName}}/g, data.firstName || '');
  rendered = rendered.replace(/{{lastName}}/g, data.lastName || '');
  rendered = rendered.replace(/{{companyName}}/g, data.companyName || '');
  // ... all placeholders

  // Warn about unreplaced placeholders
  const unreplaced = rendered.match(/{{.*?}}/g);
  if (unreplaced) console.warn('Unreplaced:', unreplaced);

  return rendered;
}
```

**Estimated Time**: 6-7 hours

---

#### 7. SLA Tracking Service ❌ NOT FOUND
**Status**: **COMPLETELY MISSING**
**Priority**: **HIGH**

**Needed Components**:

**A) SLA Monitoring Service** (`services/slaTrackingService.js`)
```javascript
async function checkSLAViolations() {
  // Find all emails needing response
  const pending = await db.query(`
    SELECT * FROM email_sync_records
    WHERE response_needed = TRUE
      AND responded_at IS NULL
      AND received_at < NOW() - INTERVAL '1 hour'
  `);

  // Send alerts
  for (const email of pending) {
    await sendSLAAlert(email);
    await db.query(
      'UPDATE email_sync_records SET sla_violated = TRUE WHERE id = $1',
      [email.id]
    );
  }
}
```

**B) SLA API** (`routes/sla.js`)
```
GET /api/sla/dashboard        - Pending responses, violations, stats
GET /api/sla/pending          - List pending responses
GET /api/sla/violations       - List SLA violations
GET /api/sla/stats            - Response time statistics
```

**C) Cron Job**
```javascript
// Run every 15 minutes
cron.schedule('*/15 * * * *', checkSLAViolations);
```

**Estimated Time**: 5-6 hours

---

### 📊 Backend Completeness Summary

| Component | Status | Completeness | Priority |
|-----------|--------|--------------|----------|
| Lead Interactions API | ✅ Complete | 100% | - |
| Contact Interactions API | ✅ Complete | 100% | - |
| Account Interactions API | ❌ Missing | 0% | P1 |
| Task API (advanced) | ⚠️ Partial | 40% | P2 |
| Email Sync Service | ❌ Missing | 0% | P1 |
| Email Templates API | ❌ Missing | 0% | P2 |
| SLA Tracking Service | ❌ Missing | 0% | P2 |
| Gmail OAuth Integration | ❌ Missing | 0% | P1 |

**Overall Backend Completion**: **40%**

---

### ✅ Frontend Implementation

#### 1. Lead Interactions UI ✅ FULLY IMPLEMENTED

**Components**:
- `frontend/src/components/AddInteractionModal.jsx` ✅ **Exists**
  - Quick log modal for all interaction types
  - Type selector (call, email, meeting, note, task)
  - Subject, description, outcome fields
  - Duration tracking
  - Scheduling for future tasks/meetings
  - Priority selection

- `frontend/src/components/InteractionsTimeline.jsx` ✅ **Exists**
  - Chronological timeline of all interactions
  - Color-coded icons per type
  - Scheduled vs completed status
  - Overdue indicators
  - Edit/delete actions
  - Complete task button

**API Integration**:
- `frontend/src/services/api.js` - `leadInteractionsAPI` ✅ **Fully implemented**
  - getInteractions()
  - createInteraction()
  - updateInteraction()
  - deleteInteraction()
  - completeInteraction()

**Assessment**: ✅ **Production-ready** - Full-featured, polished UI

---

#### 2. Contact Interactions UI ✅ FULLY IMPLEMENTED

**Components**:
- `frontend/src/components/ContactInteractions.jsx` ✅ **Exists**
  - List view with filters
  - Interaction stats
  - Direction indicators (inbound/outbound)
  - Type filtering

- `frontend/src/components/InteractionForm.jsx` ✅ **Exists**
  - Reusable form for create/edit
  - Support for contact-specific fields

**API Integration**:
- `contactsAPI.getInteractions()` ✅ Works
- `contactsAPI.createInteraction()` ✅ Works
- `contactsAPI.updateInteraction()` ✅ Works
- `contactsAPI.deleteInteraction()` ✅ Works
- `contactsAPI.getInteractionStats()` ✅ Works

**Assessment**: ✅ **Production-ready**

---

### ❌ Missing Frontend Implementation

#### 3. Account Interactions UI ❌ NOT FOUND
**Status**: **MISSING**
**Priority**: **HIGH**

**Needed Components**:
- `AccountInteractionsTimeline.jsx` - Similar to lead interactions timeline
- `AccountInteractionModal.jsx` - Quick log support tickets, renewal calls
- Support-specific fields: ticket number, severity, resolution

**Estimated Time**: 3-4 hours (copy from lead interactions, adapt for accounts)

---

#### 4. Email Composer ❌ NOT FOUND
**Status**: **MISSING**
**Priority**: **HIGH**

**Needed Component**: `EmailComposer.jsx`

**Features**:
- Template selector dropdown
- To/CC/BCC fields (pre-filled from entity)
- Subject line (from template or custom)
- Rich text editor for body
- Placeholder preview and auto-fill
- Send button (sends via backend SMTP)
- Auto-log interaction after send

**Estimated Time**: 6-7 hours

---

#### 5. Email Template Management ❌ NOT FOUND
**Status**: **MISSING**
**Priority**: **MEDIUM**

**Needed Components**:
- `EmailTemplatesPage.jsx` - List all templates
- `EmailTemplateEditor.jsx` - Create/edit templates
- `TemplateApprovalModal.jsx` - Admin approval workflow
- `TemplatePreview.jsx` - Preview with sample data

**Estimated Time**: 5-6 hours

---

#### 6. SLA Dashboard ❌ NOT FOUND
**Status**: **MISSING**
**Priority**: **HIGH**

**Needed Component**: `SLADashboard.jsx`

**Features**:
- Pending responses count
- SLA violations count (with red alert)
- Average response time (last 7 days, last 30 days)
- Oldest pending response highlighted
- Click to view/respond to email
- Response time leaderboard (by user)

**Estimated Time**: 4-5 hours

---

#### 7. Interaction Search & Analytics ❌ NOT FOUND
**Status**: **MISSING**
**Priority**: **MEDIUM**

**Needed Components**:
- `InteractionsSearchPage.jsx` - Global search across all entities
- `InteractionAnalytics.jsx` - Charts and reports
  - Interactions by type (pie chart)
  - Interactions over time (line chart)
  - Response time trends
  - Most active users

**Estimated Time**: 6-8 hours

---

### 📊 Frontend Completeness Summary

| Component | Status | Completeness | Priority |
|-----------|--------|--------------|----------|
| Lead Interactions UI | ✅ Complete | 100% | - |
| Contact Interactions UI | ✅ Complete | 100% | - |
| Account Interactions UI | ❌ Missing | 0% | P1 |
| Email Composer | ❌ Missing | 0% | P2 |
| Email Template Manager | ❌ Missing | 0% | P2 |
| SLA Dashboard | ❌ Missing | 0% | P2 |
| Interaction Search | ❌ Missing | 0% | P3 |
| Interaction Analytics | ❌ Missing | 0% | P3 |

**Overall Frontend Completion**: **40%**

---

## FEATURE GAP ANALYSIS

### ✅ Implemented Features (60%)

#### Core Interaction Logging
- ✅ **Lead interactions** - All types (call, email, meeting, note, task)
- ✅ **Contact interactions** - All types including support tickets
- ✅ **Interaction timeline** - Chronological view with icons and colors
- ✅ **Task management** - Create, assign, schedule, complete tasks
- ✅ **Interaction events** - Detailed lifecycle tracking (created, reassigned, completed)
- ✅ **Quick logging** - Modal forms for fast data entry
- ✅ **Status tracking** - Scheduled vs completed interactions
- ✅ **Priority levels** - Low, medium, high for tasks
- ✅ **Duration tracking** - Minutes for calls and meetings
- ✅ **Outcome tracking** - Result of each interaction
- ✅ **Multi-tenant security** - All tables have RLS policies

#### Advanced Features
- ✅ **Direction tracking** - Inbound vs outbound (contacts only)
- ✅ **Participants tracking** - JSONB field for meeting attendees
- ✅ **Custom metadata** - JSONB field for additional data
- ✅ **Interaction statistics** - Count by type, direction (contacts)
- ✅ **User attribution** - Track who created/completed each interaction
- ✅ **Auto-update last contact** - Lead's last_contact_date updates automatically

---

### ❌ Missing Critical Features (40%)

#### Must-Have (Priority 1) ⚠️

**1. Gmail Integration & Email Sync** ❌ 0%
- ❌ Gmail OAuth 2.0 setup
- ❌ Email sync cron job (every 5-15 minutes)
- ❌ Auto-create leads from unknown senders
- ❌ Match emails to existing leads/contacts
- ❌ Store emails in email_sync_records table
- ❌ Email thread tracking
- **Impact**: Cannot automate lead generation, no email history
- **Estimated Time**: 12-15 hours

**2. Account-Level Interactions** ❌ 0%
- ❌ Account interactions database table
- ❌ Account interactions API endpoints
- ❌ Account interactions UI components
- ❌ Support ticket tracking
- ❌ Renewal discussion logging
- **Impact**: Cannot track customer support and renewals properly
- **Estimated Time**: 7-9 hours

**3. SLA Tracking (1-Hour Response Time)** ❌ 0%
- ❌ response_needed flag on email_sync_records
- ❌ SLA monitoring cron job
- ❌ Alert system for violations
- ❌ SLA dashboard component
- ❌ Response time analytics
- **Impact**: No accountability for timely responses
- **Estimated Time**: 5-6 hours

**4. Cross-Entity Interaction Linking** ❌ 0%
- ❌ Single interaction linked to multiple entities (lead + contact + account)
- ❌ UI to show which entities are linked
- ❌ Search interactions across all entities
- **Impact**: Duplicate logging, incomplete history
- **Estimated Time**: 4-5 hours

---

#### Important (Priority 2) ⚠️

**5. Email Template System** ❌ 0%
- ❌ Email templates database table
- ❌ Template CRUD API
- ❌ Admin approval workflow
- ❌ Template editor UI
- ❌ Placeholder system ({{firstName}}, etc.)
- ❌ Template rendering service
- ❌ Usage tracking
- **Impact**: Inconsistent messaging, time waste
- **Estimated Time**: 11-13 hours

**6. Email Composer within CRM** ❌ 0%
- ❌ Email composer component
- ❌ Template selector
- ❌ Rich text editor
- ❌ Send email via SMTP
- ❌ Auto-log sent emails
- **Impact**: Team must leave CRM to send emails
- **Estimated Time**: 6-7 hours

**7. Enhanced Contact Interactions** ⚠️ 70%
- ✅ Basic logging works
- ❌ Missing scheduling (scheduled_at, completed_at)
- ❌ Missing status field
- ❌ Missing outcome tracking
- ❌ Missing priority levels
- **Impact**: Contacts can't have scheduled tasks
- **Estimated Time**: 2-3 hours

**8. Advanced Task Features** ⚠️ 40%
- ✅ Basic CRUD works
- ❌ Overdue tasks endpoint
- ❌ Upcoming tasks endpoint
- ❌ Bulk complete tasks
- ❌ Task categories/labels
- ❌ Recurring tasks
- **Impact**: Limited task management capabilities
- **Estimated Time**: 4-5 hours

---

#### Nice-to-Have (Priority 3)

**9. Interaction Search & Filtering** ❌ 0%
- ❌ Global search across all interactions
- ❌ Full-text search on subject/description
- ❌ Advanced filters (date range, type, user, entity)
- ❌ Saved searches
- **Estimated Time**: 6-8 hours

**10. Interaction Analytics** ❌ 0%
- ❌ Charts and graphs
- ❌ Interaction volume over time
- ❌ Response time trends
- ❌ User activity reports
- ❌ Template performance metrics
- **Estimated Time**: 6-8 hours

**11. Email Attachments** ❌ 0%
- ❌ Store email attachments
- ❌ Download attachments
- ❌ Attach files to manual interactions
- **Estimated Time**: 5-6 hours

**12. Calendar Integration** ❌ 0%
- ❌ Google Calendar sync
- ❌ Outlook Calendar sync
- ❌ Auto-log meetings from calendar
- ❌ Create calendar events from CRM
- **Estimated Time**: 10-12 hours

**13. Mobile App / Responsive Improvements** ⚠️ 60%
- ✅ Desktop works great
- ⚠️ Mobile responsive but not optimized
- ❌ Push notifications
- ❌ Offline mode
- **Estimated Time**: 8-10 hours

**14. WhatsApp Integration** ❌ 0%
- ❌ WhatsApp Business API integration
- ❌ Auto-log WhatsApp messages
- ❌ Send WhatsApp from CRM
- **Estimated Time**: 12-15 hours

**15. SMS Integration (Twilio)** ⚠️ Twilio integration exists for calling, not SMS logging
- ⚠️ Twilio setup exists
- ❌ Auto-log SMS messages
- ❌ Send SMS from CRM
- **Estimated Time**: 4-5 hours

---

## PRIORITY IMPLEMENTATION PLAN

---

## **PRIORITY 1: ESSENTIAL FEATURES** 🔴
### *(Must implement before production launch)*

Total Estimated Time: **40-50 hours** (5-6 days)

---

### **Feature 1.1: Account Interactions**
**Why Critical**: Cannot track customer support, renewals, or license discussions without this
**Estimated Time**: 7-9 hours

#### Database Changes
```sql
-- Create account_interactions table
CREATE TABLE account_interactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),  -- which contact we spoke with
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Interaction details
    interaction_type VARCHAR(50) NOT NULL,  -- support, renewal, license_discussion, upgrade
    direction VARCHAR(20) NOT NULL,
    subject VARCHAR(500),
    content TEXT,
    outcome VARCHAR(100),

    -- Support-specific
    ticket_number VARCHAR(100),
    severity VARCHAR(20),  -- low, medium, high, critical
    resolution TEXT,

    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    status VARCHAR(50) DEFAULT 'completed',
    priority VARCHAR(20) DEFAULT 'medium',

    -- User tracking
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_account_interactions_account ON account_interactions(account_id);
CREATE INDEX idx_account_interactions_org ON account_interactions(organization_id);
CREATE INDEX idx_account_interactions_contact ON account_interactions(contact_id);
CREATE INDEX idx_account_interactions_type ON account_interactions(interaction_type);
CREATE INDEX idx_account_interactions_created ON account_interactions(created_at DESC);

-- RLS
ALTER TABLE account_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_interactions_isolation ON account_interactions
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Triggers
CREATE TRIGGER update_account_interactions_updated_at
    BEFORE UPDATE ON account_interactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Backend Implementation
**File**: `routes/accountInteractions.js` (NEW)

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/connection');

// POST /api/accounts/:accountId/interactions - Create interaction
router.post('/:accountId/interactions', authenticateToken, async (req, res) => {
  // Similar to leadInteractions.js
  // Validate account exists and belongs to org
  // Insert into account_interactions
  // Return created interaction
});

// GET /api/accounts/:accountId/interactions - List interactions
router.get('/:accountId/interactions', authenticateToken, async (req, res) => {
  // Fetch with filters
  // Join with users, contacts tables
  // Return sorted by date
});

// PUT /api/accounts/:accountId/interactions/:id - Update
// DELETE /api/accounts/:accountId/interactions/:id - Delete
// GET /api/accounts/:accountId/interactions/stats - Statistics

module.exports = router;
```

**Register in server.js**:
```javascript
const accountInteractionsRoutes = require('./routes/accountInteractions');
app.use('/api/accounts', accountInteractionsRoutes);
```

#### Frontend Implementation
**File**: `frontend/src/components/AccountInteractions.jsx` (NEW)

```jsx
// Copy from ContactInteractions.jsx
// Adapt for account-specific fields
// Add support ticket UI elements
// Add severity indicator
```

**File**: `frontend/src/services/api.js` - Add to accountsAPI:
```javascript
export const accountsAPI = {
  // ... existing methods

  // Account Interactions
  getInteractions: async (accountId, params = {}) => {
    const response = await api.get(`/accounts/${accountId}/interactions`, { params })
    return response.data
  },

  createInteraction: async (accountId, data) => {
    const response = await api.post(`/accounts/${accountId}/interactions`, data)
    return response.data
  },

  // ... more methods
}
```

#### Testing Requirements
- [ ] Create support ticket interaction for account
- [ ] Create renewal discussion interaction
- [ ] Link interaction to specific contact
- [ ] Filter interactions by type
- [ ] View interaction timeline on account detail page
- [ ] Multi-tenant: Cannot see other org's account interactions

**✅ Success Criteria**:
- Account detail page shows interaction timeline
- Can log support tickets with severity
- Can track renewal discussions
- Interactions linked to both account and contact

---

### **Feature 1.2: Gmail Integration & Auto-Lead Creation**
**Why Critical**: Core automation requirement for B2C CRM
**Estimated Time**: 12-15 hours

#### Database Changes
```sql
-- Create email_sync_records table
CREATE TABLE email_sync_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),

    -- Gmail integration
    gmail_message_id VARCHAR(500) UNIQUE NOT NULL,
    thread_id VARCHAR(500),

    -- Email details
    from_email VARCHAR(255) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    cc_emails TEXT[],
    subject VARCHAR(1000),
    body_text TEXT,
    body_html TEXT,

    -- Entity linking
    lead_id UUID REFERENCES leads(id),
    contact_id UUID REFERENCES contacts(id),
    account_id UUID REFERENCES accounts(id),

    -- SLA tracking
    received_at TIMESTAMP WITH TIME ZONE NOT NULL,
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    response_needed BOOLEAN DEFAULT TRUE,
    responded_at TIMESTAMP WITH TIME ZONE,
    sla_violated BOOLEAN DEFAULT FALSE,

    -- Attachments
    has_attachments BOOLEAN DEFAULT FALSE,
    attachment_count INTEGER DEFAULT 0,

    -- Status
    sync_status VARCHAR(50) DEFAULT 'synced',
    error_message TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_sync_org ON email_sync_records(organization_id);
CREATE INDEX idx_email_sync_lead ON email_sync_records(lead_id);
CREATE INDEX idx_email_sync_contact ON email_sync_records(contact_id);
CREATE INDEX idx_email_sync_received ON email_sync_records(received_at DESC);
CREATE INDEX idx_email_sync_response_needed ON email_sync_records(response_needed, responded_at);

-- RLS
ALTER TABLE email_sync_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_sync_isolation ON email_sync_records
    FOR ALL USING (organization_id = current_setting('app.current_organization_id')::UUID);

-- Organizations table - add Gmail credentials column
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gmail_oauth_tokens JSONB;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gmail_sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS last_gmail_sync TIMESTAMP WITH TIME ZONE;
```

#### Backend Implementation

**File**: `services/gmailAuth.js` (NEW)
```javascript
const { google } = require('googleapis');
const db = require('../database/connection');

class GmailAuthService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
  }

  // Generate OAuth URL for organization to authorize
  getAuthUrl(organizationId) {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: organizationId  // Pass org ID in state
    });
  }

  // Exchange auth code for tokens
  async exchangeCode(code, organizationId) {
    const { tokens } = await this.oauth2Client.getToken(code);

    // Store tokens in database
    await db.query(
      `UPDATE organizations
       SET gmail_oauth_tokens = $1, gmail_sync_enabled = TRUE
       WHERE id = $2`,
      [JSON.stringify(tokens), organizationId]
    );

    return tokens;
  }

  // Get authenticated Gmail client for organization
  async getGmailClient(organizationId) {
    const result = await db.query(
      'SELECT gmail_oauth_tokens FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (!result.rows[0]?.gmail_oauth_tokens) {
      throw new Error('Gmail not connected for this organization');
    }

    const tokens = result.rows[0].gmail_oauth_tokens;
    this.oauth2Client.setCredentials(tokens);

    return google.gmail({ version: 'v1', auth: this.oauth2Client });
  }
}

module.exports = new GmailAuthService();
```

**File**: `services/emailSyncService.js` (NEW)
```javascript
const gmailAuth = require('./gmailAuth');
const db = require('../database/connection');

class EmailSyncService {
  async syncGmailEmails(organizationId) {
    const gmail = await gmailAuth.getGmailClient(organizationId);

    // Get last sync time
    const lastSync = await this.getLastSyncTime(organizationId);

    // Fetch emails since last sync
    const query = `after:${Math.floor(lastSync.getTime() / 1000)}`;
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100
    });

    if (!response.data.messages) return;

    for (const message of response.data.messages) {
      await this.processEmail(gmail, message.id, organizationId);
    }

    // Update last sync time
    await db.query(
      'UPDATE organizations SET last_gmail_sync = NOW() WHERE id = $1',
      [organizationId]
    );
  }

  async processEmail(gmail, messageId, organizationId) {
    // Fetch full email
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });

    const headers = email.data.payload.headers;
    const from = headers.find(h => h.name === 'From').value;
    const to = headers.find(h => h.name === 'To').value;
    const subject = headers.find(h => h.name === 'Subject')?.value || '';

    // Extract email address
    const fromEmail = this.extractEmail(from);

    // Check if sender exists
    let lead = await this.findLeadByEmail(fromEmail, organizationId);
    let contact = await this.findContactByEmail(fromEmail, organizationId);

    if (!lead && !contact) {
      // Create new lead from unknown sender
      lead = await this.createLeadFromEmail(from, fromEmail, organizationId);
    }

    // Store email sync record
    await this.storeEmailRecord({
      organizationId,
      gmailMessageId: messageId,
      fromEmail,
      toEmail: this.extractEmail(to),
      subject,
      body: this.extractBody(email.data.payload),
      leadId: lead?.id,
      contactId: contact?.id,
      receivedAt: new Date(parseInt(email.data.internalDate))
    });

    // Log interaction
    if (lead) {
      await this.createLeadInteraction(lead.id, subject, this.extractBody(email.data.payload));
    } else if (contact) {
      await this.createContactInteraction(contact.id, subject, this.extractBody(email.data.payload));
    }
  }

  async createLeadFromEmail(fullFrom, email, organizationId) {
    // Parse "John Doe <john@example.com>" format
    const name = fullFrom.replace(/<.*>/, '').trim();
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ') || '';

    const result = await db.query(
      `INSERT INTO leads (
        organization_id, first_name, last_name, email,
        source, status, created_at
      ) VALUES ($1, $2, $3, $4, 'Email Inbound', 'New', NOW())
      RETURNING *`,
      [organizationId, firstName || 'Unknown', lastName, email]
    );

    return result.rows[0];
  }

  extractEmail(str) {
    const match = str.match(/<(.+?)>/);
    return match ? match[1] : str;
  }

  extractBody(payload) {
    // Extract plain text body from email payload
    // ... implementation
  }

  async findLeadByEmail(email, organizationId) {
    const result = await db.query(
      'SELECT * FROM leads WHERE email = $1 AND organization_id = $2',
      [email, organizationId]
    );
    return result.rows[0];
  }

  async findContactByEmail(email, organizationId) {
    const result = await db.query(
      'SELECT * FROM contacts WHERE email = $1 AND organization_id = $2',
      [email, organizationId]
    );
    return result.rows[0];
  }

  async storeEmailRecord(data) {
    await db.query(
      `INSERT INTO email_sync_records (
        organization_id, gmail_message_id, from_email, to_email,
        subject, body_text, lead_id, contact_id, received_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        data.organizationId, data.gmailMessageId, data.fromEmail,
        data.toEmail, data.subject, data.body, data.leadId,
        data.contactId, data.receivedAt
      ]
    );
  }

  async createLeadInteraction(leadId, subject, description) {
    await db.query(
      `INSERT INTO lead_interactions (
        lead_id, organization_id, interaction_type, subject,
        description, response_needed, created_at
      )
      SELECT $1, organization_id, 'email', $2, $3, TRUE, NOW()
      FROM leads WHERE id = $1`,
      [leadId, subject, description]
    );
  }

  async getLastSyncTime(organizationId) {
    const result = await db.query(
      'SELECT last_gmail_sync FROM organizations WHERE id = $1',
      [organizationId]
    );
    return result.rows[0]?.last_gmail_sync || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default: 7 days ago
  }
}

module.exports = new EmailSyncService();
```

**File**: `cron/emailSync.js` (NEW)
```javascript
const cron = require('node-cron');
const emailSyncService = require('../services/emailSyncService');
const db = require('../database/connection');

// Run every 10 minutes
cron.schedule('*/10 * * * *', async () => {
  console.log('🔄 Starting Gmail sync...');

  // Get all organizations with Gmail sync enabled
  const result = await db.query(
    'SELECT id FROM organizations WHERE gmail_sync_enabled = TRUE'
  );

  for (const org of result.rows) {
    try {
      await emailSyncService.syncGmailEmails(org.id);
      console.log(`✅ Synced Gmail for org ${org.id}`);
    } catch (error) {
      console.error(`❌ Gmail sync failed for org ${org.id}:`, error);
    }
  }
});

module.exports = {};
```

**File**: `routes/gmail.js` (NEW)
```javascript
const express = require('express');
const router = express.Router();
const gmailAuth = require('../services/gmailAuth');
const emailSyncService = require('../services/emailSyncService');
const { authenticateToken } = require('../middleware/auth');

// GET /api/gmail/auth-url - Get OAuth URL for connecting Gmail
router.get('/auth-url', authenticateToken, async (req, res) => {
  const url = gmailAuth.getAuthUrl(req.user.organizationId);
  res.json({ authUrl: url });
});

// GET /api/gmail/callback - OAuth callback (redirected from Google)
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;  // state = organizationId

  await gmailAuth.exchangeCode(code, state);

  res.redirect('/settings?gmail=connected');
});

// POST /api/gmail/sync - Trigger manual sync
router.post('/sync', authenticateToken, async (req, res) => {
  await emailSyncService.syncGmailEmails(req.user.organizationId);
  res.json({ message: 'Sync completed' });
});

// GET /api/gmail/status - Check if Gmail is connected
router.get('/status', authenticateToken, async (req, res) => {
  const result = await db.query(
    'SELECT gmail_sync_enabled, last_gmail_sync FROM organizations WHERE id = $1',
    [req.user.organizationId]
  );

  res.json({
    connected: result.rows[0]?.gmail_sync_enabled || false,
    lastSync: result.rows[0]?.last_gmail_sync
  });
});

module.exports = router;
```

**Register in server.js**:
```javascript
const gmailRoutes = require('./routes/gmail');
app.use('/api/gmail', gmailRoutes);

// Start cron jobs
require('./cron/emailSync');
```

**Install Dependencies**:
```bash
npm install googleapis node-cron
```

**Environment Variables** (`.env`):
```
GMAIL_CLIENT_ID=your_client_id_from_google_cloud
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/api/gmail/callback
```

#### Frontend Implementation
**File**: `frontend/src/components/GmailIntegration.jsx` (NEW)

```jsx
import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';

const GmailIntegration = () => {
  const [status, setStatus] = useState({ connected: false, lastSync: null });

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    const response = await api.get('/gmail/status');
    setStatus(response.data);
  };

  const connectGmail = async () => {
    const response = await api.get('/gmail/auth-url');
    window.location.href = response.data.authUrl;
  };

  const triggerSync = async () => {
    await api.post('/gmail/sync');
    fetchStatus();
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Gmail Integration</h3>

      {status.connected ? (
        <div>
          <div className="flex items-center text-green-600 mb-4">
            <CheckCircle className="w-5 h-5 mr-2" />
            Gmail Connected
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Last sync: {status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}
          </p>
          <button
            onClick={triggerSync}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Sync Now
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center text-gray-600 mb-4">
            <AlertCircle className="w-5 h-5 mr-2" />
            Gmail Not Connected
          </div>
          <button
            onClick={connectGmail}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            <Mail className="w-4 h-4 mr-2" />
            Connect Gmail
          </button>
        </div>
      )}
    </div>
  );
};

export default GmailIntegration;
```

#### Testing Requirements
- [ ] Connect Gmail account via OAuth
- [ ] Trigger manual sync - emails appear in email_sync_records
- [ ] Email from unknown sender creates new lead automatically
- [ ] Email from known lead logs interaction
- [ ] Email from known contact logs interaction
- [ ] Cron job runs every 10 minutes (check logs)
- [ ] response_needed flag set to TRUE for incoming emails
- [ ] Multi-tenant: Only syncs emails for the correct organization

**✅ Success Criteria**:
- Gmail OAuth flow works end-to-end
- Emails sync automatically every 10 minutes
- Unknown sender emails create leads with name extracted
- Known sender emails log interactions
- All emails stored in email_sync_records table

---

### **Feature 1.3: SLA Tracking (1-Hour Response Time)**
**Why Critical**: Accountability and customer satisfaction
**Estimated Time**: 5-6 hours

#### Database Changes
```sql
-- Add SLA tracking to email_sync_records (already in schema above)
-- Add SLA alert preferences to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sla_response_hours INTEGER DEFAULT 1;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sla_alert_email VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sla_alerts_enabled BOOLEAN DEFAULT TRUE;
```

#### Backend Implementation

**File**: `services/slaTrackingService.js` (NEW)
```javascript
const db = require('../database/connection');
const nodemailer = require('nodemailer');

class SLATrackingService {
  async checkSLAViolations() {
    // Find emails needing response that are past SLA
    const violations = await db.query(`
      SELECT
        esr.*,
        o.sla_response_hours,
        o.sla_alert_email,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        EXTRACT(EPOCH FROM (NOW() - esr.received_at))/3600 as hours_pending
      FROM email_sync_records esr
      JOIN organizations o ON esr.organization_id = o.id
      LEFT JOIN leads l ON esr.lead_id = l.id
      LEFT JOIN contacts c ON esr.contact_id = c.id
      WHERE esr.response_needed = TRUE
        AND esr.responded_at IS NULL
        AND esr.sla_violated = FALSE
        AND esr.received_at < NOW() - (o.sla_response_hours || ' hours')::INTERVAL
        AND o.sla_alerts_enabled = TRUE
    `);

    for (const violation of violations.rows) {
      // Send alert
      await this.sendSLAAlert(violation);

      // Mark as violated
      await db.query(
        'UPDATE email_sync_records SET sla_violated = TRUE WHERE id = $1',
        [violation.id]
      );
    }

    return violations.rows.length;
  }

  async sendSLAAlert(violation) {
    const transporter = nodemailer.createTransporter({
      // SMTP config from env
    });

    const entityName = violation.lead_first_name
      ? `${violation.lead_first_name} ${violation.lead_last_name}`
      : `${violation.contact_first_name} ${violation.contact_last_name}`;

    await transporter.sendMail({
      to: violation.sla_alert_email,
      subject: `⚠️ SLA Violation: Email from ${entityName}`,
      html: `
        <h2>SLA Violation Alert</h2>
        <p><strong>From:</strong> ${violation.from_email}</p>
        <p><strong>Subject:</strong> ${violation.subject}</p>
        <p><strong>Received:</strong> ${new Date(violation.received_at).toLocaleString()}</p>
        <p><strong>Time Pending:</strong> ${Math.floor(violation.hours_pending)} hours</p>
        <p><strong>SLA Target:</strong> ${violation.sla_response_hours} hour(s)</p>
        <p><a href="${process.env.FRONTEND_URL}/leads/${violation.lead_id || violation.contact_id}">View in CRM</a></p>
      `
    });
  }

  async markEmailResponded(emailSyncRecordId) {
    await db.query(
      'UPDATE email_sync_records SET responded_at = NOW(), response_needed = FALSE WHERE id = $1',
      [emailSyncRecordId]
    );
  }

  async getSLAStats(organizationId) {
    const stats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE response_needed = TRUE AND responded_at IS NULL) as pending_responses,
        COUNT(*) FILTER (WHERE sla_violated = TRUE) as total_violations,
        COUNT(*) FILTER (WHERE response_needed = FALSE AND responded_at IS NOT NULL) as total_responded,
        AVG(EXTRACT(EPOCH FROM (responded_at - received_at))/3600) FILTER (WHERE responded_at IS NOT NULL) as avg_response_hours
      FROM email_sync_records
      WHERE organization_id = $1
        AND received_at >= NOW() - INTERVAL '30 days'
    `, [organizationId]);

    return stats.rows[0];
  }
}

module.exports = new SLATrackingService();
```

**File**: `cron/slaMonitoring.js` (NEW)
```javascript
const cron = require('node-cron');
const slaTrackingService = require('../services/slaTrackingService');

// Run every 15 minutes
cron.schedule('*/15 * * * *', async () => {
  console.log('⏰ Checking SLA violations...');
  const count = await slaTrackingService.checkSLAViolations();
  console.log(`Found ${count} SLA violations`);
});

module.exports = {};
```

**File**: `routes/sla.js` (NEW)
```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const slaTrackingService = require('../services/slaTrackingService');
const db = require('../database/connection');

// GET /api/sla/dashboard - Get SLA dashboard data
router.get('/dashboard', authenticateToken, async (req, res) => {
  const stats = await slaTrackingService.getSLAStats(req.user.organizationId);

  // Get pending responses
  const pending = await db.query(`
    SELECT
      esr.*,
      l.first_name as lead_first_name,
      l.last_name as lead_last_name,
      c.first_name as contact_first_name,
      c.last_name as contact_last_name,
      EXTRACT(EPOCH FROM (NOW() - esr.received_at))/3600 as hours_pending
    FROM email_sync_records esr
    LEFT JOIN leads l ON esr.lead_id = l.id
    LEFT JOIN contacts c ON esr.contact_id = c.id
    WHERE esr.organization_id = $1
      AND esr.response_needed = TRUE
      AND esr.responded_at IS NULL
    ORDER BY esr.received_at ASC
    LIMIT 20
  `, [req.user.organizationId]);

  res.json({
    stats,
    pending: pending.rows
  });
});

// POST /api/sla/mark-responded/:emailId - Mark email as responded
router.post('/mark-responded/:emailId', authenticateToken, async (req, res) => {
  await slaTrackingService.markEmailResponded(req.params.emailId);
  res.json({ message: 'Email marked as responded' });
});

module.exports = router;
```

**Register in server.js**:
```javascript
const slaRoutes = require('./routes/sla');
app.use('/api/sla', slaRoutes);

require('./cron/slaMonitoring');
```

#### Frontend Implementation
**File**: `frontend/src/components/SLADashboard.jsx` (NEW)

```jsx
import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import api from '../services/api';

const SLADashboard = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    const response = await api.get('/sla/dashboard');
    setData(response.data);
  };

  const markResponded = async (emailId) => {
    await api.post(`/sla/mark-responded/${emailId}`);
    fetchDashboard();
  };

  if (!data) return <div>Loading...</div>;

  const { stats, pending } = data;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Responses</p>
              <p className="text-3xl font-bold">{stats.pending_responses}</p>
            </div>
            <Clock className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">SLA Violations</p>
              <p className="text-3xl font-bold text-red-600">{stats.total_violations}</p>
            </div>
            <AlertCircle className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-3xl font-bold">{stats.avg_response_hours?.toFixed(1)}h</p>
            </div>
            <TrendingUp className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Responded (30d)</p>
              <p className="text-3xl font-bold">{stats.total_responded}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>
      </div>

      {/* Pending Responses List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Pending Responses</h3>
        </div>
        <div className="divide-y">
          {pending.map(email => {
            const isViolated = email.hours_pending > 1;
            return (
              <div key={email.id} className={`p-4 ${isViolated ? 'bg-red-50' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{email.from_email}</p>
                      {isViolated && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded">
                          SLA VIOLATED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{email.subject}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Received {Math.floor(email.hours_pending)} hours ago
                    </p>
                  </div>
                  <button
                    onClick={() => markResponded(email.id)}
                    className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Mark Responded
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SLADashboard;
```

#### Testing Requirements
- [ ] Email received - response_needed = TRUE
- [ ] After 1 hour - SLA alert email sent
- [ ] Email marked as sla_violated = TRUE
- [ ] SLA dashboard shows pending count
- [ ] SLA dashboard shows violations count
- [ ] Mark email as responded - updates responded_at
- [ ] Average response time calculated correctly
- [ ] Cron job runs every 15 minutes

**✅ Success Criteria**:
- SLA alerts sent when emails exceed 1-hour threshold
- Dashboard shows real-time pending responses
- Can mark emails as responded from dashboard
- Average response time tracked and displayed

---

### **Feature 1.4: Enhance Contact Interactions**
**Why Critical**: Contacts currently can't have scheduled tasks
**Estimated Time**: 2-3 hours

#### Database Changes
```sql
-- Add missing columns to contact_interactions
ALTER TABLE contact_interactions ADD COLUMN IF NOT EXISTS outcome VARCHAR(100);
ALTER TABLE contact_interactions ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contact_interactions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contact_interactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'completed';
ALTER TABLE contact_interactions ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium';
ALTER TABLE contact_interactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add trigger for updated_at
CREATE TRIGGER update_contact_interactions_updated_at
    BEFORE UPDATE ON contact_interactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### Backend Implementation
**Update**: `routes/contacts.js` - Modify interaction endpoints to handle new fields

```javascript
// In POST /contacts/:id/interactions endpoint
const {
  interaction_type,
  direction,
  subject,
  content,
  outcome,
  duration_minutes,
  scheduled_at,
  priority
} = req.body;

const status = scheduled_at && new Date(scheduled_at) > new Date()
  ? 'scheduled'
  : 'completed';

const completed_at = status === 'completed' ? new Date() : null;

const interaction = await Contact.createInteraction(
  req.params.id,
  req.user.userId,
  {
    interaction_type,
    direction,
    subject,
    content,
    outcome,
    duration_minutes,
    scheduled_at,
    completed_at,
    status,
    priority
  }
);
```

#### Frontend Implementation
**Update**: `frontend/src/components/ContactInteractions.jsx`
- Add scheduled task support
- Show status badges (scheduled/completed)
- Add complete task button
- Filter by status

#### Testing Requirements
- [ ] Create scheduled task for contact
- [ ] Task shows "scheduled" status
- [ ] Complete task - status changes to "completed"
- [ ] Filter tasks by status
- [ ] Outcome field saves correctly

**✅ Success Criteria**:
- Contacts can have scheduled tasks just like leads
- Task scheduling works with date/time picker
- Can mark contact tasks as completed

---

## **PRIORITY 2: IMPORTANT FEATURES** 🟡
### *(Implement after P1, significantly improves usability)*

Total Estimated Time: **30-35 hours** (4-5 days)

---

### **Feature 2.1: Email Template System**
**Estimated Time**: 11-13 hours

[... Detailed implementation plan similar to P1 features ...]

### **Feature 2.2: Email Composer within CRM**
**Estimated Time**: 6-7 hours

### **Feature 2.3: Advanced Task Features**
**Estimated Time**: 4-5 hours

### **Feature 2.4: Cross-Entity Interaction Linking**
**Estimated Time**: 4-5 hours

---

## **PRIORITY 3: ENHANCEMENTS** 🟢
### *(Future improvements, nice to have)*

Total Estimated Time: **20-25 hours** (3-4 days)

- Interaction Search & Analytics
- Email Attachments
- Calendar Integration
- Mobile Optimization
- WhatsApp Integration
- SMS Integration

---

## RECOMMENDED FIRST STEPS

### Immediate Actions (Today)

1. **Review and approve this plan** - Discuss priorities with stakeholders

2. **Set up Gmail OAuth credentials**
   - Go to Google Cloud Console
   - Create OAuth 2.0 credentials
   - Add to `.env` file

3. **Run Priority 1 database migrations**
   ```bash
   psql -U postgres -d uppal_crm -f account_interactions.sql
   psql -U postgres -d uppal_crm -f email_sync_records.sql
   psql -U postgres -d uppal_crm -f enhance_contact_interactions.sql
   ```

### Week 1 Plan

**Days 1-2**: Account Interactions (9 hours)
- Create database table
- Build backend API
- Build frontend UI
- Test end-to-end

**Days 3-5**: Gmail Integration (15 hours)
- Gmail OAuth setup
- Email sync service
- Auto-lead creation logic
- Cron job
- Frontend integration
- Testing

**Day 5**: SLA Tracking (6 hours)
- SLA monitoring service
- SLA dashboard
- Alert system
- Testing

**Total Week 1**: ~30 hours (P1 complete ✅)

### Week 2 Plan

**Days 1-3**: Email Templates (13 hours)
- Database schema
- Template CRUD API
- Approval workflow
- Template editor UI
- Renderer
- Testing

**Days 3-5**: Email Composer (7 hours)
- Email composer component
- Template integration
- SMTP integration
- Testing

**Day 5**: Advanced Tasks (5 hours)
- Overdue tasks endpoint
- Upcoming tasks endpoint
- Bulk operations

**Total Week 2**: ~25 hours (P2 complete ✅)

---

## QUESTIONS FOR CLARIFICATION

1. **Gmail Account**: Which Gmail account will be used for sales@company.com?
   - Do you already have this set up?
   - Who has access to the Gmail account?

2. **SLA Alerts**: Who should receive SLA violation alerts?
   - Sales manager only?
   - All team members?
   - Configurable per organization?

3. **Email Templates**: Who approves email templates?
   - Organization admin?
   - Specific role?
   - Self-approval for small teams?

4. **Priority Ordering**: Do you agree with the priority order?
   - Any features you'd like to move between P1/P2/P3?
   - Any features to add or remove?

5. **Timeline**: Is 2 weeks for P1+P2 acceptable?
   - Need it faster? We can parallelize work.
   - Need more features in initial launch?

6. **SMTP Configuration**: For sending emails from CRM
   - Use Gmail SMTP?
   - Use SendGrid/Mailgun?
   - What's your preference?

7. **Account Interactions**: What interaction types are most important?
   - Support tickets?
   - Renewal discussions?
   - License upgrades?
   - Custom types needed?

---

## APPENDIX: FILE LOCATIONS

### Database Files
- `database/comprehensive-leads-migration.sql` - Lead interactions schema
- `database/migrations/016_enhance_lead_interactions.sql` - Lead interaction enhancements
- `database/migrations/017_interaction_events.sql` - Interaction events system
- `database/contact-management-schema.sql` - Contact interactions schema

### Backend Files
- `routes/leadInteractions.js` - Lead interactions API ✅
- `routes/contacts.js` - Contact interactions API ✅
- `services/emailSyncService.js` - Gmail sync service ❌ (TO CREATE)
- `services/gmailAuth.js` - Gmail OAuth service ❌ (TO CREATE)
- `services/slaTrackingService.js` - SLA tracking service ❌ (TO CREATE)
- `services/emailTemplateService.js` - Template rendering ❌ (TO CREATE)
- `cron/emailSync.js` - Email sync cron job ❌ (TO CREATE)
- `cron/slaMonitoring.js` - SLA monitoring cron ❌ (TO CREATE)

### Frontend Files
- `frontend/src/components/AddInteractionModal.jsx` - Lead interaction modal ✅
- `frontend/src/components/InteractionsTimeline.jsx` - Lead timeline ✅
- `frontend/src/components/ContactInteractions.jsx` - Contact interactions ✅
- `frontend/src/components/InteractionForm.jsx` - Reusable form ✅
- `frontend/src/components/GmailIntegration.jsx` - Gmail settings ❌ (TO CREATE)
- `frontend/src/components/SLADashboard.jsx` - SLA dashboard ❌ (TO CREATE)
- `frontend/src/components/EmailComposer.jsx` - Email composer ❌ (TO CREATE)
- `frontend/src/services/api.js` - API client ✅

---

**END OF AUDIT REPORT**

---

*Generated by Claude Code - Interactions Agent*
*Report Date: December 2, 2025*
