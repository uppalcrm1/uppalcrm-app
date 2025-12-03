# Agent: Interactions Management

## Project Context

- **Project Name**: Uppal CRM2
- **Architecture**: Two-tier multi-tenant B2C CRM
- **Backend**: Node.js + Express.js (Port 3000)
- **Frontend**: React + Vite (Port 3002)
- **Database**: PostgreSQL with RLS

## Agent Purpose

This agent manages ALL communication logging, activity tracking, task management, and interaction history across the entire B2C CRM system. It handles how users communicate with leads, contacts, and accounts through multiple channels (email, phone, SMS, WhatsApp) and tracks all activities, tasks, and follow-ups.

## Scope & Responsibilities

1. **Communication logging** - emails, calls, SMS, WhatsApp messages
2. **Activity tracking** - meetings, notes, follow-ups
3. **Task management** - create, assign, complete tasks
4. **Email integration** - Gmail sync, auto-lead creation
5. **Email template management** - admin-approved templates
6. **SLA monitoring** - 1-hour response time tracking
7. **Communication history** - timeline views
8. **Interaction analytics** - reporting on communication patterns
9. **Multi-channel tracking** - support all communication types
10. **Automatic logging** - from various sources (Gmail, etc.)

---

## System Architecture

### Interaction Flow
```
User → Multiple Channels (Email, Phone, SMS, WhatsApp)
     → Interaction Logging
     → Entity Association (Lead/Contact/Account)
     → History Timeline
     → Analytics & Reporting
```

### Cross-Entity Interactions

This is a B2C CRM where interactions span across multiple entities:

- **Lead Interactions**: Communication with prospects during sales process
- **Contact Interactions**: Communication with existing customers
- **Account Interactions**: Support and renewal discussions about specific licenses
- **General Activities**: Tasks, meetings, and follow-ups that may or may not be entity-specific

---

## Database Schema

### Core Tables

#### `lead_interactions`
- `id` (UUID, primary key)
- `lead_id` (UUID, foreign key → leads.id)
- `user_id` (UUID, foreign key → users.id) - who logged it
- `interaction_type` (enum: call, email, sms, whatsapp, meeting, note, task)
- `subject` (VARCHAR(255))
- `description` (TEXT)
- `outcome` (VARCHAR(100))
- `scheduled_at` (TIMESTAMP)
- `completed_at` (TIMESTAMP)
- `duration_minutes` (INTEGER)
- `status` (enum: scheduled, completed, cancelled)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

#### `contact_interactions`
- Same structure as `lead_interactions`
- `contact_id` (UUID, foreign key → contacts.id)

#### `account_interactions`
- Same structure as `lead_interactions`
- `account_id` (UUID, foreign key → accounts.id)

#### `email_sync_records`
- `id` (UUID, primary key)
- `organization_id` (UUID)
- `gmail_message_id` (VARCHAR)
- `from_email` (VARCHAR)
- `to_email` (VARCHAR)
- `subject` (VARCHAR)
- `body_text` (TEXT)
- `body_html` (TEXT)
- `received_at` (TIMESTAMP)
- `synced_at` (TIMESTAMP)
- `lead_id` (UUID, nullable) - auto-created or matched
- `contact_id` (UUID, nullable)
- `response_needed` (BOOLEAN)
- `responded_at` (TIMESTAMP, nullable)

#### `email_templates`
- `id` (UUID, primary key)
- `organization_id` (UUID)
- `name` (VARCHAR)
- `category` (enum: welcome, follow_up, trial, renewal, support)
- `subject` (VARCHAR)
- `body` (TEXT) - supports placeholders
- `is_approved` (BOOLEAN)
- `approved_by` (UUID, nullable)
- `approved_at` (TIMESTAMP, nullable)
- `created_by` (UUID)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `usage_count` (INTEGER, default 0)

#### `tasks`
- `id` (UUID, primary key)
- `organization_id` (UUID)
- `title` (VARCHAR)
- `description` (TEXT)
- `task_type` (enum: call, email, meeting, research, follow_up)
- `priority` (enum: low, medium, high, urgent)
- `status` (enum: pending, in_progress, completed, cancelled)
- `assigned_to` (UUID, foreign key → users.id)
- `created_by` (UUID, foreign key → users.id)
- `due_date` (TIMESTAMP)
- `completed_at` (TIMESTAMP, nullable)
- `lead_id` (UUID, nullable)
- `contact_id` (UUID, nullable)
- `account_id` (UUID, nullable)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

