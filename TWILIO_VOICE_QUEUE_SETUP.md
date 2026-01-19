# Twilio Voice Queue Setup & Fixes

## Overview
This document captures the solution for getting Twilio incoming calls to properly queue and handle timeouts.

## The Problem We Solved
Incoming calls were being received but the queue dequeue operation was failing with:
```
The requested resource /2010-04-01/Accounts/.../Queues/support_queue.json was not found
```

## Root Cause
The code was attempting to access Twilio queues using the **friendly name** (`'support_queue'`) instead of the **Queue SID**.

### Critical Discovery
- Twilio API: `client.queues()` requires the **Queue SID** (e.g., `QUxxxxxx`), NOT the friendly name
- The friendly name is only for display purposes in the Twilio console
- Using friendly name instead of SID causes 404 errors on dequeue operations

## The Solution

### 1. Create the Queue
The `support_queue` must exist in your Twilio account. You can create it via:

**Option A: Browser (Easy)**
```
GET https://uppalcrm-api.onrender.com/api/twilio/create-queue-simple
```

**Option B: Twilio Console**
- Go to https://console.twilio.com/us1/develop/phone-numbers/manage/queues
- Create new queue with Friendly Name: `support_queue`
- Max Size: 100 (or your preference)

### 2. Fix the Code - Access Queue by SID

**WRONG - This causes 404 errors:**
```javascript
const queue = await client.queues('support_queue').fetch();
```

**CORRECT - List and find by friendly name:**
```javascript
const queues = await client.queues.list();
const queue = queues.find(q => q.friendlyName === 'support_queue');

if (!queue) {
  throw new Error('support_queue not found');
}

const queueSid = queue.sid;  // Now use this SID for operations
```

## Locations in Code

### Routes: `routes/twilio.js`

**1. Global Cleanup Task (line ~68)**
- Runs every 30 seconds
- Checks for incoming calls older than 60 seconds
- Must find queue by SID before dequeuing

**2. Accept Incoming Call Endpoint (line ~1173)**
- Called when agent accepts an incoming call
- Must find queue by SID before dequeuing customer

**3. Create Queue Endpoint (line ~1506)**
- Temporary endpoint to create `support_queue`
- Can be removed after queue is created
- GET /api/twilio/create-queue-simple (no auth required)

## Voice Call Flow

```
1. Incoming call → /webhook/voice
   ↓
2. Call stored in cache & placed in support_queue
   ↓
3. Customer waits with hold music (maxQueueWait=60 seconds)
   ↓
4a. Agent accepts → Call /incoming-calls/accept
    - Finds queue by SID
    - Dequeues customer
    - Moves to conference
    ↓
4b. Timeout at 60s → Call /webhook/queue-result
    - Customer hung up OR no agent available
    - Send to voicemail
    ↓
5. Global cleanup task (every 30s)
   - Finds calls older than 60 seconds
   - Forces dequeue after timeout
   - Redirects to voicemail
```

## Important Configuration

### Webhook URLs (must be public, no auth required)
- `/webhook/voice` - Initial incoming call
- `/webhook/queue-result` - When customer leaves queue
- `/webhook/recording` - When call recording completes
- `/webhook/conference-status` - Conference events
- `/webhook/voicemail-redirect` - Redirect to voicemail

### TwiML Queue Syntax
```xml
<Enqueue
  waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
  maxQueueWait="60"
  action="https://uppalcrm-api.onrender.com/api/twilio/webhook/queue-result"
  method="POST"
>support_queue</Enqueue>
```

The value inside `<Enqueue>` tags is the **friendly name**, not the SID.

## Debugging Steps

If queue dequeue fails, check:

1. **Queue exists?**
   ```bash
   GET /api/twilio/create-queue-simple
   ```

2. **Check logs for:**
   ```
   🔄 GLOBAL CLEANUP: Found old call
   Age: XX seconds
   ✅ Successfully dequeued and redirected to voicemail
   ```

3. **If still failing:**
   - Check Twilio logs at https://console.twilio.com/us1/monitor/logs/calls
   - Look for webhook requests and their HTTP status codes
   - Verify webhook URLs are correct and reachable

## Code Changes Made

### Commit: `c26886d`
- Fixed queue access to use SID instead of friendly name
- Updated global cleanup task
- Updated incoming call accept endpoint

### Commit: `ab905f6`
- Added `/create-queue-simple` endpoint for easy queue creation

### Commit: `a148656`
- Added temporary queue creation endpoint

### Commit: `4456144`
- Added comprehensive logging to voice webhook for debugging

## Future Modifications

When modifying Twilio voice code:

1. **Always use Queue SID, not friendly name:**
   ```javascript
   const queues = await client.queues.list();
   const queue = queues.find(q => q.friendlyName === 'support_queue');
   const queueSid = queue.sid;
   ```

2. **Test with actual calls**, not just endpoint testing

3. **Check both:**
   - Render logs for success messages
   - Twilio console for webhook requests

4. **Remember maxQueueWait timeout** triggers `/webhook/queue-result`, not the global cleanup task

5. **Global cleanup task** is a safety net that runs every 30 seconds for calls >60 seconds old

## Related Files
- `routes/twilio.js` - All Twilio webhook handlers
- `services/twilioService.js` - Twilio client factory
- `middleware/security.js` - Rate limiters and security headers
- `server.js` - Route mounting and app configuration
