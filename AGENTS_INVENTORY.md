# Uppal CRM - Agents Inventory

## Overview
This document provides a comprehensive inventory of all existing agents in the Uppal CRM2 application.

**Last Updated:** January 5, 2026  
**Total Agents Found:** 7 agents (6 main + 1 sub-agent)

---

## Agent Directory Structure

```
agents/
├── account-management.md
├── contact-management.md
├── interactions-management.md
├── reporting-management.md
├── transaction-management.md
├── twilio-integration.md
└── 02-leads-enhancements/
    └── 02-1-interactions.md
```

---

## 1. Account Management Agent

**File:** `agents/account-management.md`

**Purpose:** Manages the software licensing and subscription system for individual customers (B2C model).

**Key Responsibilities:**
- Account lifecycle management (creation, activation, renewal, cancellation)
- Product management (Gold, Jio, Smart) - **Display as "Product" to users**
- Device registration & MAC address binding
- Billing cycle management (monthly, quarterly, semi-annual, annual)
- License generation & validation
- 24-hour trial management
- License transfer system
- Renewal tracking & alerts
- Account analytics (MRR, ARR, churn, etc.)

**Critical Terminology Standard:**
- **User-facing:** Always use "Product" (not "Software Edition" or "Edition")
- **Database/Code:** Keep `software_editions` table name (internal only)
- **Examples:** "Select Product", "Product Name", "Upgrade Product"

**What It Manages:**
- Accounts table (device/license records)
- Products catalog (software_editions table)
- Device registrations (MAC addresses)
- Software licenses (active licenses)
- Trials (24-hour trial management)
- License transfers (device transfer history)

---

## 2. Contact Management Agent

**File:** `agents/contact-management.md`

**Purpose:** Manages individual customers in the B2C CRM system.

**Key Responsibilities:**
- Contact CRUD operations
- Lead to contact conversion
- Account creation for contacts
- License & trial management per contact
- Device management per contact
- Contact interactions tracking
- Software editions catalog
- Contact analytics and statistics

**What It Manages:**
- Contacts table (individual customers)
- Contact-to-account relationships
- Lead conversion tracking
- Contact interactions history

---

## 3. Interactions Management Agent

**File:** `agents/interactions-management.md`

**Purpose:** Manages ALL communication logging, activity tracking, and task management across the entire CRM.

**Key Responsibilities:**
- Communication logging (emails, calls, SMS, WhatsApp)
- Activity tracking (meetings, notes, follow-ups)
- Task management (create, assign, complete)
- Email integration (Gmail sync, auto-lead creation)
- Email template management (admin-approved templates)
- SLA monitoring (1-hour response time tracking)
- Communication history timeline
- Interaction analytics
- Multi-channel tracking

**Email Integration Features:**
- Shared Gmail account for entire team
- Backend syncs emails every 5-15 minutes
- Automatic matching to existing leads/contacts
- Unknown sender emails automatically create new leads
- Track "response needed" flag
- 1-hour SLA for responses

**What It Manages:**
- lead_interactions table
- contact_interactions table
- account_interactions table
- email_sync_records table
- email_templates table
- tasks table
- sms_auto_responses table

---

## 4. Reporting & Analytics Agent

**File:** `agents/reporting-management.md`

**Purpose:** Handles ALL analytics, reporting, dashboards, and business intelligence for the B2C CRM.

**Key Responsibilities:**

### Revenue Analytics
- Total revenue (all time)
- Revenue this month
- Revenue by product (Gold, Jio, Smart)
- Revenue by payment method
- Revenue by source
- Average transaction value
- Revenue growth (MoM, YoY)
- Monthly Recurring Revenue (MRR)
- Annual Recurring Revenue (ARR)

### Customer Metrics
- Total contacts (customers)
- New contacts this month
- Active contacts
- Customer lifetime value (CLV)
- Customer acquisition by source
- Customer retention rate

### Account Metrics
- Total accounts (software licenses)
- Active accounts
- Accounts by product
- Accounts by billing cycle
- Upcoming renewals
- Renewal rate
- Cancelled accounts

### Sales Performance
- Lead-to-contact conversion rate
- Conversion time
- Sales by team member
- Sales by source
- Pipeline value
- New leads tracking

**Critical Business Model:**
- **NO trials system, NO complex licensing**
- Simple flow: Lead → Contact → Account → Transaction
- One Account = One Device License = One MAC Address

**Database Schema Focus:**
- Simplified B2C model
- Revenue calculations exclude soft-deleted and voided transactions
- Always filter by organization_id for multi-tenant isolation

---

## 5. Transaction Management Agent

**File:** `agents/transaction-management.md`

**Purpose:** Manages all payment and transaction records in the B2C software licensing system.

**Key Responsibilities:**
- Transaction recording & tracking
- Payment information management
- Transaction-to-Account-to-Contact relationships
- Revenue analytics & reporting
- Transaction list page & UI
- Transaction detail views
- Custom transaction ID format ("Account Name - Term")
- Financial data integrity

**Transaction ID Format:**
- Custom format: "Account Name - Term"
- Example: "manjit singh tv - 1 year"
- User-friendly identification

**Revenue Model:**
- Subscription-based licensing
- Transactions capture payment details during lead conversion and renewals
- Payment method and source tracking for analytics
- Transaction-based financial reporting

**What It Manages:**
- Transactions table (payment records)
- Payment methods tracking
- Payment sources tracking
- Revenue calculations (MRR, ARR)
- Refund processing
- Invoice generation

---

## 6. Twilio Integration Agent