---

## Important Business Rules

### 1. Multi-Channel Tracking
- Support email, phone calls, SMS, WhatsApp, in-person meetings
- Each channel has specific metadata (duration for calls, outcome for emails, etc.)
- All interactions logged with consistent timestamp and user tracking

### 2. Email Integration
- Shared Gmail account (sales@company.com) for entire team
- Backend syncs emails every 5-15 minutes
- Automatic matching to existing leads/contacts by email address
- Unknown sender emails automatically create new leads
- Track "response needed" flag for incoming communications
- 1-hour SLA for responses

### 3. Auto-Lead Creation from Emails
```
Workflow:
1. Email received at sales@company.com
2. Check if sender email exists in leads/contacts
3. If YES → Log interaction for that entity
4. If NO → Create new lead with email, log interaction
5. Set response_needed = TRUE
6. Alert team if no response within 1 hour
```

### 4. 1-Hour SLA Tracking
- All incoming communications flagged as "response needed"
- Dashboard shows pending responses
- Alert if no response within 1 hour
- Track average response time per user
- Monthly SLA compliance reports

### 5. Complete History
- Every interaction must be logged with:
  - Timestamp (when it happened or was logged)
  - Type (call, email, SMS, meeting, note, task)
  - User who logged it
  - Entity it relates to (lead/contact/account)
  - Outcome or status
  - Full description/notes
- Interactions displayed in chronological timeline
- Never delete interactions (audit trail)

### 6. Email Templates
- Admin creates and approves templates
- Support placeholders: `{{firstName}}`, `{{lastName}}`, `{{companyName}}`, `{{licenseCount}}`, etc.
- Categories: Welcome, Follow-up, Trial, Renewal, Support
- Track usage count per template
- Version control for template updates

### 7. Task Management
- Tasks linked to leads, contacts, or accounts
- Assign to team members
- Set due dates and priorities (low, medium, high, urgent)
- Track completion status
- Reminder notifications (future enhancement)
- Task categories: Call, Email, Meeting, Research, Follow-up

### 8. Cross-Entity Tracking
- Same interaction can relate to multiple entities
  - Example: Call about renewing Account A with Contact B
  - Log in both account_interactions and contact_interactions
- Tasks can be entity-specific or general

---

## Key Files & Components

### Backend Files

#### Routes
- `routes/leadInteractions.js` - Lead interaction CRUD
- `routes/contactInteractions.js` - Contact interaction CRUD
- `routes/accountInteractions.js` - Account interaction CRUD
- `routes/emailSync.js` - Gmail sync endpoints
- `routes/emailTemplates.js` - Template management
- `routes/tasks.js` - Task CRUD and assignment

#### Services
- `services/emailSyncService.js` - Gmail API integration, auto-lead creation
- `services/emailTemplateService.js` - Template rendering with placeholders
- `services/slaTrackingService.js` - SLA monitoring and alerts
- `services/notificationService.js` - Alert team about pending responses

#### Cron Jobs
- `cron/emailSync.js` - Run every 5-15 minutes to sync Gmail
- `cron/slaMonitoring.js` - Check for SLA violations every 15 minutes

#### Models (if using ORM)
- `models/LeadInteraction.js`
- `models/ContactInteraction.js`
- `models/AccountInteraction.js`
- `models/EmailSyncRecord.js`
- `models/EmailTemplate.js`
- `models/Task.js`

### Frontend Files

#### Components
- `components/AddInteractionModal.jsx` - Quick log interaction
- `components/InteractionsTimeline.jsx` - Display interaction history
- `components/TaskList.jsx` - Show tasks for entity
- `components/TaskCreateModal.jsx` - Create new task
- `components/EmailComposer.jsx` - Send email with templates
- `components/EmailTemplateSelector.jsx` - Choose and preview templates
- `components/SLADashboard.jsx` - Show pending responses
- `components/InteractionAnalytics.jsx` - Communication reports

