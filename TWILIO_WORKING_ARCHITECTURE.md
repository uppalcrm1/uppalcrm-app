# Twilio Integration - Working Architecture

**Status**: ✅ FULLY FUNCTIONAL (as of Jan 30, 2026)

## Overview

The CRM uses Twilio Voice SDK for agents and REST API for customer calls, connected through Twilio conferences.

---

## OUTBOUND CALLS (Agent Initiates)

### Architecture
1. **Agent joins conference FIRST** via Voice SDK
2. **Customer is dialed** via REST API with conference parameters
3. **Customer joins same conference** when they answer
4. **Two-way audio** between agent and customer

### Flow Diagram
```
Agent clicks "Call" in Dialpad
  ↓
Frontend generates conferenceId: conf-{timestamp}-{random}
  ↓
Agent joins via Voice SDK:
  device.connect({
    params: {
      conference: conferenceId,
      participant: 'agent'
    }
  })
  ↓
Voice webhook receives params from req.body (Voice SDK)
  → Returns <Conference startConferenceOnEnter="true">
  → Agent waits in conference
  ↓
REST API called with conferenceId:
  twilioAPI.makeCall({
    to: '+1-customer-number',
    conferenceId: conferenceId
  })
  ↓
Twilio dials customer with URL params:
  /api/twilio/webhook/voice?conference={conferenceId}&participant=customer
  ↓
Customer answers
  ↓
Voice webhook receives params from req.query (REST API)
  → Returns <Conference startConferenceOnEnter="false">
  → Customer joins same conference
  ↓
BOTH CONNECTED ✅ Two-way audio works
```

### Key Code Locations
- **Frontend**: `frontend/src/components/Dialpad.jsx` (line 45)
  - Generates conferenceId
  - Agent pre-joins via Voice SDK
  - Calls REST API with conferenceId

- **Backend**: `routes/twilio.js` (line 722)
  - Voice webhook handles both agent and customer
  - Reads params from BOTH req.query AND req.body

- **Service**: `services/twilioService.js` (line 89)
  - makeCall includes conferenceId in webhook URL

### Critical Details
✅ **Agent MUST join first** before calling REST API
✅ **Conference params read from both sources**:
  - `req.query.conference` (REST API URL params)
  - `req.body.conference` (Voice SDK params)
✅ **Agent settings**:
  - `startConferenceOnEnter="true"` (starts the conference)
  - `endConferenceOnExit="true"` (ends when agent leaves)
✅ **Customer settings**:
  - `startConferenceOnEnter="false"` (joins existing)
  - `endConferenceOnExit="true"` (can also end if leaves first)

---

## INCOMING CALLS (Customer Calls CRM)

### Architecture
1. **Customer calls Twilio number** (+1 236 761 7676)
2. **Voice webhook puts customer in conference** (based on CallSid)
3. **CRM shows popup** to all logged-in agents
4. **Agent accepts** → joins same conference
5. **Two-way audio** established

### Flow Diagram
```
Customer calls +1 236 761 7676
  ↓
Twilio hits /api/twilio/webhook/voice with Direction=inbound
  ↓
Voice webhook creates conference:
  conferenceId = "incoming-{CallSid}"
  ↓
Returns TwiML:
  <Conference startConferenceOnEnter="false">incoming-{CallSid}</Conference>
  ↓
Customer in conference with hold music
  ↓
Backend stores in global.incomingCalls cache
  ↓
CRM polls and shows popup to all agents ✅
  ↓
Agent clicks "Accept"
  ↓
acceptCall endpoint returns same conferenceId
  ↓
Event dispatched: joinIncomingCallConference
  ↓
Dialpad auto-join handler receives event
  ↓
Agent joins via Voice SDK:
  device.connect({
    params: {
      conference: "incoming-{CallSid}",
      participant: 'agent'
    }
  })
  ↓
BOTH CONNECTED ✅ Two-way audio works
```

### Key Code Locations
- **Backend**: `routes/twilio.js` (line 850)
  - Handles incoming calls
  - Creates conference based on CallSid
  - Stores in global cache for frontend polling

