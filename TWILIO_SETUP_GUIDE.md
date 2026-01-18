# Twilio Voice Integration - Complete Setup & Troubleshooting Guide

## Overview

UppalCRM uses a hybrid Twilio architecture:
- **Agents**: Browser-based Voice SDK (WebRTC audio)
- **Customers**: Traditional phone calls (REST API)
- **Bridge**: Twilio Conference room for two-way audio

## Architecture Diagram

```
Customer Phone Call
       ↓
Twilio Incoming Number (Queue)
       ↓
       ├─→ Hold Music + "Please wait..."
       │
Agent in Browser (CRM)
       ├─→ Popup notification (accept/decline)
       ├─→ Click "Accept" → Backend dequeues customer to conference
       ├─→ Dialpad opens → Auto-joins conference via Voice SDK
       ├─→ Both parties in conference → Two-way audio
       │
       └─→ Click "End Call" → Conference ends
```

---

## Environment Setup

### Required Environment Variables

```env
# Twilio Account
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret_here
TWILIO_PHONE_NUMBER=+1234567890

# Frontend
VITE_API_URL=https://your-backend.onrender.com/api
```

### Getting Twilio Credentials

1. **Account SID & Auth Token**
   - Go to twilio.com → Console
   - Copy from main dashboard

2. **API Key & Secret**
   - Console → Account → Keys & Credentials
   - Create API Key (not child account)
   - Copy Key SID and Secret

3. **Phone Number**
   - Go to Phone Numbers → Active Numbers
   - Copy your Twilio number (+1XXXXXXXXXX format)

---

## Configuration in CRM

### Step 1: Navigate to Communications Settings

1. Go to **Communications** tab in CRM
2. Click **Settings** button
3. Fill in Twilio Configuration modal:
   - Account SID
   - Auth Token
   - API Key
   - API Secret
   - Phone Number

### Step 2: Test Connection

After saving configuration:
- Green checkmark appears ✅ = Connected
- Red error appears ❌ = Check credentials and logs

---

## How Each Feature Works

### Incoming Calls (Queue System)

**Flow:**
```
1. Customer calls your Twilio number
2. Twilio hits webhook: POST /api/twilio/webhook/voice
3. Webhook returns TwiML: Enqueue to "support_queue" with hold music
4. CRM fetches pending calls: GET /api/twilio/incoming-calls/pending
5. Popup appears to agent with caller name and number
6. Agent clicks "Accept" → POST /api/twilio/incoming-calls/accept
7. Backend updates call TwiML to conference (removes from queue)
8. Dialpad opens, auto-joins conference via Voice SDK
9. Agent and customer in same conference → two-way audio
```

**Key Endpoints:**
- `POST /api/twilio/webhook/voice` - Incoming call handling
- `GET /api/twilio/incoming-calls/pending` - Frontend polls for popups
- `POST /api/twilio/incoming-calls/accept` - Accept and dequeue call

### Outbound Calls (Agent Initiates)

**Flow:**
```
1. Agent opens Dialpad, enters customer number
2. Agent clicks "Call"
3. Dialpad requests token: POST /api/twilio/token
4. Device.connect() joins conference with Voice SDK
5. Backend initiates customer call: POST /api/twilio/calls
6. Customer receives call to Twilio number
7. Customer joins same conference
8. Both in conference → two-way audio with recording
```

**Key Endpoints:**
- `POST /api/twilio/token` - Get capability token for Voice SDK
- `POST /api/twilio/calls` - Initiate outbound customer call

### Recording

**Flow:**
```
1. Conference recording starts automatically
2. Call ends → Recording finalizes
3. Twilio webhook: POST /api/twilio/webhook/recording
4. Backend saves recording URL to database
5. Recording accessible in call history
```

---

## Troubleshooting Guide

### Issue: Incoming Call Shows Popup But No Connection

**Symptoms:**
- Popup appears in CRM
- Customer hears "Connecting now" then silence
- Agent clicks Accept, Dialpad opens but no audio

**Diagnosis:**
1. Check browser console for errors: Open DevTools (F12)
2. Check Render logs for backend errors: `tail -f logs`
3. Verify Voice SDK device status: Green dot should appear in Dialpad header

**Solutions:**
```
✓ Check microphone permission - Browser may have blocked it
✓ Try "Join Call Now" button if auto-join fails
✓ Refresh page and try again
✓ Check TWILIO_API_KEY and TWILIO_API_SECRET in env vars
✓ Verify account has "Voice" product enabled (Twilio console)
```

### Issue: Customer Hears Hold Music Indefinitely

**Symptoms:**
- Incoming call popup appears in CRM
- Customer stuck in queue hearing music
- Call doesn't progress

**Diagnosis:**
1. Check if agent is receiving popup
   ```
   Backend logs should show: "Incoming call - adding to queue"
   ```
2. Check if agent can accept
   ```
   Browser console should show: "Accepting incoming call"
   ```

**Solutions:**
```
✓ Verify organization exists in database
✓ Check incoming call hasn't expired (30 second timeout)
✓ Ensure /api/twilio/incoming-calls/pending endpoint is working
✓ Check frontend is polling (should see GET requests every 3 seconds)
✓ Verify /api/twilio/incoming-calls/accept endpoint is not failing
```

### Issue: Outbound Call Not Working

**Symptoms:**
- Agent enters number in Dialpad
- Click "Call" but nothing happens
- Device shows error (red dot) in Dialpad header

