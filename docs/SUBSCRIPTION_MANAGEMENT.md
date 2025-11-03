# Subscription Management System

**Status:** ✅ Deployed
**Migration:** `002_add_subscription_fields.sql`
**Date:** November 3, 2025

---

## Overview

The subscription management system enables super admins to track and manage organization subscriptions, billing, and trial periods directly from the admin dashboard.

---

## Database Schema

### New Fields in `organizations` Table

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `contact_email` | VARCHAR(255) | NULL | Primary contact email for the business |
| `contact_phone` | VARCHAR(50) | NULL | Contact phone number |
| `subscription_status` | VARCHAR(50) | 'trial' | Current subscription status |
| `trial_ends_at` | TIMESTAMP | NULL | When the trial period ends |
| `billing_email` | VARCHAR(255) | NULL | Email for billing/invoices |
| `payment_method` | VARCHAR(100) | NULL | Payment method description |
| `last_payment_date` | TIMESTAMP | NULL | Last successful payment |
| `next_billing_date` | TIMESTAMP | NULL | Next billing date |
| `monthly_cost` | DECIMAL(10,2) | 0 | Current monthly cost |
| `notes` | TEXT | NULL | Internal admin notes |

---

## Subscription Status Values

The `subscription_status` field can have the following values:

| Status | Description | Actions |
|--------|-------------|---------|
| `trial` | Organization is in trial period | Convert to paid or suspend when trial ends |
| `active` | Paid subscription, in good standing | Normal access to all features |
| `past_due` | Payment failed or overdue | Send reminders, limited grace period |
| `cancelled` | Subscription cancelled by user | Archive after grace period |
| `suspended` | Access suspended by admin | Reactivate or permanently close |

---

## Database Constraints & Indexes

### Check Constraint
```sql
CHECK (subscription_status IN ('trial', 'active', 'past_due', 'cancelled', 'suspended'))
```

### Performance Indexes
- `idx_organizations_subscription_status` - For filtering by status
- `idx_organizations_trial_ends_at` - For finding expiring trials
- `idx_organizations_next_billing_date` - For billing reminders

---

## Helper Functions

### `update_expired_trials()`
**Purpose:** Automatically updates organizations with expired trials to suspended status

**Usage:**
```sql
SELECT update_expired_trials();
```

**Recommended:** Run this via cron job daily or hourly

---

### `calculate_next_billing_date(last_billing)`
**Purpose:** Calculates next monthly billing date

**Usage:**
```sql
SELECT calculate_next_billing_date('2025-11-03'::TIMESTAMP WITH TIME ZONE);
-- Returns: 2025-12-03
```

**Example:**
```sql
UPDATE organizations
SET next_billing_date = calculate_next_billing_date(last_payment_date)
WHERE subscription_status = 'active';
```

---

## Running the Migration

### Local/Development
```bash
npm run migrate:subscription
```

### Production (Render)
The migration automatically runs against the `DATABASE_URL` environment variable.

```bash
npm run migrate:subscription
```

### Verification
After running, check the output for:
- ✅ All 10 columns added
- ✅ 3 indexes created
- ✅ 1 constraint added
- ✅ Sample organization data shows new fields

---

## API Endpoints (To Be Implemented)

### Get Organization Subscription
```
GET /api/super-admin/organizations/:id/subscription
```

**Response:**
```json
{
  "organization_id": "uuid",
  "name": "Acme Corp",
  "subscription_status": "active",
  "contact_email": "contact@acme.com",
  "contact_phone": "555-1234",
  "billing_email": "billing@acme.com",
  "payment_method": "Credit Card ending in 4321",
  "monthly_cost": 99.00,
  "last_payment_date": "2025-10-03T10:00:00Z",
  "next_billing_date": "2025-11-03T10:00:00Z",
  "trial_ends_at": null,
  "notes": "VIP customer - priority support"
}
```

---

### Update Organization Subscription
```
PUT /api/super-admin/organizations/:id/subscription
```

**Request Body:**
```json
{
  "subscription_status": "active",
  "contact_email": "newcontact@acme.com",
  "contact_phone": "555-5678",
  "billing_email": "billing@acme.com",
  "payment_method": "PayPal",
  "monthly_cost": 149.00,
  "next_billing_date": "2025-12-01T00:00:00Z",
  "notes": "Upgraded to premium plan"
}
```

---

### List Organizations by Subscription Status
```
GET /api/super-admin/organizations?status=trial
```

**Query Parameters:**
- `status` - Filter by subscription status
- `expiring_soon` - Show trials expiring in next N days
- `overdue` - Show past_due subscriptions