#### Pages
- `pages/InteractionsPage.jsx` - All interactions view
- `pages/TasksPage.jsx` - Task management
- `pages/EmailTemplatesPage.jsx` - Template admin
- `pages/SLAMonitoringPage.jsx` - Response tracking

#### Services
- `services/api.js` - Add interaction API methods:
  - `leadInteractionsAPI`
  - `contactInteractionsAPI`
  - `accountInteractionsAPI`
  - `emailTemplatesAPI`
  - `tasksAPI`
  - `slaAPI`

---

## Interaction Types

### 1. Email
- **Auto-logged** from Gmail sync
- **Manual send** through CRM using templates
- **Fields**: subject, body, from, to, sent_at, response_needed
- **Outcome**: Sent, Received, Bounced, Opened (if tracking)

### 2. Phone Call
- **Manually logged** after call
- **Fields**: duration_minutes, outcome, notes
- **Outcomes**: Successful, No Answer, Voicemail Left, Callback Requested, Not Interested

### 3. SMS/Text
- **Manually logged**
- **Fields**: message_text, sent_at, received_at
- **Future**: Twilio integration for auto-logging

### 4. WhatsApp
- **Manually logged**
- **Fields**: message_text, sent_at, received_at
- **Future**: WhatsApp Business API integration

### 5. Meeting
- **Manually logged** or scheduled
- **Fields**: scheduled_at, duration_minutes, meeting_type (in-person, zoom, phone), outcome
- **Status**: Scheduled, Completed, Cancelled, No-show

### 6. Note
- **General notes** about lead/contact
- **Fields**: description, note_type (general, research, competitive_intel)
- **No outcome** required

### 7. Task
- **Action items** with due dates
- **Fields**: title, description, due_date, priority, assigned_to, status
- **Status**: Pending, In Progress, Completed, Cancelled

### 8. Follow-up
- **Scheduled reminders**
- **Fields**: scheduled_at, follow_up_type (call, email, meeting), notes
- **Auto-creates task** when scheduled

---

## Gmail Integration Workflow

### Email Sync Process

```javascript
// Pseudo-code for email sync service
async function syncGmailEmails() {
  // 1. Get all organizations with Gmail integration
  const orgs = await getOrgsWithGmail();

  for (const org of orgs) {
    // 2. Connect to Gmail API
    const gmail = await connectGmail(org.gmail_credentials);

    // 3. Fetch new emails since last sync
    const lastSyncTime = await getLastSyncTime(org.id);
    const emails = await gmail.getEmailsSince(lastSyncTime);

    for (const email of emails) {
      // 4. Check if sender exists
      const lead = await findLeadByEmail(email.from);
      const contact = await findContactByEmail(email.from);

      if (!lead && !contact) {
        // 5. Create new lead if unknown sender
        const newLead = await createLead({
          email: email.from,
          first_name: extractFirstName(email.from),
          source: 'Email Inbound',
          status: 'New',
          organization_id: org.id
        });

        // 6. Log interaction for new lead
        await createLeadInteraction({
          lead_id: newLead.id,
          interaction_type: 'email',
          subject: email.subject,
          description: email.body,
          response_needed: true,
          created_at: email.received_at
        });
      } else if (lead) {
        // 7. Log interaction for existing lead
        await createLeadInteraction({
          lead_id: lead.id,
          interaction_type: 'email',
          subject: email.subject,
          description: email.body,
          response_needed: !email.is_sent_by_us,
          created_at: email.received_at
        });
      } else if (contact) {
        // 8. Log interaction for existing contact
        await createContactInteraction({
          contact_id: contact.id,
          interaction_type: 'email',
          subject: email.subject,
          description: email.body,
          response_needed: !email.is_sent_by_us,
          created_at: email.received_at
        });
      }

      // 9. Store email sync record
      await createEmailSyncRecord({
        organization_id: org.id,
        gmail_message_id: email.id,
        from_email: email.from,
        to_email: email.to,
        subject: email.subject,
        body_text: email.body,
        received_at: email.received_at,
        synced_at: new Date(),
        lead_id: lead?.id || newLead?.id,
        contact_id: contact?.id,
        response_needed: !email.is_sent_by_us
      });
    }

    // 10. Update last sync time
    await updateLastSyncTime(org.id, new Date());
  }
}
```

### Auto-Lead Creation Logic

