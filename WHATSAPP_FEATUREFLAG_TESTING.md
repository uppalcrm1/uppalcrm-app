# WhatsApp Feature-Flagging Testing Guide

## Overview
All WhatsApp UI elements are now controlled by the `whatsapp_enabled` flag in the `twilio_config` table. This allows organizations to enable/disable WhatsApp messaging without any code changes.

## Test Setup

### Prerequisites
- Backend running on port 3004
- Frontend running on port 3002
- Database accessible

### Database Flag Control

**Enable WhatsApp:**
```bash
node toggle-whatsapp-flag.js on
```

**Disable WhatsApp:**
```bash
node toggle-whatsapp-flag.js off
```

## Test Case 1: WhatsApp DISABLED (whatsapp_enabled = false)

### Step 1: Disable the Flag
```bash
node toggle-whatsapp-flag.js off
```

### Step 2: Clear Browser Cache
- Press `F12` to open developer tools
- Right-click refresh button → Empty cache and hard reload
- Or use Ctrl+Shift+Delete to clear browser cache

### Step 3: Test Communications Page
1. Navigate to `/communications`
2. **VERIFY:**
   - ✓ "Total SMS" stats card is VISIBLE
   - ✓ "Total WhatsApp" stats card is HIDDEN
   - ✓ "Messages (SMS)" tab is VISIBLE
   - ✓ "WhatsApp" tab is HIDDEN
   - ✓ "Phone Calls" tab is VISIBLE
   - ✓ "New Message" dropdown shows only "Send SMS"
   - ✓ "Send WhatsApp" option is HIDDEN

### Step 4: Test Lead Detail Page
1. Navigate to `/leads` and click on any lead
2. **VERIFY:**
   - ✓ "Edit" button is VISIBLE
   - ✓ "Green WhatsApp button" is HIDDEN
   - ✓ "Convert to Contact" button is VISIBLE
   - ✓ Activity timeline still shows any existing WhatsApp messages with green icons
   - ✓ No "Send WhatsApp" button visible

### Step 5: Test Contact Detail Page
1. Navigate to `/contacts` and click on any contact
2. **VERIFY:**
   - ✓ "SMS button" (blue) is VISIBLE
   - ✓ "Green WhatsApp button" is HIDDEN
   - ✓ "Edit button" is VISIBLE
   - ✓ Activity timeline still shows any existing WhatsApp messages with green icons
   - ✓ No "Send WhatsApp" button visible

### Step 6: Attempt to Send WhatsApp (should be blocked)
1. If you try to manually access `/api/twilio/whatsapp/send` endpoint
2. **EXPECT:** Error message (this is handled on frontend by hiding the button)

---

## Test Case 2: WhatsApp ENABLED (whatsapp_enabled = true)

### Step 1: Enable the Flag
```bash
node toggle-whatsapp-flag.js on
```

### Step 2: Clear Browser Cache
- Press `F12` → Right-click refresh button → Empty cache and hard reload