**File:** `agents/twilio-integration.md`

**Purpose:** Complete Twilio SMS and Voice integration for the CRM.

**Key Responsibilities:**
- Send SMS messages to leads and contacts
- Receive SMS messages (with auto-lead creation)
- Make phone calls from the CRM
- Receive incoming calls (with call logging)
- Track all SMS/call interactions
- Use SMS templates for common messages
- Send automated SMS notifications

**Features:**
- Multi-tenant Twilio configuration (per organization)
- SMS message tracking (sent and received)
- Phone call tracking with recording
- SMS templates management
- Auto-response rules (keyword-based, business hours)
- Webhook integration for status updates
- Cost tracking per message/call

**Database Tables:**
- twilio_config (per organization credentials)
- sms_messages (sent and received)
- phone_calls (call history)
- sms_templates (pre-written messages)
- sms_auto_responses (automation rules)

**Integration Points:**
- Twilio API for SMS and Voice
- Webhook endpoints for status updates
- Integration with Leads and Contacts pages
- Automatic interaction logging

---

## 7. Lead Interactions Sub-Agent

**File:** `agents/02-leads-enhancements/02-1-interactions.md`

**Purpose:** Specialized agent for lead-specific activity timeline and interactions.

**Key Responsibilities:**
- Log phone calls with leads
- Log emails sent/received
- Schedule meetings
- Add notes to leads
- Create follow-up tasks
- View activity timeline for each lead
- Edit/delete interactions

**Interaction Types:**
1. **Call** - Phone calls with duration and outcome
2. **Email** - Email communications
3. **Meeting** - Scheduled meetings
4. **Note** - General notes
5. **Task** - Follow-up tasks with due dates

**Features:**
- Visual timeline with icons
- Scheduled vs completed states
- Color-coded interaction types
- User attribution
- Outcome tracking
- Duration tracking (for calls/meetings)

---

## Business Model Summary

**Uppal CRM2 is a B2C Software Licensing System:**
- NOT a B2B CRM - sells to individual customers
- One Contact (customer) → Multiple Accounts (licenses/devices)
- One Account = One Software License = One Device (MAC address)
- Focus: Individual device licensing, trials, renewals, transfers

**Revenue Model:**
- Subscription-based licensing (Monthly, Quarterly, Semi-Annual, Annual)
- 24-hour free trials (unlimited per customer per product)
- Device-specific activation (MAC address binding)
- Automated renewal tracking

---

## Technical Architecture

**Backend:**
- Node.js + Express.js (Port 3000)
- PostgreSQL database with Row-Level Security (RLS)
- Multi-tenant architecture

**Frontend:**
- React + Vite (Port 3002)
- TanStack Query (React Query) for data fetching
- Tailwind CSS for styling

**Security:**
- JWT authentication
- Multi-tenant isolation via organization_id
- Row-Level Security (RLS) policies
- All queries scoped by organization

---

## Agent Dependencies & Relationships

```
┌─────────────────────────────────────────────┐
│         Interactions Management             │
│  (Central hub for all communications)       │
└─────────────┬───────────────────────────────┘
              │
    ┌─────────┴─────────┐
    │                   │
┌───▼────┐         ┌────▼──────┐
│ Leads  │         │ Contacts  │
│ Agent  │         │  Agent    │
└───┬────┘         └────┬──────┘
    │                   │
    │    ┌──────────────▼──────┐
    └────► Account Management  │
         │       Agent          │
         └──────────┬───────────┘
                    │
         ┌──────────▼───────────┐
         │  Transaction Agent   │
         └──────────────────────┘
                    │
         ┌──────────▼───────────┐
         │  Reporting Agent     │
         │   (Analytics)        │
         └──────────────────────┘

External Integration:
┌──────────────────┐
│  Twilio Agent    │
│  (SMS/Voice)     │
└──────────────────┘
```

---

## Critical Terminology Standards

### Product vs Software Edition
- **✅ CORRECT (User-facing):** "Product", "Product Name", "Select Product"
- **❌ WRONG (User-facing):** "Software Edition", "Edition", "Select Edition"
- **✅ OK (Database/Code):** `software_editions` table, `software_edition_id` field

### Display Names
| Database/Code | User Display | Notes |
|---------------|--------------|-------|
| software_editions | "Product" | Table name stays same |
| software_edition_id | "Product" dropdown | Field name stays same |
| edition_name | "Product Name" | Display changes |

---

## Security Best Practices

1. **Multi-Tenant Isolation:**
   - Always filter by organization_id
   - Use RLS policies on all tables
   - Validate ownership before operations

2. **Data Integrity:**
   - Soft delete instead of hard delete
   - Always use transactions for financial operations
   - Validate foreign key relationships

3. **Access Control:**
   - Authenticate all API requests
   - Validate user permissions
   - Prevent cross-organization access

4. **Data Protection:**
   - Never expose sensitive credentials
   - Encrypt payment information
   - Hash license keys

---

## Next Steps

If you need to work with any of these agents:

1. **Read the agent file** in the `agents/` directory
2. **Follow the specifications** exactly as written
3. **Test thoroughly** with the provided test cases
4. **Maintain terminology standards** (especially "Product" vs "Software Edition")
5. **Respect multi-tenant security** boundaries

---

## Questions or Issues?

If you need clarification on any agent:
1. Refer to the specific agent file in `agents/` directory
2. Check the CRITICAL sections in each agent file
3. Review the "What Already Exists" section
4. Follow the testing checklist provided

---

**End of Agents Inventory**