```javascript
function extractFirstName(email) {
  // Extract name from email
  // Examples:
  // "John Smith <john@example.com>" → "John"
  // "john.smith@example.com" → "John"
  const match = email.match(/^([^<]+)</);
  if (match) {
    const name = match[1].trim();
    return name.split(' ')[0];
  }

  const username = email.split('@')[0];
  const name = username.replace(/[._-]/g, ' ');
  return name.split(' ')[0].charAt(0).toUpperCase() + name.split(' ')[0].slice(1);
}
```

---

## SLA Tracking

### SLA Monitoring Service

```javascript
async function checkSLAViolations() {
  // Find all interactions needing response
  const pendingResponses = await db.query(`
    SELECT
      li.*,
      l.first_name, l.last_name, l.email,
      EXTRACT(EPOCH FROM (NOW() - li.created_at))/3600 as hours_pending
    FROM lead_interactions li
    JOIN leads l ON li.lead_id = l.id
    WHERE li.response_needed = TRUE
      AND li.responded_at IS NULL
      AND li.interaction_type = 'email'
    ORDER BY li.created_at ASC
  `);

  // Alert for violations (> 1 hour)
  const violations = pendingResponses.filter(r => r.hours_pending > 1);

  for (const violation of violations) {
    await sendSLAAlert({
      lead_name: `${violation.first_name} ${violation.last_name}`,
      lead_email: violation.email,
      subject: violation.subject,
      hours_pending: violation.hours_pending,
      interaction_id: violation.id
    });
  }

  // Return stats
  return {
    total_pending: pendingResponses.length,
    violations: violations.length,
    average_response_time: calculateAverageResponseTime()
  };
}
```

### SLA Dashboard Component

Display:
- **Pending Responses** (count)
- **SLA Violations** (count and list)
- **Average Response Time** (last 7 days, last 30 days)
- **Response Time by User** (leaderboard)
- **Oldest Pending Response** (alert)

---

## Email Templates

### Template Structure

```javascript
{
  id: 'uuid',
  name: 'Welcome New Lead',
  category: 'welcome',
  subject: 'Welcome to {{companyName}}!',
  body: `
    Hi {{firstName}},

    Thanks for your interest in {{productName}}!

    I wanted to personally reach out and see if you have any questions
    about our {{licenseType}} license.

    Would you be available for a quick 15-minute call this week?

    Best regards,
    {{senderName}}
    {{senderTitle}}
  `,
  is_approved: true,
  approved_by: 'admin-uuid',
  approved_at: '2024-01-15T10:00:00Z',
  usage_count: 47
}
```

### Supported Placeholders

**Lead/Contact Fields:**
- `{{firstName}}` - Lead/Contact first name
- `{{lastName}}` - Lead/Contact last name
- `{{email}}` - Lead/Contact email
- `{{companyName}}` - Lead company name
- `{{phoneNumber}}` - Lead/Contact phone

**Account Fields:**
- `{{licenseType}}` - Account license type
- `{{licenseCount}}` - Number of licenses
- `{{expiryDate}}` - License expiry date
- `{{renewalPrice}}` - Renewal price

**Organization Fields:**
- `{{organizationName}}` - Your organization name
- `{{organizationPhone}}` - Your phone number
- `{{productName}}` - Product name

**User Fields:**
- `{{senderName}}` - Current user's full name
- `{{senderFirstName}}` - Current user's first name
- `{{senderEmail}}` - Current user's email
- `{{senderTitle}}` - Current user's job title
- `{{senderPhone}}` - Current user's phone

### Template Rendering

```javascript
function renderTemplate(template, data) {
  let rendered = template.body;

  // Replace all placeholders
  for (const [key, value] of Object.entries(data)) {
    const placeholder = new RegExp(`{{${key}}}`, 'g');
    rendered = rendered.replace(placeholder, value || '');
  }

  // Check for unreplaced placeholders
  const unreplaced = rendered.match(/{{.*?}}/g);
  if (unreplaced) {
    console.warn('Unreplaced placeholders:', unreplaced);
  }

  return rendered;
}
```

---

## Common User Workflows

### 1. Quick Log Call
**User Story**: After finishing a phone call with a lead, user quickly logs the interaction.