**Diagnosis:**
1. Check DevTools Console (F12) for errors
2. Check if device is initialized: Red dot = error, Yellow = initializing, Green = ready
3. Check backend logs for token generation errors

**Solutions:**
```
✓ Microphone permission blocked? Allow it in browser settings
✓ Refresh page to reinitialize device
✓ Check VITE_API_URL matches your backend URL
✓ Verify auth token is valid (check session in database)
✓ Ensure phone number is valid 10+ digit format
✓ Check TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET
```

### Issue: "Voice connection error. Please refresh..."

**Symptoms:**
- Dialpad shows red dot (error)
- Cannot make calls
- Toast error: "Voice connection error"

**Diagnosis:**
```
1. Check browser microphone permission
2. Check Twilio account Voice product is enabled
3. Check API Key credentials
```

**Log Locations:**
```
Frontend: Browser Console (F12) → Console tab
Backend: Render Dashboard → Service → Logs
Database: Check phone_calls table has records
```

### Issue: Call Quality Problems

**Symptoms:**
- One-way audio (agent hears but customer can't)
- Choppy/delayed audio
- Frequent disconnections

**Diagnosis:**
1. Check internet connection quality
2. Check browser microphone input in system settings
3. Try different browser

**Solutions:**
```
✓ Close other audio apps (Zoom, Discord, etc.)
✓ Try headphones instead of speaker
✓ Check internet connection (speedtest.net)
✓ Use Chrome/Edge (best Voice SDK support)
✓ Check if customer line is poor quality (ask them to try different phone)
```

---

## Common Settings & Values

| Setting | Value | Purpose |
|---------|-------|---------|
| Queue Name | `support_queue` | Name for incoming call queue |
| Hold Music URL | `http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient` | URL for customer hold music |
| Max Queue Wait | `300` | Seconds before call ends (5 minutes) |
| Conference Beep | `false` | No beep when joining/leaving |
| Polling Interval | `3000ms` | Frontend checks for incoming calls every 3 seconds |
| Token TTL | `3600s` | Voice SDK token expires after 1 hour |
| Timeout | `500ms` | Dialpad waits before auto-joining conference |

---

## Debugging Commands

### Check if Twilio Config Exists
```sql
SELECT * FROM twilio_config WHERE organization_id = 'your-org-id';
```

### View Recent Calls
```sql
SELECT id, from_number, to_number, direction, twilio_status, created_at
FROM phone_calls
WHERE organization_id = 'your-org-id'
ORDER BY created_at DESC
LIMIT 10;
```

### Check for Failed Calls
```sql
SELECT * FROM phone_calls
WHERE organization_id = 'your-org-id'
AND twilio_status IN ('failed', 'no-answer', 'busy');
```

### Verify Recording Saved
```sql
SELECT id, from_number, recording_url, duration_seconds
FROM phone_calls
WHERE organization_id = 'your-org-id'
AND has_recording = true
LIMIT 5;
```

---

## API Reference

### POST /api/twilio/token
**Purpose:** Get capability token for Voice SDK
**Request:**
```json
{
  "headers": {
    "Authorization": "Bearer {authToken}",
    "X-Organization-Slug": "{orgSlug}"
  }
}
```
**Response:**
```json
{
  "token": "eyJhbGc..."
}
```

### POST /api/twilio/incoming-calls/accept
**Purpose:** Accept incoming call (dequeue from queue to conference)
**Request:**
```json
{
  "callSid": "CA123456..."
}
```
**Response:**
```json
{
  "success": true,
  "conferenceId": "conf-incoming-1234567890-abc123",
  "message": "Customer moved to conference. Agent should join now."
}
```

### GET /api/twilio/incoming-calls/pending
**Purpose:** Poll for incoming calls waiting for agent
**Request:**
```
GET /api/twilio/incoming-calls/pending
Headers: Authorization, X-Organization-Slug
```
**Response:**
```json
{
  "incomingCall": {
    "callSid": "CA123456...",
    "from": "+1234567890",
    "to": "+1987654321",
    "callerName": "John Smith",
    "timestamp": "2025-01-17T12:30:45Z"
  }
}
```

### POST /api/twilio/calls
**Purpose:** Initiate outbound call
**Request:**
```json
{
  "to": "+1234567890",
  "conferenceId": "conf-1234567890-abc123"
}
```
**Response:**
```json
{
  "id": "CA123456...",
  "to": "+1234567890",
  "from": "+1987654321"
}
```

---

## Quick Checklist for New Setup

- [ ] Twilio account created and verified
- [ ] Account SID obtained
- [ ] Auth Token obtained
- [ ] API Key created and secret obtained
- [ ] Twilio phone number obtained
- [ ] Environment variables set (.env file)
- [ ] Backend redeployed with env vars
- [ ] Twilio config entered in CRM UI
- [ ] Test incoming call received
- [ ] Test outbound call made
- [ ] Verify recording was saved
- [ ] Agent microphone working
- [ ] Customer can hear agent

---

## Support Resources

- **Twilio Docs:** https://www.twilio.com/docs/voice/voice-sdk
- **Twilio Console:** https://www.twilio.com/console
- **Call Logs:** Go to Console → Phone Numbers → Logs → Call
- **Queue Documentation:** https://www.twilio.com/docs/voice/twiml/enqueue

---

## Last Updated
January 17, 2025 - Queue-based system with Voice SDK integration