- **Backend**: `routes/twilio.js` (line 915)
  - Accept endpoint returns conferenceId
  - Clears from global cache

- **Frontend**: `frontend/src/context/CallContext.jsx` (line 113)
  - acceptCall function dispatches event

- **Frontend**: `frontend/src/components/Dialpad.jsx` (line 305)
  - Auto-join handler receives event
  - Joins conference without making new call

### Critical Details
✅ **No queue needed** - simplified architecture
✅ **Conference name based on CallSid** - deterministic
✅ **Customer joins first** - puts them in conference while waiting
✅ **Agent joins existing conference** - no redial needed
✅ **Multi-agent sync** - popup clears when one accepts
✅ **60-second timeout** - call auto-hangup if not answered

---

## COMMON ISSUES & SOLUTIONS

### Issue: Agent hears waiting music instead of voice
**Cause**: Conference params not being read from req.body (Voice SDK)
**Fix**: Ensure webhook reads from both req.query AND req.body
```javascript
const conference = req.query.conference || req.body.conference;
const participant = req.query.participant || req.body.participant;
```

### Issue: Customer never joins conference (goes to queue/voicemail)
**Cause**: REST API not passing conferenceId in webhook URL
**Fix**: Ensure makeCall includes params in URL
```javascript
let url = `${API_BASE_URL}/api/twilio/webhook/voice`;
if (conferenceId) {
  url += `?conference=${conferenceId}&participant=customer`;
}
```

### Issue: Recording callback fails with "updated_at doesn't exist"
**Cause**: Trying to update non-existent column
**Fix**: Remove updated_at from update query, only use existing columns

### Issue: Incoming call accept fails with "Queue not found"
**Cause**: Old code tried to use support_queue which doesn't exist
**Fix**: Use simple conference approach based on CallSid (current implementation)

---

## TESTING CHECKLIST

### Outbound Call Test
- [ ] Open Dialpad
- [ ] Enter valid phone number
- [ ] Click "Call"
- [ ] Agent joins conference first (check logs for "Agent joining")
- [ ] Agent appears as "Connected to conference" in UI
- [ ] Customer phone rings
- [ ] Customer answers
- [ ] Both can hear each other ✅
- [ ] Call disconnects when agent hangs up

### Incoming Call Test
- [ ] Call the Twilio number from external phone
- [ ] Popup appears in CRM (within 2 seconds)
- [ ] Popup shows caller's name (if known contact)
- [ ] Click "Accept"
- [ ] Dialpad opens automatically
- [ ] Agent hears customer
- [ ] Customer hears agent ✅
- [ ] Both can disconnect

### Multi-Agent Sync
- [ ] Log in from 2 different browsers/devices
- [ ] Call Twilio number
- [ ] Both agents see popup
- [ ] Agent A clicks Accept
- [ ] Agent B's popup disappears (within 2 seconds)
- [ ] Only Agent A can accept

---

## ENVIRONMENT VARIABLES REQUIRED

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_API_KEY=SKxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_API_SECRET=your_api_secret
TWILIO_TWIML_APP_SID=APxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
API_BASE_URL=https://uppalcrm-api.onrender.com
```

---

## IMPORTANT NOTES

1. **Agent must pre-join conference** before REST API call
   - This is crucial for outbound calls

2. **Conference params from both sources**
   - Voice SDK sends in req.body
   - REST API sends in req.query
   - Must check both!

3. **No queue used anymore**
   - Simplified to use conferences directly
   - No need to create support_queue in Twilio

4. **CallSid-based conferences for incoming**
   - Deterministic conference names
   - Easy to match agent and customer
   - No additional state management needed

5. **Recording happens automatically**
   - `record="record-from-start"` in TwiML
   - Saved to phone_calls table
   - Check recording_url field

---

## Git Commits That Fixed Issues

- **74fc9c4**: Fix Voice SDK params reading from req.body
- **b56f91a**: Define API_BASE_URL in routes
- **710579f**: Simplify incoming calls (no queue needed)

---

**Last Updated**: Jan 30, 2026 23:30 UTC
**Status**: ✅ Both outbound and incoming calls working
**Ready for**: Deployment and user testing