**Steps**:
1. User clicks "Log Call" button on lead detail page
2. Modal opens with call form pre-selected
3. User enters:
   - Duration: 15 minutes
   - Outcome: "Successful - Interested in demo"
   - Notes: "Discussed pricing for 10-user license. Needs approval from manager. Follow up in 2 days."
4. User clicks "Save"
5. Interaction appears in timeline
6. Optional: Create follow-up task for 2 days from now

**Implementation**: `AddInteractionModal.jsx`, POST `/api/leads/:id/interactions`

### 2. View Interaction History
**User Story**: User wants to see all communication history with a lead before making a call.

**Steps**:
1. User opens lead detail page
2. Scrolls to "Activity Timeline" section
3. Sees chronological list of all interactions:
   - Yesterday: Email sent using "Follow-up" template
   - 3 days ago: Phone call (15 min) - No answer
   - 1 week ago: Initial email received (auto-logged from Gmail)
   - 1 week ago: Lead created from inbound email
4. User clicks "Add Interaction" to log new call

**Implementation**: `InteractionsTimeline.jsx`, GET `/api/leads/:id/interactions`

### 3. Send Email with Template
**User Story**: User wants to send a follow-up email to a lead using a pre-approved template.

**Steps**:
1. User clicks "Send Email" on lead page
2. Email composer opens
3. User selects "Follow-up After Trial" template from dropdown
4. Template loads with placeholders filled:
   - "Hi John," (first name)
   - "Thanks for trying our software..." (template content)
   - Signature auto-added
5. User edits as needed
6. User clicks "Send"
7. Email sent via SMTP
8. Interaction auto-logged
9. Template usage_count incremented

**Implementation**: `EmailComposer.jsx`, POST `/api/email/send`

### 4. Create Task During Call
**User Story**: During a call, user realizes they need to send pricing information. They create a task for themselves.

**Steps**:
1. User is on call with lead (not in CRM yet)
2. After call, user clicks "Log Call"
3. Fills in call details
4. Checks "Create follow-up task" checkbox
5. Task modal appears with:
   - Title: "Send pricing for 10-user license"
   - Type: Email
   - Priority: High
   - Due: Today
   - Assigned to: Self
6. User saves both call interaction and task
7. Task appears in "My Tasks" list

**Implementation**: `AddInteractionModal.jsx` → `TaskCreateModal.jsx`, POST `/api/tasks`

### 5. Check SLA Dashboard
**User Story**: Sales manager checks which emails need urgent responses.

**Steps**:
1. User navigates to SLA Dashboard
2. Sees summary:
   - 3 pending responses
   - 1 SLA violation (email from 2 hours ago)
   - Average response time: 45 minutes (within SLA)
3. User clicks on violated email
4. Opens lead detail page
5. Reads email, clicks "Send Email"
6. Replies to lead
7. Interaction logged as "Email sent"
8. Original email marked as responded_at = NOW()
9. SLA dashboard updates: 2 pending, 0 violations

**Implementation**: `SLADashboard.jsx`, GET `/api/sla/dashboard`

### 6. Search Interactions
**User Story**: User remembers discussing pricing with a lead but can't remember which one. They search for it.

**Steps**:
1. User goes to Interactions page (global view, not lead-specific)
2. Enters search: "pricing discussion"
3. Results show:
   - 5 interactions across 3 leads containing "pricing"
   - Filtered by date range: Last 30 days
4. User clicks on relevant interaction
5. Navigates to lead detail page
6. Sees full interaction in context of timeline

**Implementation**: `InteractionsPage.jsx`, GET `/api/interactions/search?q=pricing`

---

## Design Principles

### 1. Quick Logging (3 Clicks or Less)
- Quick action buttons on lead/contact pages
- Modal forms with smart defaults
- Keyboard shortcuts for common actions
- Auto-save drafts

### 2. Automatic Where Possible
- Auto-log all emails from Gmail sync
- Auto-create leads from unknown senders
- Auto-fill templates with entity data
- Auto-detect duration for timestamped calls

### 3. Complete History
- Never delete interactions (soft delete if needed)
- Audit trail of who logged what and when
- Full-text search across all interactions
- Export functionality for compliance

### 4. Multi-Channel Support
- Treat all channels equally important
- Consistent UI for all interaction types
- Support future channels (WhatsApp, Slack, etc.)