---

## Frontend UI Components (To Be Built)

### 1. Organization Subscription Card
Display subscription details in the super admin organization view:

```jsx
<SubscriptionCard>
  <StatusBadge status={org.subscription_status} />
  <Field label="Contact Email" value={org.contact_email} />
  <Field label="Contact Phone" value={org.contact_phone} />
  <Field label="Monthly Cost" value={`$${org.monthly_cost}`} />
  <Field label="Next Billing" value={formatDate(org.next_billing_date)} />
  <Field label="Payment Method" value={org.payment_method} />
  <EditButton onClick={() => openEditModal(org)} />
</SubscriptionCard>
```

---

### 2. Edit Subscription Modal
Allow super admin to update subscription details:

```jsx
<EditSubscriptionModal>
  <Select
    label="Status"
    options={['trial', 'active', 'past_due', 'cancelled', 'suspended']}
    value={subscription_status}
  />
  <Input label="Contact Email" type="email" />
  <Input label="Contact Phone" type="tel" />
  <Input label="Billing Email" type="email" />
  <Input label="Payment Method" />
  <Input label="Monthly Cost" type="number" prefix="$" />
  <DatePicker label="Next Billing Date" />
  <Textarea label="Notes" rows={4} />
  <SaveButton />
</EditSubscriptionModal>
```

---

### 3. Expiring Trials Dashboard Widget
Show trials expiring soon:

```jsx
<DashboardWidget title="Trials Expiring Soon">
  {expiringTrials.map(org => (
    <TrialAlert key={org.id}>
      <OrgName>{org.name}</OrgName>
      <ExpiryDate>{formatDate(org.trial_ends_at)}</ExpiryDate>
      <DaysRemaining>{calculateDaysLeft(org.trial_ends_at)}</DaysRemaining>
      <ConvertButton onClick={() => convertToActive(org)} />
    </TrialAlert>
  ))}
</DashboardWidget>
```

---

## Automated Tasks (Recommended)

### 1. Daily Trial Expiry Check
**Cron:** Every day at 2 AM
```javascript
// In server.js or separate worker
const cron = require('node-cron');

cron.schedule('0 2 * * *', async () => {
  await db.query('SELECT update_expired_trials()');
  console.log('✅ Expired trials updated');
});
```

---

### 2. Billing Reminder Emails
**Cron:** Every day at 9 AM
```javascript
cron.schedule('0 9 * * *', async () => {
  const upcoming = await db.query(`
    SELECT * FROM organizations
    WHERE subscription_status = 'active'
      AND next_billing_date <= NOW() + INTERVAL '3 days'
      AND next_billing_date > NOW()
  `);

  for (const org of upcoming.rows) {
    await sendBillingReminder(org);
  }
});
```

---

### 3. Overdue Payment Checker
**Cron:** Every 6 hours
```javascript
cron.schedule('0 */6 * * *', async () => {
  await db.query(`
    UPDATE organizations
    SET subscription_status = 'past_due'
    WHERE subscription_status = 'active'
      AND next_billing_date < NOW()
  `);
});
```

---

## Usage Examples

### Example 1: New Trial Organization
```sql
-- When creating a new organization
INSERT INTO organizations (
  name, slug, subscription_status, trial_ends_at, contact_email
) VALUES (
  'New Company Inc',
  'new-company',
  'trial',
  NOW() + INTERVAL '30 days',
  'admin@newcompany.com'
);
```

---

### Example 2: Convert Trial to Active
```sql
UPDATE organizations
SET
  subscription_status = 'active',
  monthly_cost = 99.00,
  payment_method = 'Credit Card ending in 1234',
  last_payment_date = NOW(),
  next_billing_date = NOW() + INTERVAL '1 month',
  trial_ends_at = NULL,
  notes = 'Converted from trial on 2025-11-03'
WHERE id = 'org-uuid-here';
```

---

### Example 3: Suspend Organization
```sql
UPDATE organizations
SET
  subscription_status = 'suspended',
  notes = CONCAT(COALESCE(notes, ''), E'\nSuspended on 2025-11-03 - Payment failed')
WHERE id = 'org-uuid-here';
```

---

### Example 4: Find Expiring Trials
```sql
SELECT
  id,
  name,
  contact_email,
  trial_ends_at,
  EXTRACT(DAY FROM (trial_ends_at - NOW())) as days_remaining
FROM organizations
WHERE subscription_status = 'trial'
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at <= NOW() + INTERVAL '7 days'
  AND trial_ends_at > NOW()
ORDER BY trial_ends_at ASC;
```