### Step 3: Test Communications Page
1. Navigate to `/communications`
2. **VERIFY:**
   - ✓ "Total SMS" stats card is VISIBLE
   - ✓ "Total WhatsApp" stats card is VISIBLE (green, #25D366)
   - ✓ "Messages (SMS)" tab is VISIBLE
   - ✓ "WhatsApp" tab is VISIBLE (green)
   - ✓ "Phone Calls" tab is VISIBLE
   - ✓ "New Message" dropdown shows both:
     - "Send SMS" (blue)
     - "Send WhatsApp" (green)
   - ✓ Can click "Send WhatsApp" to open modal

### Step 4: Test Lead Detail Page
1. Navigate to `/leads` and click on any lead with a phone number
2. **VERIFY:**
   - ✓ "Edit" button is VISIBLE
   - ✓ "Green WhatsApp button" is VISIBLE and ENABLED
   - ✓ "Convert to Contact" button is VISIBLE
   - ✓ Can click WhatsApp button to open SendWhatsAppModal
   - ✓ Activity timeline shows WhatsApp messages with green icons

### Step 5: Test Contact Detail Page
1. Navigate to `/contacts` and click on any contact with a phone number
2. **VERIFY:**
   - ✓ "SMS button" (blue) is VISIBLE and ENABLED
   - ✓ "Green WhatsApp button" is VISIBLE and ENABLED
   - ✓ "Edit button" is VISIBLE
   - ✓ Can click either button to open modals
   - ✓ Activity timeline shows WhatsApp messages with green icons

### Step 6: Test Sending WhatsApp
1. Click the green WhatsApp button on Lead or Contact page
2. **VERIFY:**
   - ✓ SendWhatsAppModal opens
   - ✓ Phone number is pre-filled
   - ✓ Can type message
   - ✓ Character count shows
   - ✓ Can click "Send WhatsApp" button
   - ✓ Message sends successfully
   - ✓ Success toast appears

---

## Implementation Details

### Files Modified

**Backend:**
- `routes/twilio.js` - Updated GET `/api/twilio/config` to include `whatsapp_enabled` and `whatsapp_number`

**Frontend:**
- `frontend/src/hooks/useTwilioConfig.js` - New custom hook for config access
- `frontend/src/pages/CommunicationsPage.jsx` - Conditional rendering of WhatsApp UI
- `frontend/src/pages/LeadDetail.jsx` - Conditional WhatsApp button
- `frontend/src/pages/ContactDetailPage.jsx` - Conditional WhatsApp button

### Key Design Principles

1. **API-Driven:** Feature flag reads from database API, not hardcoded
2. **Dynamic:** Changes take effect immediately after page refresh (no deploy needed)
3. **Read-Only Historical:** Existing WhatsApp messages remain visible even when disabled
4. **Send Blocking:** Send functionality is hidden/disabled when `whatsapp_enabled = false`
5. **Consistent:** All WhatsApp send points are controlled by the same flag

### Hook Usage

All components use the `useTwilioConfig()` hook:

```javascript
import { useTwilioConfig } from '../hooks/useTwilioConfig';

function MyComponent() {
  const { whatsappEnabled } = useTwilioConfig();

  return (
    <>
      {whatsappEnabled && (
        <button>Send WhatsApp</button>
      )}
    </>
  );
}
```

### Caching

- Config is cached for 5 minutes
- Refetches on window focus to detect changes
- React Query handles all caching logic

---

## Troubleshooting

### WhatsApp UI Not Showing When Enabled?
1. Check browser console for errors
2. Verify database: `SELECT whatsapp_enabled FROM twilio_config;`
3. Hard refresh with Ctrl+Shift+Delete (clear cache)
4. Check Network tab to see if `/api/twilio/config` returns `whatsapp_enabled: true`

### WhatsApp UI Still Showing When Disabled?
1. Hard refresh browser cache
2. Check if API is returning correct value
3. Verify React Query cache is cleared

### API Endpoint Not Returning whatsapp_enabled?
1. Restart backend server
2. Verify migration was run: `SELECT * FROM information_schema.columns WHERE table_name='twilio_config' AND column_name='whatsapp_enabled';`
3. Check `routes/twilio.js` line 169 includes `whatsapp_enabled` in SELECT

---

## Success Criteria

✅ When `whatsapp_enabled = false`:
- WhatsApp tab hidden on Communications page
- WhatsApp stats card hidden on Communications page
- WhatsApp option hidden in "New Message" dropdown
- WhatsApp button hidden on Lead detail page
- WhatsApp button hidden on Contact detail page
- Historical WhatsApp messages still visible (no data loss)

✅ When `whatsapp_enabled = true`:
- All WhatsApp UI elements visible
- Can send WhatsApp messages
- Feature works exactly as before

✅ Code Quality:
- No hardcoded feature flags
- API-driven configuration
- Consistent across all pages
- Error handling in place
- No breaking changes