### 5. SLA Compliance
- Always show what needs attention
- Color-coded urgency (green, yellow, red)
- Dashboard for managers
- Reports for accountability

### 6. Team Collaboration
- Everyone sees all interactions (within organization)
- Assign tasks to teammates
- Tag team members in notes
- Activity feed for team awareness

### 7. Template Consistency
- Encourage use of approved templates
- Track which templates convert best
- Version control for template updates
- A/B testing templates (future)

### 8. Mobile-Friendly
- Log interactions from phone during/after calls
- Responsive design for all components
- Push notifications for task reminders
- Offline mode (future)

---

## Integration Points

### With Other Modules

#### Leads Module
- Log interactions during lead nurturing
- Auto-update lead status based on interactions
- Track lead engagement score
- Integrate with lead assignment rules

#### Contacts Module
- Track customer communication history
- Monitor customer health score
- Log support interactions
- Track onboarding progress

#### Accounts Module
- Log renewal discussions
- Track support tickets as interactions
- Monitor license usage discussions
- Document escalations

#### Team Module
- Assign tasks to team members
- Track user activity and performance
- Leaderboards for response time
- Workload balancing

#### Analytics Module
- Communication frequency reports
- Conversion rates by interaction type
- Template performance metrics
- SLA compliance reports

### External Integrations

#### Gmail API
- Sync emails every 5-15 minutes
- OAuth 2.0 authentication
- Send emails through Gmail SMTP
- Handle attachments

#### Twilio (Future)
- Auto-log SMS messages
- Send SMS from CRM
- Track delivery status
- Cost tracking

#### WhatsApp Business API (Future)
- Auto-log WhatsApp messages
- Send WhatsApp messages from CRM
- Template messages
- Read receipts

#### Calendar Integration (Future)
- Google Calendar / Outlook sync
- Auto-log meetings
- Send calendar invites
- Reminder notifications

---

## API Endpoints

### Lead Interactions

```
GET    /api/leads/:leadId/interactions           - List all interactions
POST   /api/leads/:leadId/interactions           - Create interaction
GET    /api/leads/:leadId/interactions/:id       - Get single interaction
PUT    /api/leads/:leadId/interactions/:id       - Update interaction
DELETE /api/leads/:leadId/interactions/:id       - Delete interaction
PATCH  /api/leads/:leadId/interactions/:id/complete - Mark as completed
```

### Contact Interactions

```
GET    /api/contacts/:contactId/interactions     - List all interactions
POST   /api/contacts/:contactId/interactions     - Create interaction
GET    /api/contacts/:contactId/interactions/:id - Get single interaction
PUT    /api/contacts/:contactId/interactions/:id - Update interaction
DELETE /api/contacts/:contactId/interactions/:id - Delete interaction
```

### Account Interactions

```
GET    /api/accounts/:accountId/interactions     - List all interactions
POST   /api/accounts/:accountId/interactions     - Create interaction
GET    /api/accounts/:accountId/interactions/:id - Get single interaction
PUT    /api/accounts/:accountId/interactions/:id - Update interaction
DELETE /api/accounts/:accountId/interactions/:id - Delete interaction
```

### Email Templates

```
GET    /api/email-templates                      - List all templates
POST   /api/email-templates                      - Create template
GET    /api/email-templates/:id                  - Get single template
PUT    /api/email-templates/:id                  - Update template
DELETE /api/email-templates/:id                  - Delete template
POST   /api/email-templates/:id/approve          - Approve template
POST   /api/email-templates/:id/preview          - Preview with data
```

### Tasks

```
GET    /api/tasks                                - List all tasks (with filters)
POST   /api/tasks                                - Create task
GET    /api/tasks/:id                            - Get single task
PUT    /api/tasks/:id                            - Update task
DELETE /api/tasks/:id                            - Delete task
PATCH  /api/tasks/:id/complete                   - Mark as completed
PATCH  /api/tasks/:id/assign                     - Assign to user
GET    /api/tasks/my-tasks                       - Get current user's tasks
```

### Email Sync

```
POST   /api/email/sync                           - Trigger manual sync
GET    /api/email/sync-status                    - Get sync status
GET    /api/email/sync-history                   - Get sync history
```