---

### Example 5: Monthly Revenue Report
```sql
SELECT
  subscription_status,
  COUNT(*) as org_count,
  SUM(monthly_cost) as total_revenue,
  AVG(monthly_cost) as avg_revenue
FROM organizations
WHERE subscription_status IN ('active', 'past_due')
GROUP BY subscription_status
ORDER BY total_revenue DESC;
```

---

## Integration with Existing Fields

### Compatibility with Trial Management (003_trial_management.sql)

The system is compatible with existing trial fields:
- `trial_started_at` - Still used for tracking trial start
- `trial_ends_at` - **Shared field** - used by both systems
- `trial_status` - Legacy field (may deprecate)
- `payment_status` - Legacy field (replaced by `subscription_status`)

**Recommendation:** Migrate existing data:
```sql
-- One-time migration to sync statuses
UPDATE organizations
SET subscription_status = CASE
  WHEN payment_status = 'paid' THEN 'active'
  WHEN payment_status = 'trial' THEN 'trial'
  WHEN payment_status = 'overdue' THEN 'past_due'
  WHEN payment_status = 'cancelled' THEN 'cancelled'
  ELSE 'trial'
END
WHERE subscription_status = 'trial'; -- Only update defaults
```

---

## Security Considerations

### Row-Level Security (RLS)
These fields should only be accessible to super admins:

```sql
-- Create policy for super admin access
CREATE POLICY super_admin_subscription_access
ON organizations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = current_user_id()
      AND users.role = 'super_admin'
  )
);
```

### Field Encryption
Consider encrypting sensitive fields:
- `billing_email` - May contain PII
- `payment_method` - Contains partial card numbers
- `notes` - May contain confidential information

---

## Monitoring & Alerts

### Metrics to Track
1. **Trial Conversion Rate:** % of trials that convert to paid
2. **Churn Rate:** % of active subscriptions that cancel
3. **Average Revenue Per Organization (ARPO)**
4. **Monthly Recurring Revenue (MRR)**
5. **Trial Expiry Rate:** How many trials expire without converting

### Recommended Dashboards
1. **Subscription Health:** Active, trial, past_due counts
2. **Revenue Trends:** Monthly revenue over time
3. **Trial Pipeline:** Trials by days remaining
4. **At-Risk Customers:** Past_due and expiring trials

---

## Migration Rollback

If you need to rollback this migration:

```sql
-- Rollback script (use with caution)
BEGIN;

-- Drop helper functions
DROP FUNCTION IF EXISTS calculate_next_billing_date(TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS update_expired_trials();

-- Drop indexes
DROP INDEX IF EXISTS idx_organizations_next_billing_date;
DROP INDEX IF EXISTS idx_organizations_trial_ends_at;
DROP INDEX IF EXISTS idx_organizations_subscription_status;

-- Drop constraint
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS check_subscription_status;

-- Drop columns (WARNING: This deletes data!)
ALTER TABLE organizations
DROP COLUMN IF EXISTS notes,
DROP COLUMN IF EXISTS monthly_cost,
DROP COLUMN IF EXISTS next_billing_date,
DROP COLUMN IF EXISTS last_payment_date,
DROP COLUMN IF EXISTS payment_method,
DROP COLUMN IF EXISTS billing_email,
DROP COLUMN IF EXISTS trial_ends_at,
DROP COLUMN IF EXISTS subscription_status,
DROP COLUMN IF EXISTS contact_phone,
DROP COLUMN IF EXISTS contact_email;

COMMIT;
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** Migration fails with "column already exists"
**Solution:** The migration uses `IF NOT EXISTS` and is idempotent. Safe to re-run.

**Issue:** Constraint violation when updating status
**Solution:** Ensure `subscription_status` is one of: trial, active, past_due, cancelled, suspended

**Issue:** Cannot set NULL for required fields
**Solution:** All new fields are nullable. Only `subscription_status` has a default value.

---

## Next Steps

1. ✅ **Migration Complete** - Database fields added
2. 🔲 **API Endpoints** - Create super admin subscription API
3. 🔲 **Frontend UI** - Build subscription management dashboard
4. 🔲 **Automated Tasks** - Set up cron jobs for trial expiry and billing
5. 🔲 **Email Notifications** - Trial expiry and billing reminders
6. 🔲 **Reporting** - Build revenue and subscription health reports
7. 🔲 **Payment Integration** - Connect to Stripe/PayPal for automated billing

---

**Documentation Version:** 1.0
**Last Updated:** November 3, 2025
**Maintained By:** UppalCRM Development Team
