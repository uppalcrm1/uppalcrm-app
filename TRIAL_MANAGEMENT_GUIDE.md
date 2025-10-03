# 30-Day Trial Management System

## Overview
Complete trial lifecycle management system that automatically provisions 30-day trials for new signups and provides tools for super admins and customers to track and manage trial periods.

## Features Implemented

### 1. Database Schema
**trial_signups table - New columns:**
- `trial_start_date` - When the trial started
- `trial_end_date` - When the trial expires (30 days from start)
- `trial_extended` - Boolean flag if trial has been extended
- `trial_extension_date` - Date when trial was last extended
- `trial_extension_count` - Number of times trial has been extended (max 2)

**organizations table - New columns:**
- `trial_expires_at` - Trial expiration date
- `is_trial` - Boolean flag for trial organizations
- `trial_status` - Enum: 'active', 'expired', 'converted'

**Database Functions:**
- `get_trial_days_remaining(trial_end)` - Calculates days remaining
- `extend_trial(trial_signup_id, extension_days)` - Extends trial and updates org
- `archive_expired_trial(trial_signup_id)` - Archives trial and deactivates org

### 2. Backend APIs

#### Trial Management Endpoints
```
PUT /api/platform/trial-signups/:id/extend
- Extends trial by 30 days (default)
- Max 2 extensions allowed
- Updates both trial_signups and organizations tables
- Returns new end date and total extensions

POST /api/platform/trial-signups/:id/archive
- Archives expired trial
- Sets status to 'expired'
- Deactivates organization
- Only works if trial has actually expired

GET /api/organizations/current/trial-info
- Returns trial info for authenticated customer
- Includes: is_trial, trial_status, trial_expires_at, days_remaining, urgency_color
- Used by customer dashboard to show trial banner
```

#### Auto-Provisioning with Trial Dates
When a trial signup is created via `POST /api/platform/trial-signup`:
1. Creates organization with `is_trial=true`, `trial_status='active'`
2. Sets `trial_expires_at` to 30 days from now
3. Creates trial_signup record with `trial_start_date` and `trial_end_date`
4. Sends credentials email to customer

#### Scheduled Jobs
- **Trial Archival** (4:00 AM daily)
  - Finds all expired trials (`trial_end_date < NOW()` and `status='converted'`)
  - Archives each trial using `archive_expired_trial()` function
  - Deactivates associated organizations
  - Logs summary of archived trials

### 3. Super Admin Dashboard

**Trial Information Display:**
- Shows trial status with color-coded urgency:
  - 🟢 Green: >15 days remaining
  - 🟡 Yellow: 7-15 days remaining
  - 🔴 Red: <7 days remaining
- Displays:
  - Days remaining or "Expired"
  - Trial end date
  - Extension count (if extended)

**Trial Management Actions:**
- **Extend Trial +30 Days** button
  - Only visible if <2 extensions and not expired
  - Adds 30 days to trial period
  - Shows "Extended Nx" badge
- **Archive** button
  - Only visible if trial is expired
  - Archives trial and deactivates organization

**Location:** Super Admin > Trial Signups page (frontend/src/pages/SuperAdminSignups.jsx)

### 4. Customer Dashboard

**Trial Banner Component** (`frontend/src/components/TrialBanner.jsx`):
- Displays at top of customer dashboard
- Shows trial expiration countdown
- Color-coded based on urgency:
  - Blue/Green: >15 days (informational)
  - Yellow: 7-15 days (warning)
  - Red: <7 days (critical)
- Features:
  - Days remaining message
  - Formatted expiry date
  - "Upgrade Now" button (routes to /settings/billing)
  - Dismissible (session only)

**Integration:**
Add to main dashboard layout:
```jsx
import TrialBanner from './components/TrialBanner';

function Dashboard() {
  return (
    <>
      <TrialBanner />
      {/* Rest of dashboard */}
    </>
  );
}
```

## Data Flow

### Trial Creation Flow
1. Customer submits trial signup form
2. Backend creates organization with trial fields set
3. Backend creates trial_signup with trial dates
4. Email sent with login credentials
5. Customer can login immediately

### Trial Extension Flow
1. Super admin clicks "Extend Trial +30 Days"
2. Frontend calls `PUT /api/platform/trial-signups/:id/extend`
3. Backend function `extend_trial()` updates:
   - trial_signups.trial_end_date (+30 days)
   - trial_signups.trial_extension_count (+1)
   - organizations.trial_expires_at (+30 days)
   - organizations.trial_status = 'active'
4. Frontend refreshes to show new dates

### Trial Expiration Flow
1. Scheduled job runs daily at 4:00 AM
2. Queries for expired trials: `trial_end_date < NOW() AND status='converted'`
3. For each expired trial:
   - Calls `archive_expired_trial()` function
   - Sets trial_signups.status = 'expired'
   - Sets organizations.is_active = false
   - Sets organizations.trial_status = 'expired'