### SLA Monitoring

```
GET    /api/sla/dashboard                        - SLA dashboard data
GET    /api/sla/pending-responses                - List pending responses
GET    /api/sla/violations                       - List SLA violations
GET    /api/sla/stats                            - Response time statistics
```

### Global Interactions

```
GET    /api/interactions/search                  - Search all interactions
GET    /api/interactions/recent                  - Recent interactions across all entities
GET    /api/interactions/analytics               - Interaction analytics
```

---

## Testing Checklist

### Basic Interaction Logging
- [ ] Log phone call for lead
- [ ] Log email for contact
- [ ] Log meeting for account
- [ ] Log note without specific entity
- [ ] Create task with due date
- [ ] View interaction timeline for lead
- [ ] Edit existing interaction
- [ ] Delete interaction

### Multi-Entity Interactions
- [ ] Log same call for both contact and account
- [ ] Task appears in both entity timelines
- [ ] Search finds interaction across entities

### Email Integration
- [ ] Gmail sync runs automatically
- [ ] Email from known lead logged correctly
- [ ] Email from unknown sender creates new lead
- [ ] Lead created with correct name extracted from email
- [ ] Response needed flag set for incoming emails
- [ ] Sent emails logged automatically

### Email Templates
- [ ] Admin creates new template
- [ ] Admin approves template
- [ ] User selects template in email composer
- [ ] Placeholders filled correctly
- [ ] Email sent successfully
- [ ] Template usage count incremented

### SLA Tracking
- [ ] Incoming email sets response_needed flag
- [ ] SLA dashboard shows pending responses
- [ ] Alert triggered after 1 hour
- [ ] Response marks email as responded
- [ ] Average response time calculated correctly

### Task Management
- [ ] Create task assigned to self
- [ ] Create task assigned to teammate
- [ ] Filter tasks by status
- [ ] Filter tasks by due date
- [ ] Complete task
- [ ] Task completion updates timeline

### Security & Multi-Tenancy
- [ ] User in Org A cannot see Org B interactions
- [ ] User cannot create interaction for lead in another org
- [ ] User cannot see email templates from other orgs
- [ ] Tasks only visible to assigned users in same org

---

## Success Criteria

✅ All interaction types can be logged (email, call, SMS, WhatsApp, meeting, note, task)

✅ Gmail sync automatically creates leads from unknown senders

✅ Interaction timeline displays chronologically with proper icons and colors

✅ Email templates support placeholders and render correctly

✅ SLA monitoring alerts team of pending responses > 1 hour

✅ Task management with assignment and due dates works

✅ Multi-entity interactions link to all related entities

✅ Search functionality finds interactions across all entities

✅ Multi-tenant security enforced on all endpoints

✅ Mobile-responsive UI for logging on the go

✅ No console errors, all API calls successful

✅ Analytics show interaction patterns and response times

---

## Example Interactions

### Example 1: Initial Email from Prospect

**Gmail Sync Receives:**
```
From: john.doe@example.com
To: sales@yourcrm.com
Subject: Interested in your software
Body: Hi, I'm looking for a CRM solution for my team of 10. Can you send me pricing information?
Received: 2024-01-20 10:30 AM
```

**System Actions:**
1. Check if john.doe@example.com exists → NOT FOUND
2. Create new lead:
   - First name: John
   - Last name: Doe
   - Email: john.doe@example.com
   - Company: example.com (extracted from domain)
   - Source: Email Inbound
   - Status: New
3. Create lead_interaction:
   - Type: email
   - Subject: "Interested in your software"
   - Description: Email body
   - Response needed: TRUE
   - Created at: 2024-01-20 10:30 AM
4. Alert sales team: "New lead from email: John Doe - Interested in your software"

**Next Steps:**
- Sales rep responds within 1 hour
- Response logged as new interaction
- Original interaction marked as responded_at = NOW()

### Example 2: Follow-up Call After Trial

**User Actions:**
1. Opens lead "John Doe"
2. Clicks "Log Call"
3. Fills form:
   - Type: Call
   - Duration: 20 minutes
   - Outcome: "Successful - Ready to purchase"
   - Notes: "John loved the trial. Wants to purchase 10-user license. Needs quote sent today. Mentioned they're comparing with Competitor X."
4. Checks "Create follow-up task"
5. Task: "Send quote for 10-user license" - Due today, Priority: High
6. Saves

**System Actions:**
1. Creates lead_interaction for call
2. Creates task linked to lead
3. Updates lead's last_contact_date
4. Suggests moving lead to "Closed Won" status
5. Task appears in user's task list

---

## Future Enhancements

### Phase 2 Features
- WhatsApp integration
- SMS integration via Twilio
- Calendar sync (Google/Outlook)
- Voice call recording
- Email tracking (open/click rates)
- Meeting notes with AI summary
- Attachment support for interactions

### Phase 3 Features
- AI-suggested responses
- Sentiment analysis on communications
- Automated follow-up suggestions
- Predictive lead scoring based on interactions
- Team collaboration tools (comments, mentions)
- Mobile app for logging on the go
- Offline mode with sync when online

---

## Common Issues & Troubleshooting

### Gmail Sync Not Working
**Check:**
- OAuth credentials valid and not expired
- Gmail API enabled in Google Cloud Console
- Correct scopes granted (read, send, modify)
- Organization has gmail_credentials in database
- Cron job running on schedule

### Auto-Lead Creation Creates Duplicates
**Check:**
- Email matching logic (case-insensitive)
- Check both leads and contacts tables
- Verify email normalization (trim, lowercase)
- Check for multiple email addresses in "From" field

### SLA Alerts Not Triggering
**Check:**
- response_needed flag set correctly on incoming emails
- SLA monitoring cron job running
- Alert service (email/SMS) configured
- Business hours configuration (if applicable)
- User notification preferences

### Template Placeholders Not Replacing
**Check:**
- Placeholder syntax correct: `{{firstName}}` not `{firstName}`
- Data object has all required fields
- Field names match exactly (case-sensitive)
- Template approved and active

---

## Agent Usage Instructions

When helping with interaction management tasks, follow these guidelines:

1. **Always verify multi-tenant security** - Ensure all queries filter by organization_id
2. **Log comprehensively** - Every communication should create an interaction record
3. **Maintain data consistency** - Update related entities when interactions are logged
4. **Follow SLA rules** - Set response_needed flag for all incoming communications
5. **Use templates** - Encourage template usage for consistency
6. **Link entities** - Associate interactions with all relevant entities (lead/contact/account)
7. **Track outcomes** - Always capture the result of each interaction
8. **Enable search** - Ensure all text fields are searchable
9. **Preserve history** - Never delete interactions, use soft delete if needed
10. **Monitor performance** - Track response times and SLA compliance

---

## Quick Reference Commands

### Common Queries

**Get all interactions for a lead:**
```sql
SELECT * FROM lead_interactions
WHERE lead_id = 'uuid'
ORDER BY created_at DESC;
```

**Find pending email responses:**
```sql
SELECT * FROM lead_interactions
WHERE interaction_type = 'email'
  AND response_needed = TRUE
  AND responded_at IS NULL
ORDER BY created_at ASC;
```

**Get SLA violations:**
```sql
SELECT * FROM lead_interactions
WHERE interaction_type = 'email'
  AND response_needed = TRUE
  AND responded_at IS NULL
  AND created_at < NOW() - INTERVAL '1 hour';
```

**Count interactions by type:**
```sql
SELECT interaction_type, COUNT(*)
FROM lead_interactions
WHERE organization_id = 'uuid'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY interaction_type;
```

**Get tasks due today:**
```sql
SELECT * FROM tasks
WHERE assigned_to = 'user_uuid'
  AND status != 'completed'
  AND due_date::date = CURRENT_DATE
ORDER BY priority DESC, due_date ASC;
```

---

## Conclusion

This agent is the **communication backbone** of the CRM. Every customer touchpoint flows through this system, making it critical for:
- Sales tracking and follow-up
- Customer support history
- Team collaboration and task management
- SLA compliance and response time monitoring
- Analytics and reporting

When implementing or modifying interaction features, always consider:
1. **Multi-channel support** - Don't favor one channel over others
2. **Ease of logging** - Make it quick and painless
3. **Complete history** - Never lose an interaction
4. **Team visibility** - Everyone should see what's happening
5. **Automation** - Auto-log when possible, manual when necessary