4. Customer can no longer login

## API Response Examples

### Trial Signup with Trial Info
```json
{
  "id": "uuid",
  "full_name": "John Doe",
  "email": "john@example.com",
  "company": "Acme Inc",
  "status": "converted",
  "trial_start_date": "2025-10-02T00:00:00Z",
  "trial_end_date": "2025-11-01T00:00:00Z",
  "trial_extended": false,
  "trial_extension_count": 0,
  "days_remaining": 30,
  "is_expired": false,
  "trial_urgency_color": "green",
  "can_extend": true,
  "converted_organization_id": "org-uuid",
  "organization_slug": "acme-inc"
}
```

### Trial Info for Customer
```json
{
  "is_trial": true,
  "trial_status": "active",
  "trial_expires_at": "2025-11-01T00:00:00Z",
  "days_remaining": 30,
  "urgency_color": "green",
  "show_banner": true
}
```

### Extend Trial Response
```json
{
  "message": "Trial extended by 30 days",
  "trial": {
    "id": "signup-uuid",
    "new_end_date": "2025-12-01T00:00:00Z",
    "total_extensions": 1,
    "extension_days": 30
  }
}
```

## Configuration

### Extension Limits
- Maximum extensions per trial: 2 (configurable in TrialSignup model)
- Extension duration: 30 days (configurable in extend endpoint)

### Scheduled Job Times
- Trial archival: 4:00 AM EST (configurable in scheduledJobs.js)

### Urgency Thresholds
- Green: >15 days
- Yellow: 7-15 days
- Red: <7 days

## Database Migration

To apply the trial management schema:
```bash
psql -d your_database -f database/trial-management-migration.sql
```

This migration:
- Adds new columns to trial_signups and organizations tables
- Creates database functions for trial management
- Updates existing records with trial dates
- Creates necessary indexes

## Testing

### Manual Testing Checklist
- [ ] Create new trial signup - verify trial dates are set
- [ ] Check Super Admin dashboard shows trial info
- [ ] Extend trial - verify new end date
- [ ] Check extension count increments
- [ ] Try extending >2 times - verify button disappears
- [ ] Set trial_end_date to past - verify "Expired" shows
- [ ] Archive expired trial - verify org deactivated
- [ ] Customer dashboard shows trial banner
- [ ] Banner color changes based on days remaining
- [ ] Dismiss banner works
- [ ] Run scheduled job manually to test archival

### Test Scheduled Job
```bash
# Via API or directly in Node.js
const scheduledJobs = require('./services/scheduledJobs');
await scheduledJobs.runJob('trialArchival');
```

## Future Enhancements

### Potential Additions
1. **Email Notifications**
   - Send email when trial is 7 days from expiring
   - Send email when trial is 1 day from expiring
   - Send email when trial expires

2. **Grace Period**
   - Add 3-day grace period after expiration
   - Allow continued access but with banner

3. **Conversion Tracking**
   - Track when trial converts to paid
   - Analytics on conversion rates

4. **Custom Trial Lengths**
   - Allow super admin to set custom trial duration
   - Per-customer trial periods

5. **Trial Pause**
   - Ability to pause trial period
   - Useful for customer issues or delays

## Troubleshooting

### Trial dates not showing
- Run migration: `database/trial-management-migration.sql`
- Check if trial_start_date and trial_end_date columns exist
- Verify organizations have is_trial and trial_expires_at set

### Extension not working
- Check trial_extension_count < 2
- Verify trial is not already expired
- Check database function extend_trial() exists

### Scheduled job not running
- Verify scheduledJobs service is started
- Check server logs for cron job execution
- Manually run: `scheduledJobs.runJob('trialArchival')`

### Trial banner not showing
- Check /api/organizations/current/trial-info returns data
- Verify organization has is_trial=true
- Check trial_status='active'
- Ensure TrialBanner component is imported

## Files Modified

### Database
- `database/trial-management-migration.sql` - Schema changes and functions

### Backend
- `routes/platformAdmin.js` - Trial extension and archive endpoints
- `routes/organizations.js` - Trial info endpoint for customers
- `models/TrialSignup.js` - Trial management getters
- `services/scheduledJobs.js` - Auto-archival scheduled job

### Frontend
- `frontend/src/contexts/SuperAdminContext.jsx` - Trial management hooks
- `frontend/src/pages/SuperAdminSignups.jsx` - Trial info display
- `frontend/src/components/TrialBanner.jsx` - Customer trial banner

## Support

For issues or questions:
1. Check logs: Server logs show trial creation and archival activity
2. Check database: Query trial_signups and organizations tables
3. Check scheduled jobs: Verify trialArchival job is running
