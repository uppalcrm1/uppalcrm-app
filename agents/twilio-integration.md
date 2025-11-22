\# Agent Task: Twilio SMS \& Voice Integration



\## Project Context

\- \*\*Project Name\*\*: Uppal CRM2

\- \*\*Location\*\*: Your project directory

\- \*\*Architecture\*\*: Two-tier multi-tenant CRM

\- \*\*Backend\*\*: Node.js + Express.js (Port 3000)

\- \*\*Frontend\*\*: React + Vite (Port 3002)

\- \*\*Database\*\*: PostgreSQL with Row-Level Security



\## What Already Exists

\- ✅ Users and authentication system

\- ✅ Organizations with multi-tenancy

\- ✅ Leads management (fully working)

\- ✅ Dashboard with analytics

\- ✅ Lead interactions tracking structure

\- ✅ LEAD INTERACTIONS table in database



\## Your Mission

Build a complete Twilio integration that enables organizations to:

1\. Send SMS messages to leads and contacts

2\. Receive SMS messages from customers (with auto-lead creation)

3\. Make phone calls from the CRM

4\. Receive incoming calls (with call logging)

5\. Track all SMS/call interactions in the CRM

6\. Use SMS templates for common messages

7\. Send automated SMS notifications (renewals, trials, etc.)



---



\## Phase 1: Database Schema



\### File: `database/migrations/006-twilio-integration.sql`



```sql

-- Enable UUID extension if not already enabled

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";



-- Twilio Configuration per Organization (multi-tenant)

CREATE TABLE twilio\_config (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   organization\_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&nbsp;   

&nbsp;   -- Twilio Credentials (encrypted in production)

&nbsp;   account\_sid VARCHAR(255) NOT NULL,

&nbsp;   auth\_token VARCHAR(255) NOT NULL,

&nbsp;   phone\_number VARCHAR(50) NOT NULL, -- Organization's Twilio number

&nbsp;   

&nbsp;   -- Features enabled

&nbsp;   sms\_enabled BOOLEAN DEFAULT true,

&nbsp;   voice\_enabled BOOLEAN DEFAULT true,

&nbsp;   

&nbsp;   -- Status

&nbsp;   is\_active BOOLEAN DEFAULT true,

&nbsp;   verified\_at TIMESTAMP WITH TIME ZONE,

&nbsp;   

&nbsp;   -- Timestamps

&nbsp;   created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

&nbsp;   updated\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

&nbsp;   created\_by UUID REFERENCES users(id),

&nbsp;   

&nbsp;   -- Each org can only have one Twilio config

&nbsp;   UNIQUE(organization\_id)

);



-- SMS Messages (sent and received)

CREATE TABLE sms\_messages (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   organization\_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&nbsp;   

&nbsp;   -- Related Records

&nbsp;   lead\_id UUID REFERENCES leads(id) ON DELETE SET NULL,

&nbsp;   contact\_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

&nbsp;   user\_id UUID REFERENCES users(id), -- User who sent (null for incoming)

&nbsp;   

&nbsp;   -- Message Details

&nbsp;   direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'

&nbsp;   from\_number VARCHAR(50) NOT NULL,

&nbsp;   to\_number VARCHAR(50) NOT NULL,

&nbsp;   body TEXT NOT NULL,

&nbsp;   

&nbsp;   -- Twilio Data

&nbsp;   twilio\_sid VARCHAR(255) UNIQUE, -- Twilio message SID

&nbsp;   twilio\_status VARCHAR(50), -- queued, sent, delivered, failed, etc.

&nbsp;   error\_code INTEGER,

&nbsp;   error\_message TEXT,

&nbsp;   

&nbsp;   -- Media attachments

&nbsp;   media\_urls JSONB, -- Array of media URLs

&nbsp;   num\_media INTEGER DEFAULT 0,

&nbsp;   

&nbsp;   -- Analytics

&nbsp;   segment\_count INTEGER DEFAULT 1, -- Number of SMS segments

&nbsp;   cost DECIMAL(10,4), -- Cost in USD

&nbsp;   

&nbsp;   -- Auto-response flags

&nbsp;   is\_auto\_reply BOOLEAN DEFAULT false,

&nbsp;   template\_id UUID REFERENCES sms\_templates(id),

&nbsp;   

&nbsp;   -- Timestamps

&nbsp;   sent\_at TIMESTAMP WITH TIME ZONE,

&nbsp;   delivered\_at TIMESTAMP WITH TIME ZONE,

&nbsp;   created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Phone Calls

CREATE TABLE phone\_calls (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   organization\_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&nbsp;   

&nbsp;   -- Related Records

&nbsp;   lead\_id UUID REFERENCES leads(id) ON DELETE SET NULL,

&nbsp;   contact\_id UUID REFERENCES contacts(id) ON DELETE SET NULL,

&nbsp;   user\_id UUID REFERENCES users(id), -- User who made/received call

&nbsp;   

&nbsp;   -- Call Details

&nbsp;   direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'

&nbsp;   from\_number VARCHAR(50) NOT NULL,

&nbsp;   to\_number VARCHAR(50) NOT NULL,

&nbsp;   

&nbsp;   -- Twilio Data

&nbsp;   twilio\_call\_sid VARCHAR(255) UNIQUE,

&nbsp;   twilio\_status VARCHAR(50), -- queued, ringing, in-progress, completed, failed, etc.

&nbsp;   

&nbsp;   -- Call Metrics

&nbsp;   duration\_seconds INTEGER, -- Total call duration

&nbsp;   talk\_time\_seconds INTEGER, -- Actual talk time (excluding ringing)

&nbsp;   recording\_url TEXT, -- Call recording URL

&nbsp;   has\_recording BOOLEAN DEFAULT false,

&nbsp;   

&nbsp;   -- Call outcome

&nbsp;   outcome VARCHAR(100), -- answered, no\_answer, busy, voicemail, failed

&nbsp;   notes TEXT, -- User's notes about the call

&nbsp;   

&nbsp;   -- Cost tracking

&nbsp;   cost DECIMAL(10,4),

&nbsp;   

&nbsp;   -- Timestamps

&nbsp;   started\_at TIMESTAMP WITH TIME ZONE,

&nbsp;   answered\_at TIMESTAMP WITH TIME ZONE,

&nbsp;   ended\_at TIMESTAMP WITH TIME ZONE,

&nbsp;   created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- SMS Templates (pre-written messages)

CREATE TABLE sms\_templates (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   organization\_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&nbsp;   

&nbsp;   -- Template Details

&nbsp;   name VARCHAR(100) NOT NULL,

&nbsp;   category VARCHAR(50), -- welcome, follow\_up, renewal, trial\_expiring, etc.

&nbsp;   body TEXT NOT NULL, -- Template with {{variables}}

&nbsp;   

&nbsp;   -- Usage tracking

&nbsp;   use\_count INTEGER DEFAULT 0,

&nbsp;   last\_used\_at TIMESTAMP WITH TIME ZONE,

&nbsp;   

&nbsp;   -- Status

&nbsp;   is\_active BOOLEAN DEFAULT true,

&nbsp;   

&nbsp;   -- Timestamps

&nbsp;   created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

&nbsp;   updated\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

&nbsp;   created\_by UUID REFERENCES users(id),

&nbsp;   

&nbsp;   UNIQUE(organization\_id, name)

);



-- Auto-Response Rules

CREATE TABLE sms\_auto\_responses (

&nbsp;   id UUID PRIMARY KEY DEFAULT uuid\_generate\_v4(),

&nbsp;   organization\_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

&nbsp;   

&nbsp;   -- Trigger conditions

&nbsp;   keyword VARCHAR(100), -- If message contains this keyword

&nbsp;   trigger\_type VARCHAR(50), -- 'keyword', 'business\_hours', 'new\_lead'

&nbsp;   

&nbsp;   -- Response

&nbsp;   template\_id UUID REFERENCES sms\_templates(id),

&nbsp;   response\_message TEXT,

&nbsp;   

&nbsp;   -- Business hours (for after-hours auto-response)

&nbsp;   business\_hours\_start TIME,

&nbsp;   business\_hours\_end TIME,

&nbsp;   business\_days INTEGER\[], -- Array: \[1,2,3,4,5] for Mon-Fri

&nbsp;   

&nbsp;   -- Status

&nbsp;   is\_active BOOLEAN DEFAULT true,

&nbsp;   priority INTEGER DEFAULT 0,

&nbsp;   

&nbsp;   -- Timestamps

&nbsp;   created\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

&nbsp;   updated\_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()

);



-- Indexes for performance

CREATE INDEX idx\_sms\_messages\_org ON sms\_messages(organization\_id);

CREATE INDEX idx\_sms\_messages\_lead ON sms\_messages(lead\_id);

CREATE INDEX idx\_sms\_messages\_contact ON sms\_messages(contact\_id);

CREATE INDEX idx\_sms\_messages\_created ON sms\_messages(created\_at DESC);

CREATE INDEX idx\_sms\_messages\_direction ON sms\_messages(direction);

CREATE INDEX idx\_sms\_messages\_twilio\_sid ON sms\_messages(twilio\_sid);



CREATE INDEX idx\_phone\_calls\_org ON phone\_calls(organization\_id);

CREATE INDEX idx\_phone\_calls\_lead ON phone\_calls(lead\_id);

CREATE INDEX idx\_phone\_calls\_contact ON phone\_calls(contact\_id);

CREATE INDEX idx\_phone\_calls\_created ON phone\_calls(created\_at DESC);

CREATE INDEX idx\_phone\_calls\_twilio\_sid ON phone\_calls(twilio\_call\_sid);



CREATE INDEX idx\_sms\_templates\_org ON sms\_templates(organization\_id);

CREATE INDEX idx\_sms\_templates\_category ON sms\_templates(category);



-- Row Level Security

ALTER TABLE twilio\_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE sms\_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE phone\_calls ENABLE ROW LEVEL SECURITY;

ALTER TABLE sms\_templates ENABLE ROW LEVEL SECURITY;

ALTER TABLE sms\_auto\_responses ENABLE ROW LEVEL SECURITY;



CREATE POLICY twilio\_config\_isolation ON twilio\_config

&nbsp;   USING (organization\_id = current\_setting('app.current\_organization\_id')::UUID);



CREATE POLICY sms\_messages\_isolation ON sms\_messages

&nbsp;   USING (organization\_id = current\_setting('app.current\_organization\_id')::UUID);



CREATE POLICY phone\_calls\_isolation ON phone\_calls

&nbsp;   USING (organization\_id = current\_setting('app.current\_organization\_id')::UUID);



CREATE POLICY sms\_templates\_isolation ON sms\_templates

&nbsp;   USING (organization\_id = current\_setting('app.current\_organization\_id')::UUID);



CREATE POLICY sms\_auto\_responses\_isolation ON sms\_auto\_responses

&nbsp;   USING (organization\_id = current\_setting('app.current\_organization\_id')::UUID);

```



---



\## Phase 2: Backend Implementation



\### File: `package.json` (add dependencies)



```json

{

&nbsp; "dependencies": {

&nbsp;   "twilio": "^5.3.4"

&nbsp; }

}

```



Run: `npm install twilio`



---



\### File: `services/twilioService.js` (New File)



```javascript

const twilio = require('twilio');

const db = require('../database/db');



class TwilioService {

&nbsp; constructor() {

&nbsp;   this.clients = new Map(); // Cache Twilio clients per organization

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Get or create Twilio client for organization

&nbsp;  \*/

&nbsp; async getClient(organizationId) {

&nbsp;   if (this.clients.has(organizationId)) {

&nbsp;     return this.clients.get(organizationId);

&nbsp;   }



&nbsp;   const query = `

&nbsp;     SELECT account\_sid, auth\_token, phone\_number, is\_active

&nbsp;     FROM twilio\_config

&nbsp;     WHERE organization\_id = $1 AND is\_active = true

&nbsp;   `;

&nbsp;   

&nbsp;   const result = await db.query(query, \[organizationId]);

&nbsp;   

&nbsp;   if (result.rows.length === 0) {

&nbsp;     throw new Error('Twilio not configured for this organization');

&nbsp;   }



&nbsp;   const config = result.rows\[0];

&nbsp;   const client = twilio(config.account\_sid, config.auth\_token);

&nbsp;   

&nbsp;   this.clients.set(organizationId, {

&nbsp;     client,

&nbsp;     phoneNumber: config.phone\_number

&nbsp;   });



&nbsp;   return this.clients.get(organizationId);

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Send SMS message

&nbsp;  \*/

&nbsp; async sendSMS({ organizationId, to, body, leadId = null, contactId = null, userId, templateId = null }) {

&nbsp;   try {

&nbsp;     const { client, phoneNumber } = await this.getClient(organizationId);



&nbsp;     // Send via Twilio

&nbsp;     const message = await client.messages.create({

&nbsp;       body,

&nbsp;       from: phoneNumber,

&nbsp;       to,

&nbsp;       statusCallback: `${process.env.API\_BASE\_URL}/api/twilio/webhook/sms-status`

&nbsp;     });



&nbsp;     // Save to database

&nbsp;     const insertQuery = `

&nbsp;       INSERT INTO sms\_messages (

&nbsp;         organization\_id, lead\_id, contact\_id, user\_id,

&nbsp;         direction, from\_number, to\_number, body,

&nbsp;         twilio\_sid, twilio\_status, template\_id, sent\_at

&nbsp;       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())

&nbsp;       RETURNING \*

&nbsp;     `;



&nbsp;     const result = await db.query(insertQuery, \[

&nbsp;       organizationId, leadId, contactId, userId,

&nbsp;       'outbound', phoneNumber, to, body,

&nbsp;       message.sid, message.status, templateId

&nbsp;     ]);



&nbsp;     // Also create interaction record

&nbsp;     if (leadId) {

&nbsp;       await this.createInteraction(organizationId, leadId, userId, 'sms', body, 'sent');

&nbsp;     }



&nbsp;     return result.rows\[0];

&nbsp;   } catch (error) {

&nbsp;     console.error('Error sending SMS:', error);

&nbsp;     throw error;

&nbsp;   }

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Make phone call

&nbsp;  \*/

&nbsp; async makeCall({ organizationId, to, leadId = null, contactId = null, userId }) {

&nbsp;   try {

&nbsp;     const { client, phoneNumber } = await this.getClient(organizationId);



&nbsp;     const call = await client.calls.create({

&nbsp;       url: `${process.env.API\_BASE\_URL}/api/twilio/webhook/voice`,

&nbsp;       to,

&nbsp;       from: phoneNumber,

&nbsp;       record: true,

&nbsp;       statusCallback: `${process.env.API\_BASE\_URL}/api/twilio/webhook/call-status`,

&nbsp;       statusCallbackEvent: \['initiated', 'ringing', 'answered', 'completed']

&nbsp;     });



&nbsp;     // Save to database

&nbsp;     const insertQuery = `

&nbsp;       INSERT INTO phone\_calls (

&nbsp;         organization\_id, lead\_id, contact\_id, user\_id,

&nbsp;         direction, from\_number, to\_number,

&nbsp;         twilio\_call\_sid, twilio\_status, started\_at

&nbsp;       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())

&nbsp;       RETURNING \*

&nbsp;     `;



&nbsp;     const result = await db.query(insertQuery, \[

&nbsp;       organizationId, leadId, contactId, userId,

&nbsp;       'outbound', phoneNumber, to,

&nbsp;       call.sid, call.status

&nbsp;     ]);



&nbsp;     return result.rows\[0];

&nbsp;   } catch (error) {

&nbsp;     console.error('Error making call:', error);

&nbsp;     throw error;

&nbsp;   }

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Create interaction record for lead

&nbsp;  \*/

&nbsp; async createInteraction(organizationId, leadId, userId, type, description, outcome) {

&nbsp;   const query = `

&nbsp;     INSERT INTO lead\_interactions (

&nbsp;       lead\_id, user\_id, interaction\_type, description, outcome, completed\_at

&nbsp;     ) VALUES ($1, $2, $3, $4, $5, NOW())

&nbsp;   `;

&nbsp;   

&nbsp;   await db.query(query, \[leadId, userId, type, description, outcome]);

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Process incoming SMS

&nbsp;  \*/

&nbsp; async processIncomingSMS(data) {

&nbsp;   const { From, To, Body, MessageSid, NumMedia, MediaUrl0 } = data;



&nbsp;   // Find organization by phone number

&nbsp;   const orgQuery = `

&nbsp;     SELECT organization\_id FROM twilio\_config WHERE phone\_number = $1

&nbsp;   `;

&nbsp;   const orgResult = await db.query(orgQuery, \[To]);

&nbsp;   

&nbsp;   if (orgResult.rows.length === 0) {

&nbsp;     console.error('No organization found for phone number:', To);

&nbsp;     return;

&nbsp;   }



&nbsp;   const organizationId = orgResult.rows\[0].organization\_id;



&nbsp;   // Find existing lead/contact by phone number

&nbsp;   let leadId = null;

&nbsp;   let contactId = null;



&nbsp;   // Check contacts first

&nbsp;   const contactQuery = `

&nbsp;     SELECT id FROM contacts WHERE organization\_id = $1 AND phone = $2 LIMIT 1

&nbsp;   `;

&nbsp;   const contactResult = await db.query(contactQuery, \[organizationId, From]);

&nbsp;   

&nbsp;   if (contactResult.rows.length > 0) {

&nbsp;     contactId = contactResult.rows\[0].id;

&nbsp;   } else {

&nbsp;     // Check leads

&nbsp;     const leadQuery = `

&nbsp;       SELECT id FROM leads WHERE organization\_id = $1 AND phone = $2 LIMIT 1

&nbsp;     `;

&nbsp;     const leadResult = await db.query(leadQuery, \[organizationId, From]);

&nbsp;     

&nbsp;     if (leadResult.rows.length > 0) {

&nbsp;       leadId = leadResult.rows\[0].id;

&nbsp;     } else {

&nbsp;       // Create new lead from incoming SMS

&nbsp;       const createLeadQuery = `

&nbsp;         INSERT INTO leads (organization\_id, phone, source, status, first\_contact\_date)

&nbsp;         VALUES ($1, $2, 'SMS', 'new', NOW())

&nbsp;         RETURNING id

&nbsp;       `;

&nbsp;       const newLead = await db.query(createLeadQuery, \[organizationId, From]);

&nbsp;       leadId = newLead.rows\[0].id;

&nbsp;     }

&nbsp;   }



&nbsp;   // Save SMS message

&nbsp;   const mediaUrls = NumMedia > 0 ? \[MediaUrl0] : null;

&nbsp;   

&nbsp;   const insertQuery = `

&nbsp;     INSERT INTO sms\_messages (

&nbsp;       organization\_id, lead\_id, contact\_id,

&nbsp;       direction, from\_number, to\_number, body,

&nbsp;       twilio\_sid, twilio\_status, num\_media, media\_urls,

&nbsp;       created\_at

&nbsp;     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())

&nbsp;     RETURNING \*

&nbsp;   `;



&nbsp;   const result = await db.query(insertQuery, \[

&nbsp;     organizationId, leadId, contactId,

&nbsp;     'inbound', From, To, Body,

&nbsp;     MessageSid, 'received', parseInt(NumMedia || 0), JSON.stringify(mediaUrls)

&nbsp;   ]);



&nbsp;   // Check for auto-responses

&nbsp;   await this.checkAutoResponse(organizationId, Body, From, leadId);



&nbsp;   return result.rows\[0];

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Check and send auto-responses based on rules

&nbsp;  \*/

&nbsp; async checkAutoResponse(organizationId, incomingMessage, toNumber, leadId) {

&nbsp;   const query = `

&nbsp;     SELECT ar.\*, st.body as template\_body

&nbsp;     FROM sms\_auto\_responses ar

&nbsp;     LEFT JOIN sms\_templates st ON ar.template\_id = st.id

&nbsp;     WHERE ar.organization\_id = $1 AND ar.is\_active = true

&nbsp;     ORDER BY ar.priority DESC

&nbsp;   `;

&nbsp;   

&nbsp;   const rules = await db.query(query, \[organizationId]);



&nbsp;   for (const rule of rules.rows) {

&nbsp;     let shouldRespond = false;



&nbsp;     if (rule.trigger\_type === 'keyword' \&\& rule.keyword) {

&nbsp;       const lowerMessage = incomingMessage.toLowerCase();

&nbsp;       const lowerKeyword = rule.keyword.toLowerCase();

&nbsp;       shouldRespond = lowerMessage.includes(lowerKeyword);

&nbsp;     }



&nbsp;     if (rule.trigger\_type === 'business\_hours') {

&nbsp;       const now = new Date();

&nbsp;       const currentHour = now.getHours();

&nbsp;       const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

&nbsp;       

&nbsp;       const startHour = parseInt(rule.business\_hours\_start?.split(':')\[0] || 9);

&nbsp;       const endHour = parseInt(rule.business\_hours\_end?.split(':')\[0] || 17);

&nbsp;       

&nbsp;       const isBusinessDay = rule.business\_days?.includes(currentDay);

&nbsp;       const isBusinessHours = currentHour >= startHour \&\& currentHour < endHour;

&nbsp;       

&nbsp;       shouldRespond = !isBusinessDay || !isBusinessHours;

&nbsp;     }



&nbsp;     if (shouldRespond) {

&nbsp;       const responseBody = rule.response\_message || rule.template\_body;

&nbsp;       

&nbsp;       await this.sendSMS({

&nbsp;         organizationId,

&nbsp;         to: toNumber,

&nbsp;         body: responseBody,

&nbsp;         leadId,

&nbsp;         userId: null, // Auto-response

&nbsp;         templateId: rule.template\_id

&nbsp;       });



&nbsp;       break; // Only send first matching auto-response

&nbsp;     }

&nbsp;   }

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Update SMS status from webhook

&nbsp;  \*/

&nbsp; async updateSMSStatus(messageSid, status, errorCode = null, errorMessage = null) {

&nbsp;   const query = `

&nbsp;     UPDATE sms\_messages

&nbsp;     SET twilio\_status = $1,

&nbsp;         error\_code = $2,

&nbsp;         error\_message = $3,

&nbsp;         delivered\_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered\_at END

&nbsp;     WHERE twilio\_sid = $4

&nbsp;     RETURNING \*

&nbsp;   `;

&nbsp;   

&nbsp;   const result = await db.query(query, \[status, errorCode, errorMessage, messageSid]);

&nbsp;   return result.rows\[0];

&nbsp; }



&nbsp; /\*\*

&nbsp;  \* Update call status from webhook

&nbsp;  \*/

&nbsp; async updateCallStatus(callSid, status, duration = null, recordingUrl = null) {

&nbsp;   const query = `

&nbsp;     UPDATE phone\_calls

&nbsp;     SET twilio\_status = $1,

&nbsp;         duration\_seconds = $2,

&nbsp;         recording\_url = $3,

&nbsp;         has\_recording = $4,

&nbsp;         ended\_at = CASE WHEN $1 IN ('completed', 'failed', 'busy', 'no-answer') THEN NOW() ELSE ended\_at END,

&nbsp;         answered\_at = CASE WHEN $1 = 'answered' THEN NOW() ELSE answered\_at END

&nbsp;     WHERE twilio\_call\_sid = $5

&nbsp;     RETURNING \*

&nbsp;   `;

&nbsp;   

&nbsp;   const result = await db.query(query, \[

&nbsp;     status,

&nbsp;     duration,

&nbsp;     recordingUrl,

&nbsp;     recordingUrl ? true : false,

&nbsp;     callSid

&nbsp;   ]);

&nbsp;   

&nbsp;   return result.rows\[0];

&nbsp; }

}



module.exports = new TwilioService();

```



---



\### File: `routes/twilio.js` (New File)



```javascript

const express = require('express');

const router = express.Router();

const twilioService = require('../services/twilioService');

const { authenticateToken } = require('../middleware/auth');

const db = require('../database/db');

const Joi = require('joi');



// Validation schemas

const sendSMSSchema = Joi.object({

&nbsp; to: Joi.string().required(),

&nbsp; body: Joi.string().required().max(1600),

&nbsp; leadId: Joi.string().uuid().optional(),

&nbsp; contactId: Joi.string().uuid().optional(),

&nbsp; templateId: Joi.string().uuid().optional()

});



const makeCallSchema = Joi.object({

&nbsp; to: Joi.string().required(),

&nbsp; leadId: Joi.string().uuid().optional(),

&nbsp; contactId: Joi.string().uuid().optional()

});



const twilioConfigSchema = Joi.object({

&nbsp; accountSid: Joi.string().required(),

&nbsp; authToken: Joi.string().required(),

&nbsp; phoneNumber: Joi.string().required()

});



/\*\*

&nbsp;\* Configure Twilio for organization

&nbsp;\*/

router.post('/config', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { error } = twilioConfigSchema.validate(req.body);

&nbsp;   if (error) {

&nbsp;     return res.status(400).json({ error: error.details\[0].message });

&nbsp;   }



&nbsp;   const { accountSid, authToken, phoneNumber } = req.body;

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const userId = req.user.userId;



&nbsp;   // Verify Twilio credentials by testing

&nbsp;   const twilio = require('twilio');

&nbsp;   const client = twilio(accountSid, authToken);

&nbsp;   

&nbsp;   try {

&nbsp;     await client.incomingPhoneNumbers.list({ limit: 1 });

&nbsp;   } catch (err) {

&nbsp;     return res.status(400).json({ error: 'Invalid Twilio credentials' });

&nbsp;   }



&nbsp;   const query = `

&nbsp;     INSERT INTO twilio\_config (

&nbsp;       organization\_id, account\_sid, auth\_token, phone\_number,

&nbsp;       is\_active, verified\_at, created\_by

&nbsp;     ) VALUES ($1, $2, $3, $4, true, NOW(), $5)

&nbsp;     ON CONFLICT (organization\_id)

&nbsp;     DO UPDATE SET

&nbsp;       account\_sid = EXCLUDED.account\_sid,

&nbsp;       auth\_token = EXCLUDED.auth\_token,

&nbsp;       phone\_number = EXCLUDED.phone\_number,

&nbsp;       verified\_at = NOW(),

&nbsp;       updated\_at = NOW()

&nbsp;     RETURNING id, organization\_id, phone\_number, sms\_enabled, voice\_enabled, is\_active

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[

&nbsp;     organizationId, accountSid, authToken, phoneNumber, userId

&nbsp;   ]);



&nbsp;   res.json({

&nbsp;     message: 'Twilio configured successfully',

&nbsp;     config: result.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error configuring Twilio:', error);

&nbsp;   res.status(500).json({ error: 'Failed to configure Twilio' });

&nbsp; }

});



/\*\*

&nbsp;\* Get Twilio configuration

&nbsp;\*/

router.get('/config', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   const query = `

&nbsp;     SELECT id, phone\_number, sms\_enabled, voice\_enabled, is\_active, verified\_at

&nbsp;     FROM twilio\_config

&nbsp;     WHERE organization\_id = $1

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[organizationId]);



&nbsp;   if (result.rows.length === 0) {

&nbsp;     return res.json({ configured: false });

&nbsp;   }



&nbsp;   res.json({

&nbsp;     configured: true,

&nbsp;     config: result.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error fetching Twilio config:', error);

&nbsp;   res.status(500).json({ error: 'Failed to fetch configuration' });

&nbsp; }

});



/\*\*

&nbsp;\* Send SMS

&nbsp;\*/

router.post('/sms/send', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { error } = sendSMSSchema.validate(req.body);

&nbsp;   if (error) {

&nbsp;     return res.status(400).json({ error: error.details\[0].message });

&nbsp;   }



&nbsp;   const { to, body, leadId, contactId, templateId } = req.body;

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const userId = req.user.userId;



&nbsp;   const message = await twilioService.sendSMS({

&nbsp;     organizationId,

&nbsp;     to,

&nbsp;     body,

&nbsp;     leadId,

&nbsp;     contactId,

&nbsp;     userId,

&nbsp;     templateId

&nbsp;   });



&nbsp;   res.json({

&nbsp;     message: 'SMS sent successfully',

&nbsp;     data: message

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error sending SMS:', error);

&nbsp;   res.status(500).json({ error: error.message || 'Failed to send SMS' });

&nbsp; }

});



/\*\*

&nbsp;\* Get SMS history

&nbsp;\*/

router.get('/sms', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const { leadId, contactId, direction, limit = 50, offset = 0 } = req.query;



&nbsp;   let query = `

&nbsp;     SELECT 

&nbsp;       sm.\*,

&nbsp;       l.first\_name as lead\_first\_name,

&nbsp;       l.last\_name as lead\_last\_name,

&nbsp;       c.first\_name as contact\_first\_name,

&nbsp;       c.last\_name as contact\_last\_name,

&nbsp;       u.first\_name as user\_first\_name,

&nbsp;       u.last\_name as user\_last\_name

&nbsp;     FROM sms\_messages sm

&nbsp;     LEFT JOIN leads l ON sm.lead\_id = l.id

&nbsp;     LEFT JOIN contacts c ON sm.contact\_id = c.id

&nbsp;     LEFT JOIN users u ON sm.user\_id = u.id

&nbsp;     WHERE sm.organization\_id = $1

&nbsp;   `;



&nbsp;   const params = \[organizationId];

&nbsp;   let paramCount = 1;



&nbsp;   if (leadId) {

&nbsp;     paramCount++;

&nbsp;     query += ` AND sm.lead\_id = $${paramCount}`;

&nbsp;     params.push(leadId);

&nbsp;   }



&nbsp;   if (contactId) {

&nbsp;     paramCount++;

&nbsp;     query += ` AND sm.contact\_id = $${paramCount}`;

&nbsp;     params.push(contactId);

&nbsp;   }



&nbsp;   if (direction) {

&nbsp;     paramCount++;

&nbsp;     query += ` AND sm.direction = $${paramCount}`;

&nbsp;     params.push(direction);

&nbsp;   }



&nbsp;   query += ` ORDER BY sm.created\_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;

&nbsp;   params.push(limit, offset);



&nbsp;   const result = await db.query(query, params);



&nbsp;   // Get total count

&nbsp;   let countQuery = 'SELECT COUNT(\*) FROM sms\_messages WHERE organization\_id = $1';

&nbsp;   const countParams = \[organizationId];

&nbsp;   

&nbsp;   if (leadId) countQuery += ` AND lead\_id = $${countParams.push(leadId)}`;

&nbsp;   if (contactId) countQuery += ` AND contact\_id = $${countParams.push(contactId)}`;

&nbsp;   if (direction) countQuery += ` AND direction = $${countParams.push(direction)}`;



&nbsp;   const countResult = await db.query(countQuery, countParams);



&nbsp;   res.json({

&nbsp;     messages: result.rows,

&nbsp;     pagination: {

&nbsp;       total: parseInt(countResult.rows\[0].count),

&nbsp;       limit: parseInt(limit),

&nbsp;       offset: parseInt(offset)

&nbsp;     }

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error fetching SMS history:', error);

&nbsp;   res.status(500).json({ error: 'Failed to fetch SMS history' });

&nbsp; }

});



/\*\*

&nbsp;\* Make phone call

&nbsp;\*/

router.post('/call/make', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { error } = makeCallSchema.validate(req.body);

&nbsp;   if (error) {

&nbsp;     return res.status(400).json({ error: error.details\[0].message });

&nbsp;   }



&nbsp;   const { to, leadId, contactId } = req.body;

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const userId = req.user.userId;



&nbsp;   const call = await twilioService.makeCall({

&nbsp;     organizationId,

&nbsp;     to,

&nbsp;     leadId,

&nbsp;     contactId,

&nbsp;     userId

&nbsp;   });



&nbsp;   res.json({

&nbsp;     message: 'Call initiated successfully',

&nbsp;     data: call

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error making call:', error);

&nbsp;   res.status(500).json({ error: error.message || 'Failed to initiate call' });

&nbsp; }

});



/\*\*

&nbsp;\* Get call history

&nbsp;\*/

router.get('/call', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const { leadId, contactId, direction, limit = 50, offset = 0 } = req.query;



&nbsp;   let query = `

&nbsp;     SELECT 

&nbsp;       pc.\*,

&nbsp;       l.first\_name as lead\_first\_name,

&nbsp;       l.last\_name as lead\_last\_name,

&nbsp;       c.first\_name as contact\_first\_name,

&nbsp;       c.last\_name as contact\_last\_name,

&nbsp;       u.first\_name as user\_first\_name,

&nbsp;       u.last\_name as user\_last\_name

&nbsp;     FROM phone\_calls pc

&nbsp;     LEFT JOIN leads l ON pc.lead\_id = l.id

&nbsp;     LEFT JOIN contacts c ON pc.contact\_id = c.id

&nbsp;     LEFT JOIN users u ON pc.user\_id = u.id

&nbsp;     WHERE pc.organization\_id = $1

&nbsp;   `;



&nbsp;   const params = \[organizationId];

&nbsp;   let paramCount = 1;



&nbsp;   if (leadId) {

&nbsp;     paramCount++;

&nbsp;     query += ` AND pc.lead\_id = $${paramCount}`;

&nbsp;     params.push(leadId);

&nbsp;   }



&nbsp;   if (contactId) {

&nbsp;     paramCount++;

&nbsp;     query += ` AND pc.contact\_id = $${paramCount}`;

&nbsp;     params.push(contactId);

&nbsp;   }



&nbsp;   if (direction) {

&nbsp;     paramCount++;

&nbsp;     query += ` AND pc.direction = $${paramCount}`;

&nbsp;     params.push(direction);

&nbsp;   }



&nbsp;   query += ` ORDER BY pc.created\_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;

&nbsp;   params.push(limit, offset);



&nbsp;   const result = await db.query(query, params);



&nbsp;   res.json({

&nbsp;     calls: result.rows,

&nbsp;     pagination: {

&nbsp;       total: result.rows.length,

&nbsp;       limit: parseInt(limit),

&nbsp;       offset: parseInt(offset)

&nbsp;     }

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error fetching call history:', error);

&nbsp;   res.status(500).json({ error: 'Failed to fetch call history' });

&nbsp; }

});



/\*\*

&nbsp;\* SMS Templates - List all

&nbsp;\*/

router.get('/templates', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const { category } = req.query;



&nbsp;   let query = `

&nbsp;     SELECT \* FROM sms\_templates

&nbsp;     WHERE organization\_id = $1 AND is\_active = true

&nbsp;   `;



&nbsp;   const params = \[organizationId];



&nbsp;   if (category) {

&nbsp;     query += ` AND category = $2`;

&nbsp;     params.push(category);

&nbsp;   }



&nbsp;   query += ` ORDER BY name ASC`;



&nbsp;   const result = await db.query(query, params);



&nbsp;   res.json({ templates: result.rows });

&nbsp; } catch (error) {

&nbsp;   console.error('Error fetching templates:', error);

&nbsp;   res.status(500).json({ error: 'Failed to fetch templates' });

&nbsp; }

});



/\*\*

&nbsp;\* SMS Templates - Create

&nbsp;\*/

router.post('/templates', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { name, category, body } = req.body;

&nbsp;   const organizationId = req.user.organizationId;

&nbsp;   const userId = req.user.userId;



&nbsp;   const query = `

&nbsp;     INSERT INTO sms\_templates (organization\_id, name, category, body, created\_by)

&nbsp;     VALUES ($1, $2, $3, $4, $5)

&nbsp;     RETURNING \*

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[organizationId, name, category, body, userId]);



&nbsp;   res.json({

&nbsp;     message: 'Template created successfully',

&nbsp;     template: result.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error creating template:', error);

&nbsp;   res.status(500).json({ error: 'Failed to create template' });

&nbsp; }

});



/\*\*

&nbsp;\* SMS Templates - Update

&nbsp;\*/

router.put('/templates/:id', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { id } = req.params;

&nbsp;   const { name, category, body, is\_active } = req.body;

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   const query = `

&nbsp;     UPDATE sms\_templates

&nbsp;     SET name = COALESCE($1, name),

&nbsp;         category = COALESCE($2, category),

&nbsp;         body = COALESCE($3, body),

&nbsp;         is\_active = COALESCE($4, is\_active),

&nbsp;         updated\_at = NOW()

&nbsp;     WHERE id = $5 AND organization\_id = $6

&nbsp;     RETURNING \*

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[name, category, body, is\_active, id, organizationId]);



&nbsp;   if (result.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Template not found' });

&nbsp;   }



&nbsp;   res.json({

&nbsp;     message: 'Template updated successfully',

&nbsp;     template: result.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error updating template:', error);

&nbsp;   res.status(500).json({ error: 'Failed to update template' });

&nbsp; }

});



/\*\*

&nbsp;\* SMS Templates - Delete

&nbsp;\*/

router.delete('/templates/:id', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const { id } = req.params;

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   const query = `

&nbsp;     DELETE FROM sms\_templates

&nbsp;     WHERE id = $1 AND organization\_id = $2

&nbsp;     RETURNING id

&nbsp;   `;



&nbsp;   const result = await db.query(query, \[id, organizationId]);



&nbsp;   if (result.rows.length === 0) {

&nbsp;     return res.status(404).json({ error: 'Template not found' });

&nbsp;   }



&nbsp;   res.json({ message: 'Template deleted successfully' });

&nbsp; } catch (error) {

&nbsp;   console.error('Error deleting template:', error);

&nbsp;   res.status(500).json({ error: 'Failed to delete template' });

&nbsp; }

});



/\*\*

&nbsp;\* Twilio Webhooks - Incoming SMS

&nbsp;\*/

router.post('/webhook/sms', async (req, res) => {

&nbsp; try {

&nbsp;   await twilioService.processIncomingSMS(req.body);

&nbsp;   

&nbsp;   // Respond with TwiML (required by Twilio)

&nbsp;   res.type('text/xml');

&nbsp;   res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');

&nbsp; } catch (error) {

&nbsp;   console.error('Error processing incoming SMS:', error);

&nbsp;   res.status(500).send('Error processing SMS');

&nbsp; }

});



/\*\*

&nbsp;\* Twilio Webhooks - SMS Status Updates

&nbsp;\*/

router.post('/webhook/sms-status', async (req, res) => {

&nbsp; try {

&nbsp;   const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

&nbsp;   

&nbsp;   await twilioService.updateSMSStatus(

&nbsp;     MessageSid,

&nbsp;     MessageStatus,

&nbsp;     ErrorCode ? parseInt(ErrorCode) : null,

&nbsp;     ErrorMessage

&nbsp;   );



&nbsp;   res.status(200).send('OK');

&nbsp; } catch (error) {

&nbsp;   console.error('Error updating SMS status:', error);

&nbsp;   res.status(500).send('Error');

&nbsp; }

});



/\*\*

&nbsp;\* Twilio Webhooks - Voice (TwiML for calls)

&nbsp;\*/

router.post('/webhook/voice', async (req, res) => {

&nbsp; try {

&nbsp;   // Return TwiML to connect call

&nbsp;   const twiml = `<?xml version="1.0" encoding="UTF-8"?>

&nbsp;     <Response>

&nbsp;       <Say>Please wait while we connect your call.</Say>

&nbsp;       <Dial record="record-from-answer">

&nbsp;         <!-- Forward to user's phone or SIP endpoint -->

&nbsp;         <Number>${process.env.FORWARD\_CALLS\_TO || '+1234567890'}</Number>

&nbsp;       </Dial>

&nbsp;     </Response>`;



&nbsp;   res.type('text/xml');

&nbsp;   res.send(twiml);

&nbsp; } catch (error) {

&nbsp;   console.error('Error handling voice webhook:', error);

&nbsp;   res.status(500).send('Error');

&nbsp; }

});



/\*\*

&nbsp;\* Twilio Webhooks - Call Status Updates

&nbsp;\*/

router.post('/webhook/call-status', async (req, res) => {

&nbsp; try {

&nbsp;   const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

&nbsp;   

&nbsp;   await twilioService.updateCallStatus(

&nbsp;     CallSid,

&nbsp;     CallStatus,

&nbsp;     CallDuration ? parseInt(CallDuration) : null,

&nbsp;     RecordingUrl

&nbsp;   );



&nbsp;   res.status(200).send('OK');

&nbsp; } catch (error) {

&nbsp;   console.error('Error updating call status:', error);

&nbsp;   res.status(500).send('Error');

&nbsp; }

});



/\*\*

&nbsp;\* Get SMS/Call Statistics

&nbsp;\*/

router.get('/stats', authenticateToken, async (req, res) => {

&nbsp; try {

&nbsp;   const organizationId = req.user.organizationId;



&nbsp;   // SMS stats

&nbsp;   const smsQuery = `

&nbsp;     SELECT 

&nbsp;       COUNT(\*) as total\_sms,

&nbsp;       COUNT(\*) FILTER (WHERE direction = 'outbound') as sent,

&nbsp;       COUNT(\*) FILTER (WHERE direction = 'inbound') as received,

&nbsp;       COUNT(\*) FILTER (WHERE twilio\_status = 'delivered') as delivered,

&nbsp;       COUNT(\*) FILTER (WHERE twilio\_status = 'failed') as failed,

&nbsp;       SUM(cost) as total\_sms\_cost

&nbsp;     FROM sms\_messages

&nbsp;     WHERE organization\_id = $1

&nbsp;   `;



&nbsp;   const smsResult = await db.query(smsQuery, \[organizationId]);



&nbsp;   // Call stats

&nbsp;   const callQuery = `

&nbsp;     SELECT 

&nbsp;       COUNT(\*) as total\_calls,

&nbsp;       COUNT(\*) FILTER (WHERE direction = 'outbound') as outbound,

&nbsp;       COUNT(\*) FILTER (WHERE direction = 'inbound') as inbound,

&nbsp;       COUNT(\*) FILTER (WHERE outcome = 'answered') as answered,

&nbsp;       SUM(duration\_seconds) as total\_duration,

&nbsp;       SUM(cost) as total\_call\_cost

&nbsp;     FROM phone\_calls

&nbsp;     WHERE organization\_id = $1

&nbsp;   `;



&nbsp;   const callResult = await db.query(callQuery, \[organizationId]);



&nbsp;   res.json({

&nbsp;     sms: smsResult.rows\[0],

&nbsp;     calls: callResult.rows\[0]

&nbsp;   });

&nbsp; } catch (error) {

&nbsp;   console.error('Error fetching stats:', error);

&nbsp;   res.status(500).json({ error: 'Failed to fetch statistics' });

&nbsp; }

});



module.exports = router;

```



---



\### File: `server.js` (Update to include Twilio routes)



Add this line with your other route imports:



```javascript

const twilioRoutes = require('./routes/twilio');



// ... other code ...



// Add this with your other routes

app.use('/api/twilio', twilioRoutes);

```



---



\## Phase 3: Frontend Implementation



\### File: `frontend/src/pages/CommunicationsPage.jsx` (New File)



```jsx

import React, { useState } from 'react';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { MessageSquare, Phone, Send, Settings, Plus } from 'lucide-react';

import { twilioAPI } from '../services/api';

import SendSMSModal from '../components/SendSMSModal';

import SMSHistoryList from '../components/SMSHistoryList';

import CallHistoryList from '../components/CallHistoryList';

import TwilioConfigModal from '../components/TwilioConfigModal';

import LoadingSpinner from '../components/LoadingSpinner';



const CommunicationsPage = () => {

&nbsp; const \[activeTab, setActiveTab] = useState('sms'); // 'sms', 'calls', 'templates'

&nbsp; const \[showSendSMS, setShowSendSMS] = useState(false);

&nbsp; const \[showConfig, setShowConfig] = useState(false);

&nbsp; const queryClient = useQueryClient();



&nbsp; // Check Twilio configuration

&nbsp; const { data: config, isLoading: configLoading } = useQuery({

&nbsp;   queryKey: \['twilioConfig'],

&nbsp;   queryFn: twilioAPI.getConfig

&nbsp; });



&nbsp; // Get statistics

&nbsp; const { data: stats } = useQuery({

&nbsp;   queryKey: \['twilioStats'],

&nbsp;   queryFn: twilioAPI.getStats,

&nbsp;   enabled: config?.configured

&nbsp; });



&nbsp; if (configLoading) {

&nbsp;   return <LoadingSpinner />;

&nbsp; }



&nbsp; // If Twilio not configured, show setup screen

&nbsp; if (!config?.configured) {

&nbsp;   return (

&nbsp;     <div className="max-w-2xl mx-auto mt-16">

&nbsp;       <div className="bg-white rounded-lg shadow-sm p-8 text-center">

&nbsp;         <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">

&nbsp;           <MessageSquare className="w-8 h-8 text-blue-600" />

&nbsp;         </div>

&nbsp;         <h2 className="text-2xl font-bold text-gray-900 mb-2">

&nbsp;           Set Up Twilio Integration

&nbsp;         </h2>

&nbsp;         <p className="text-gray-600 mb-6">

&nbsp;           Connect your Twilio account to send SMS messages and make phone calls directly from your CRM.

&nbsp;         </p>

&nbsp;         <button

&nbsp;           onClick={() => setShowConfig(true)}

&nbsp;           className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"

&nbsp;         >

&nbsp;           <Settings className="w-4 h-4 inline mr-2" />

&nbsp;           Configure Twilio

&nbsp;         </button>

&nbsp;       </div>



&nbsp;       {showConfig \&\& (

&nbsp;         <TwilioConfigModal

&nbsp;           onClose={() => setShowConfig(false)}

&nbsp;           onSuccess={() => queryClient.invalidateQueries(\['twilioConfig'])}

&nbsp;         />

&nbsp;       )}

&nbsp;     </div>

&nbsp;   );

&nbsp; }



&nbsp; return (

&nbsp;   <div className="space-y-6">

&nbsp;     {/\* Header \*/}

&nbsp;     <div className="flex items-center justify-between">

&nbsp;       <div>

&nbsp;         <h1 className="text-2xl font-bold text-gray-900">Communications</h1>

&nbsp;         <p className="text-gray-600">Manage SMS messages and phone calls</p>

&nbsp;       </div>

&nbsp;       <div className="flex gap-3">

&nbsp;         <button

&nbsp;           onClick={() => setShowConfig(true)}

&nbsp;           className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"

&nbsp;         >

&nbsp;           <Settings className="w-4 h-4 inline mr-2" />

&nbsp;           Settings

&nbsp;         </button>

&nbsp;         <button

&nbsp;           onClick={() => setShowSendSMS(true)}

&nbsp;           className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"

&nbsp;         >

&nbsp;           <Send className="w-4 h-4 inline mr-2" />

&nbsp;           Send SMS

&nbsp;         </button>

&nbsp;       </div>

&nbsp;     </div>



&nbsp;     {/\* Statistics Cards \*/}

&nbsp;     {stats \&\& (

&nbsp;       <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

&nbsp;         <div className="bg-white rounded-lg shadow-sm p-6">

&nbsp;           <div className="flex items-center justify-between">

&nbsp;             <div>

&nbsp;               <p className="text-sm text-gray-600">Total SMS</p>

&nbsp;               <p className="text-2xl font-bold text-gray-900">

&nbsp;                 {stats.sms.total\_sms || 0}

&nbsp;               </p>

&nbsp;             </div>

&nbsp;             <MessageSquare className="w-8 h-8 text-blue-600" />

&nbsp;           </div>

&nbsp;           <p className="text-sm text-gray-500 mt-2">

&nbsp;             {stats.sms.sent || 0} sent • {stats.sms.received || 0} received

&nbsp;           </p>

&nbsp;         </div>



&nbsp;         <div className="bg-white rounded-lg shadow-sm p-6">

&nbsp;           <div className="flex items-center justify-between">

&nbsp;             <div>

&nbsp;               <p className="text-sm text-gray-600">Delivered</p>

&nbsp;               <p className="text-2xl font-bold text-green-600">

&nbsp;                 {stats.sms.delivered || 0}

&nbsp;               </p>

&nbsp;             </div>

&nbsp;             <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">

&nbsp;               <span className="text-green-600 font-bold">✓</span>

&nbsp;             </div>

&nbsp;           </div>

&nbsp;         </div>



&nbsp;         <div className="bg-white rounded-lg shadow-sm p-6">

&nbsp;           <div className="flex items-center justify-between">

&nbsp;             <div>

&nbsp;               <p className="text-sm text-gray-600">Total Calls</p>

&nbsp;               <p className="text-2xl font-bold text-gray-900">

&nbsp;                 {stats.calls.total\_calls || 0}

&nbsp;               </p>

&nbsp;             </div>

&nbsp;             <Phone className="w-8 h-8 text-purple-600" />

&nbsp;           </div>

&nbsp;           <p className="text-sm text-gray-500 mt-2">

&nbsp;             {stats.calls.answered || 0} answered

&nbsp;           </p>

&nbsp;         </div>



&nbsp;         <div className="bg-white rounded-lg shadow-sm p-6">

&nbsp;           <div className="flex items-center justify-between">

&nbsp;             <div>

&nbsp;               <p className="text-sm text-gray-600">Total Cost</p>

&nbsp;               <p className="text-2xl font-bold text-gray-900">

&nbsp;                 ${((parseFloat(stats.sms.total\_sms\_cost || 0) + parseFloat(stats.calls.total\_call\_cost || 0))).toFixed(2)}

&nbsp;               </p>

&nbsp;             </div>

&nbsp;             <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">

&nbsp;               <span className="text-gray-600 font-bold">$</span>

&nbsp;             </div>

&nbsp;           </div>

&nbsp;         </div>

&nbsp;       </div>

&nbsp;     )}



&nbsp;     {/\* Tabs \*/}

&nbsp;     <div className="bg-white rounded-lg shadow-sm">

&nbsp;       <div className="border-b border-gray-200">

&nbsp;         <nav className="flex -mb-px">

&nbsp;           <button

&nbsp;             onClick={() => setActiveTab('sms')}

&nbsp;             className={`px-6 py-4 text-sm font-medium border-b-2 ${

&nbsp;               activeTab === 'sms'

&nbsp;                 ? 'border-blue-600 text-blue-600'

&nbsp;                 : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

&nbsp;             }`}

&nbsp;           >

&nbsp;             <MessageSquare className="w-4 h-4 inline mr-2" />

&nbsp;             SMS Messages

&nbsp;           </button>

&nbsp;           <button

&nbsp;             onClick={() => setActiveTab('calls')}

&nbsp;             className={`px-6 py-4 text-sm font-medium border-b-2 ${

&nbsp;               activeTab === 'calls'

&nbsp;                 ? 'border-blue-600 text-blue-600'

&nbsp;                 : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'

&nbsp;             }`}

&nbsp;           >

&nbsp;             <Phone className="w-4 h-4 inline mr-2" />

&nbsp;             Phone Calls

&nbsp;           </button>

&nbsp;         </nav>

&nbsp;       </div>



&nbsp;       {/\* Tab Content \*/}

&nbsp;       <div className="p-6">

&nbsp;         {activeTab === 'sms' \&\& <SMSHistoryList />}

&nbsp;         {activeTab === 'calls' \&\& <CallHistoryList />}

&nbsp;       </div>

&nbsp;     </div>



&nbsp;     {/\* Modals \*/}

&nbsp;     {showSendSMS \&\& (

&nbsp;       <SendSMSModal

&nbsp;         onClose={() => setShowSendSMS(false)}

&nbsp;         onSuccess={() => {

&nbsp;           setShowSendSMS(false);

&nbsp;           queryClient.invalidateQueries(\['smsHistory']);

&nbsp;           queryClient.invalidateQueries(\['twilioStats']);

&nbsp;         }}

&nbsp;       />

&nbsp;     )}



&nbsp;     {showConfig \&\& (

&nbsp;       <TwilioConfigModal

&nbsp;         onClose={() => setShowConfig(false)}

&nbsp;         onSuccess={() => queryClient.invalidateQueries(\['twilioConfig'])}

&nbsp;       />

&nbsp;     )}

&nbsp;   </div>

&nbsp; );

};



export default CommunicationsPage;

```



---



\### File: `frontend/src/components/SendSMSModal.jsx` (New File)



```jsx

import React, { useState } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';

import { X, Send, FileText } from 'lucide-react';

import { twilioAPI, leadsAPI, contactsAPI } from '../services/api';



const SendSMSModal = ({ onClose, onSuccess, prefilledTo = '', prefilledLeadId = null, prefilledContactId = null }) => {

&nbsp; const \[formData, setFormData] = useState({

&nbsp;   to: prefilledTo,

&nbsp;   body: '',

&nbsp;   leadId: prefilledLeadId,

&nbsp;   contactId: prefilledContactId,

&nbsp;   templateId: null

&nbsp; });

&nbsp; const \[searchPhone, setSearchPhone] = useState('');

&nbsp; const \[showTemplates, setShowTemplates] = useState(false);



&nbsp; // Get SMS templates

&nbsp; const { data: templates } = useQuery({

&nbsp;   queryKey: \['smsTemplates'],

&nbsp;   queryFn: twilioAPI.getTemplates

&nbsp; });



&nbsp; // Send SMS mutation

&nbsp; const sendMutation = useMutation({

&nbsp;   mutationFn: twilioAPI.sendSMS,

&nbsp;   onSuccess: () => {

&nbsp;     onSuccess();

&nbsp;   }

&nbsp; });



&nbsp; const handleSubmit = (e) => {

&nbsp;   e.preventDefault();

&nbsp;   

&nbsp;   if (!formData.to || !formData.body) {

&nbsp;     alert('Please enter phone number and message');

&nbsp;     return;

&nbsp;   }



&nbsp;   sendMutation.mutate(formData);

&nbsp; };



&nbsp; const handleTemplateSelect = (template) => {

&nbsp;   setFormData({ ...formData, body: template.body, templateId: template.id });

&nbsp;   setShowTemplates(false);

&nbsp; };



&nbsp; const characterCount = formData.body.length;

&nbsp; const segmentCount = Math.ceil(characterCount / 160);



&nbsp; return (

&nbsp;   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

&nbsp;     <div className="bg-white rounded-lg max-w-2xl w-full max-h-\[90vh] overflow-hidden">

&nbsp;       {/\* Header \*/}

&nbsp;       <div className="flex items-center justify-between p-6 border-b border-gray-200">

&nbsp;         <h2 className="text-xl font-semibold text-gray-900">Send SMS Message</h2>

&nbsp;         <button

&nbsp;           onClick={onClose}

&nbsp;           className="text-gray-400 hover:text-gray-600"

&nbsp;         >

&nbsp;           <X className="w-6 h-6" />

&nbsp;         </button>

&nbsp;       </div>



&nbsp;       {/\* Form \*/}

&nbsp;       <form onSubmit={handleSubmit} className="p-6 space-y-4">

&nbsp;         {/\* To (Phone Number) \*/}

&nbsp;         <div>

&nbsp;           <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;             To (Phone Number) \*

&nbsp;           </label>

&nbsp;           <input

&nbsp;             type="tel"

&nbsp;             value={formData.to}

&nbsp;             onChange={(e) => setFormData({ ...formData, to: e.target.value })}

&nbsp;             placeholder="+1234567890"

&nbsp;             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

&nbsp;             required

&nbsp;           />

&nbsp;           <p className="text-sm text-gray-500 mt-1">

&nbsp;             Include country code (e.g., +1 for US)

&nbsp;           </p>

&nbsp;         </div>



&nbsp;         {/\* Template Selector \*/}

&nbsp;         <div>

&nbsp;           <div className="flex items-center justify-between mb-2">

&nbsp;             <label className="block text-sm font-medium text-gray-700">

&nbsp;               Message \*

&nbsp;             </label>

&nbsp;             <button

&nbsp;               type="button"

&nbsp;               onClick={() => setShowTemplates(!showTemplates)}

&nbsp;               className="text-sm text-blue-600 hover:text-blue-700"

&nbsp;             >

&nbsp;               <FileText className="w-4 h-4 inline mr-1" />

&nbsp;               Use Template

&nbsp;             </button>

&nbsp;           </div>



&nbsp;           {/\* Templates Dropdown \*/}

&nbsp;           {showTemplates \&\& templates?.templates \&\& (

&nbsp;             <div className="mb-2 border border-gray-300 rounded-lg max-h-40 overflow-y-auto">

&nbsp;               {templates.templates.map((template) => (

&nbsp;                 <button

&nbsp;                   key={template.id}

&nbsp;                   type="button"

&nbsp;                   onClick={() => handleTemplateSelect(template)}

&nbsp;                   className="w-full text-left px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"

&nbsp;                 >

&nbsp;                   <p className="font-medium text-gray-900">{template.name}</p>

&nbsp;                   <p className="text-sm text-gray-500 truncate">{template.body}</p>

&nbsp;                 </button>

&nbsp;               ))}

&nbsp;             </div>

&nbsp;           )}



&nbsp;           <textarea

&nbsp;             value={formData.body}

&nbsp;             onChange={(e) => setFormData({ ...formData, body: e.target.value })}

&nbsp;             placeholder="Type your message here..."

&nbsp;             rows="6"

&nbsp;             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"

&nbsp;             required

&nbsp;           />

&nbsp;           

&nbsp;           {/\* Character Count \*/}

&nbsp;           <div className="flex items-center justify-between mt-2 text-sm">

&nbsp;             <p className="text-gray-500">

&nbsp;               {characterCount} characters • {segmentCount} segment{segmentCount !== 1 ? 's' : ''}

&nbsp;             </p>

&nbsp;             <p className={characterCount > 1600 ? 'text-red-600' : 'text-gray-500'}>

&nbsp;               Max: 1600 characters

&nbsp;             </p>

&nbsp;           </div>

&nbsp;         </div>



&nbsp;         {/\* Error Message \*/}

&nbsp;         {sendMutation.isError \&\& (

&nbsp;           <div className="p-4 bg-red-50 border border-red-200 rounded-lg">

&nbsp;             <p className="text-sm text-red-600">

&nbsp;               {sendMutation.error?.response?.data?.error || 'Failed to send SMS'}

&nbsp;             </p>

&nbsp;           </div>

&nbsp;         )}



&nbsp;         {/\* Actions \*/}

&nbsp;         <div className="flex gap-3 justify-end pt-4">

&nbsp;           <button

&nbsp;             type="button"

&nbsp;             onClick={onClose}

&nbsp;             className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"

&nbsp;           >

&nbsp;             Cancel

&nbsp;           </button>

&nbsp;           <button

&nbsp;             type="submit"

&nbsp;             disabled={sendMutation.isPending || !formData.to || !formData.body}

&nbsp;             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"

&nbsp;           >

&nbsp;             {sendMutation.isPending ? (

&nbsp;               <>

&nbsp;                 <span className="inline-block animate-spin mr-2">⏳</span>

&nbsp;                 Sending...

&nbsp;               </>

&nbsp;             ) : (

&nbsp;               <>

&nbsp;                 <Send className="w-4 h-4 inline mr-2" />

&nbsp;                 Send SMS

&nbsp;               </>

&nbsp;             )}

&nbsp;           </button>

&nbsp;         </div>

&nbsp;       </form>

&nbsp;     </div>

&nbsp;   </div>

&nbsp; );

};



export default SendSMSModal;

```



---



\### File: `frontend/src/components/SMSHistoryList.jsx` (New File)



```jsx

import React, { useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { MessageSquare, Send, Inbox, CheckCircle, XCircle, Clock } from 'lucide-react';

import { twilioAPI } from '../services/api';

import LoadingSpinner from './LoadingSpinner';



const SMSHistoryList = ({ leadId = null, contactId = null }) => {

&nbsp; const \[filters, setFilters] = useState({

&nbsp;   direction: '', // '', 'inbound', 'outbound'

&nbsp;   limit: 50,

&nbsp;   offset: 0

&nbsp; });



&nbsp; const { data, isLoading } = useQuery({

&nbsp;   queryKey: \['smsHistory', filters, leadId, contactId],

&nbsp;   queryFn: () => twilioAPI.getSMSHistory({ ...filters, leadId, contactId })

&nbsp; });



&nbsp; if (isLoading) {

&nbsp;   return <LoadingSpinner />;

&nbsp; }



&nbsp; const messages = data?.messages || \[];



&nbsp; const getStatusIcon = (status) => {

&nbsp;   switch (status) {

&nbsp;     case 'delivered':

&nbsp;       return <CheckCircle className="w-4 h-4 text-green-600" />;

&nbsp;     case 'failed':

&nbsp;       return <XCircle className="w-4 h-4 text-red-600" />;

&nbsp;     case 'sent':

&nbsp;     case 'queued':

&nbsp;       return <Clock className="w-4 h-4 text-yellow-600" />;

&nbsp;     default:

&nbsp;       return <MessageSquare className="w-4 h-4 text-gray-400" />;

&nbsp;   }

&nbsp; };



&nbsp; const formatPhoneNumber = (phone) => {

&nbsp;   if (!phone) return '';

&nbsp;   // Format +1234567890 to +1 (234) 567-8900

&nbsp;   const cleaned = phone.replace(/\\D/g, '');

&nbsp;   const match = cleaned.match(/^(\\d{1})(\\d{3})(\\d{3})(\\d{4})$/);

&nbsp;   if (match) {

&nbsp;     return `+${match\[1]} (${match\[2]}) ${match\[3]}-${match\[4]}`;

&nbsp;   }

&nbsp;   return phone;

&nbsp; };



&nbsp; return (

&nbsp;   <div className="space-y-4">

&nbsp;     {/\* Filters \*/}

&nbsp;     <div className="flex gap-2">

&nbsp;       <button

&nbsp;         onClick={() => setFilters({ ...filters, direction: '' })}

&nbsp;         className={`px-4 py-2 rounded-lg ${

&nbsp;           filters.direction === ''

&nbsp;             ? 'bg-blue-600 text-white'

&nbsp;             : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

&nbsp;         }`}

&nbsp;       >

&nbsp;         All Messages

&nbsp;       </button>

&nbsp;       <button

&nbsp;         onClick={() => setFilters({ ...filters, direction: 'outbound' })}

&nbsp;         className={`px-4 py-2 rounded-lg ${

&nbsp;           filters.direction === 'outbound'

&nbsp;             ? 'bg-blue-600 text-white'

&nbsp;             : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

&nbsp;         }`}

&nbsp;       >

&nbsp;         <Send className="w-4 h-4 inline mr-1" />

&nbsp;         Sent

&nbsp;       </button>

&nbsp;       <button

&nbsp;         onClick={() => setFilters({ ...filters, direction: 'inbound' })}

&nbsp;         className={`px-4 py-2 rounded-lg ${

&nbsp;           filters.direction === 'inbound'

&nbsp;             ? 'bg-blue-600 text-white'

&nbsp;             : 'bg-gray-100 text-gray-700 hover:bg-gray-200'

&nbsp;         }`}

&nbsp;       >

&nbsp;         <Inbox className="w-4 h-4 inline mr-1" />

&nbsp;         Received

&nbsp;       </button>

&nbsp;     </div>



&nbsp;     {/\* Messages List \*/}

&nbsp;     {messages.length === 0 ? (

&nbsp;       <div className="text-center py-12">

&nbsp;         <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />

&nbsp;         <p className="text-gray-500">No SMS messages yet</p>

&nbsp;       </div>

&nbsp;     ) : (

&nbsp;       <div className="space-y-3">

&nbsp;         {messages.map((message) => (

&nbsp;           <div

&nbsp;             key={message.id}

&nbsp;             className={`p-4 rounded-lg border ${

&nbsp;               message.direction === 'outbound'

&nbsp;                 ? 'bg-blue-50 border-blue-200 ml-8'

&nbsp;                 : 'bg-gray-50 border-gray-200 mr-8'

&nbsp;             }`}

&nbsp;           >

&nbsp;             <div className="flex items-start justify-between mb-2">

&nbsp;               <div className="flex items-center gap-2">

&nbsp;                 {message.direction === 'outbound' ? (

&nbsp;                   <Send className="w-4 h-4 text-blue-600" />

&nbsp;                 ) : (

&nbsp;                   <Inbox className="w-4 h-4 text-gray-600" />

&nbsp;                 )}

&nbsp;                 <span className="font-medium text-gray-900">

&nbsp;                   {message.direction === 'outbound'

&nbsp;                     ? `To: ${formatPhoneNumber(message.to\_number)}`

&nbsp;                     : `From: ${formatPhoneNumber(message.from\_number)}`}

&nbsp;                 </span>

&nbsp;               </div>

&nbsp;               <div className="flex items-center gap-2">

&nbsp;                 {getStatusIcon(message.twilio\_status)}

&nbsp;                 <span className="text-sm text-gray-500">

&nbsp;                   {new Date(message.created\_at).toLocaleString()}

&nbsp;                 </span>

&nbsp;               </div>

&nbsp;             </div>



&nbsp;             {/\* Message Body \*/}

&nbsp;             <p className="text-gray-700 whitespace-pre-wrap">{message.body}</p>



&nbsp;             {/\* Related Lead/Contact \*/}

&nbsp;             {(message.lead\_first\_name || message.contact\_first\_name) \&\& (

&nbsp;               <div className="mt-2 text-sm text-gray-500">

&nbsp;                 Related to:{' '}

&nbsp;                 <span className="font-medium">

&nbsp;                   {message.lead\_first\_name

&nbsp;                     ? `${message.lead\_first\_name} ${message.lead\_last\_name || ''} (Lead)`

&nbsp;                     : `${message.contact\_first\_name} ${message.contact\_last\_name || ''} (Contact)`}

&nbsp;                 </span>

&nbsp;               </div>

&nbsp;             )}



&nbsp;             {/\* Sent by user \*/}

&nbsp;             {message.user\_first\_name \&\& (

&nbsp;               <div className="mt-1 text-sm text-gray-500">

&nbsp;                 Sent by: {message.user\_first\_name} {message.user\_last\_name}

&nbsp;               </div>

&nbsp;             )}



&nbsp;             {/\* Error \*/}

&nbsp;             {message.error\_message \&\& (

&nbsp;               <div className="mt-2 p-2 bg-red-100 text-red-700 text-sm rounded">

&nbsp;                 Error: {message.error\_message}

&nbsp;               </div>

&nbsp;             )}

&nbsp;           </div>

&nbsp;         ))}

&nbsp;       </div>

&nbsp;     )}



&nbsp;     {/\* Pagination \*/}

&nbsp;     {data?.pagination \&\& data.pagination.total > filters.limit \&\& (

&nbsp;       <div className="flex justify-center gap-2 mt-6">

&nbsp;         <button

&nbsp;           onClick={() => setFilters({ ...filters, offset: Math.max(0, filters.offset - filters.limit) })}

&nbsp;           disabled={filters.offset === 0}

&nbsp;           className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"

&nbsp;         >

&nbsp;           Previous

&nbsp;         </button>

&nbsp;         <button

&nbsp;           onClick={() => setFilters({ ...filters, offset: filters.offset + filters.limit })}

&nbsp;           disabled={filters.offset + filters.limit >= data.pagination.total}

&nbsp;           className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"

&nbsp;         >

&nbsp;           Next

&nbsp;         </button>

&nbsp;       </div>

&nbsp;     )}

&nbsp;   </div>

&nbsp; );

};



export default SMSHistoryList;

```



---



\### File: `frontend/src/components/TwilioConfigModal.jsx` (New File)



```jsx

import React, { useState } from 'react';

import { useMutation } from '@tantml:react-query';

import { X, Settings, ExternalLink } from 'lucide-react';

import { twilioAPI } from '../services/api';



const TwilioConfigModal = ({ onClose, onSuccess }) => {

&nbsp; const \[formData, setFormData] = useState({

&nbsp;   accountSid: '',

&nbsp;   authToken: '',

&nbsp;   phoneNumber: ''

&nbsp; });



&nbsp; const configMutation = useMutation({

&nbsp;   mutationFn: twilioAPI.configureAccount,

&nbsp;   onSuccess: () => {

&nbsp;     onSuccess();

&nbsp;     onClose();

&nbsp;   }

&nbsp; });



&nbsp; const handleSubmit = (e) => {

&nbsp;   e.preventDefault();

&nbsp;   configMutation.mutate(formData);

&nbsp; };



&nbsp; return (

&nbsp;   <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">

&nbsp;     <div className="bg-white rounded-lg max-w-2xl w-full">

&nbsp;       {/\* Header \*/}

&nbsp;       <div className="flex items-center justify-between p-6 border-b border-gray-200">

&nbsp;         <h2 className="text-xl font-semibold text-gray-900">Configure Twilio</h2>

&nbsp;         <button

&nbsp;           onClick={onClose}

&nbsp;           className="text-gray-400 hover:text-gray-600"

&nbsp;         >

&nbsp;           <X className="w-6 h-6" />

&nbsp;         </button>

&nbsp;       </div>



&nbsp;       {/\* Instructions \*/}

&nbsp;       <div className="p-6 bg-blue-50 border-b border-blue-100">

&nbsp;         <h3 className="font-medium text-blue-900 mb-2">Getting Started</h3>

&nbsp;         <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">

&nbsp;           <li>Sign up for a Twilio account at{' '}

&nbsp;             <a

&nbsp;               href="https://www.twilio.com/try-twilio"

&nbsp;               target="\_blank"

&nbsp;               rel="noopener noreferrer"

&nbsp;               className="underline hover:text-blue-900"

&nbsp;             >

&nbsp;               twilio.com

&nbsp;               <ExternalLink className="w-3 h-3 inline ml-1" />

&nbsp;             </a>

&nbsp;           </li>

&nbsp;           <li>Purchase a phone number from your Twilio console</li>

&nbsp;           <li>Copy your Account SID and Auth Token from the dashboard</li>

&nbsp;           <li>Configure the webhook URLs in Twilio console (instructions below)</li>

&nbsp;         </ol>

&nbsp;       </div>



&nbsp;       {/\* Form \*/}

&nbsp;       <form onSubmit={handleSubmit} className="p-6 space-y-4">

&nbsp;         <div>

&nbsp;           <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;             Account SID \*

&nbsp;           </label>

&nbsp;           <input

&nbsp;             type="text"

&nbsp;             value={formData.accountSid}

&nbsp;             onChange={(e) => setFormData({ ...formData, accountSid: e.target.value })}

&nbsp;             placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

&nbsp;             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

&nbsp;             required

&nbsp;           />

&nbsp;         </div>



&nbsp;         <div>

&nbsp;           <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;             Auth Token \*

&nbsp;           </label>

&nbsp;           <input

&nbsp;             type="password"

&nbsp;             value={formData.authToken}

&nbsp;             onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}

&nbsp;             placeholder="Your Auth Token"

&nbsp;             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

&nbsp;             required

&nbsp;           />

&nbsp;         </div>



&nbsp;         <div>

&nbsp;           <label className="block text-sm font-medium text-gray-700 mb-2">

&nbsp;             Twilio Phone Number \*

&nbsp;           </label>

&nbsp;           <input

&nbsp;             type="tel"

&nbsp;             value={formData.phoneNumber}

&nbsp;             onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}

&nbsp;             placeholder="+1234567890"

&nbsp;             className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"

&nbsp;             required

&nbsp;           />

&nbsp;           <p className="text-sm text-gray-500 mt-1">

&nbsp;             The phone number you purchased from Twilio (include country code)

&nbsp;           </p>

&nbsp;         </div>



&nbsp;         {/\* Webhook Instructions \*/}

&nbsp;         <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">

&nbsp;           <h4 className="font-medium text-yellow-900 mb-2">⚠️ Webhook Configuration Required</h4>

&nbsp;           <p className="text-sm text-yellow-800 mb-2">

&nbsp;             In your Twilio console, configure these webhooks for your phone number:

&nbsp;           </p>

&nbsp;           <div className="space-y-2 text-sm">

&nbsp;             <div>

&nbsp;               <p className="font-medium text-yellow-900">SMS Webhook:</p>

&nbsp;               <code className="bg-yellow-100 px-2 py-1 rounded text-xs">

&nbsp;                 {window.location.origin}/api/twilio/webhook/sms

&nbsp;               </code>

&nbsp;             </div>

&nbsp;             <div>

&nbsp;               <p className="font-medium text-yellow-900">Voice Webhook:</p>

&nbsp;               <code className="bg-yellow-100 px-2 py-1 rounded text-xs">

&nbsp;                 {window.location.origin}/api/twilio/webhook/voice

&nbsp;               </code>

&nbsp;             </div>

&nbsp;           </div>

&nbsp;         </div>



&nbsp;         {/\* Error \*/}

&nbsp;         {configMutation.isError \&\& (

&nbsp;           <div className="p-4 bg-red-50 border border-red-200 rounded-lg">

&nbsp;             <p className="text-sm text-red-600">

&nbsp;               {configMutation.error?.response?.data?.error || 'Failed to configure Twilio'}

&nbsp;             </p>

&nbsp;           </div>

&nbsp;         )}



&nbsp;         {/\* Actions \*/}

&nbsp;         <div className="flex gap-3 justify-end pt-4">

&nbsp;           <button

&nbsp;             type="button"

&nbsp;             onClick={onClose}

&nbsp;             className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"

&nbsp;           >

&nbsp;             Cancel

&nbsp;           </button>

&nbsp;           <button

&nbsp;             type="submit"

&nbsp;             disabled={configMutation.isPending}

&nbsp;             className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"

&nbsp;           >

&nbsp;             {configMutation.isPending ? (

&nbsp;               <>

&nbsp;                 <span className="inline-block animate-spin mr-2">⏳</span>

&nbsp;                 Verifying...

&nbsp;               </>

&nbsp;             ) : (

&nbsp;               <>

&nbsp;                 <Settings className="w-4 h-4 inline mr-2" />

&nbsp;                 Save Configuration

&nbsp;               </>

&nbsp;             )}

&nbsp;           </button>

&nbsp;         </div>

&nbsp;       </form>

&nbsp;     </div>

&nbsp;   </div>

&nbsp; );

};



export default TwilioConfigModal;

```



---



\### File: `frontend/src/services/api.js` (Add Twilio API methods)



Add this to your existing api.js file:



```javascript

// Twilio API

export const twilioAPI = {

&nbsp; // Configuration

&nbsp; configureAccount: (data) => api.post('/twilio/config', data),

&nbsp; getConfig: () => api.get('/twilio/config'),

&nbsp; 

&nbsp; // SMS

&nbsp; sendSMS: (data) => api.post('/twilio/sms/send', data),

&nbsp; getSMSHistory: (params) => api.get('/twilio/sms', { params }),

&nbsp; 

&nbsp; // Calls

&nbsp; makeCall: (data) => api.post('/twilio/call/make', data),

&nbsp; getCallHistory: (params) => api.get('/twilio/call', { params }),

&nbsp; 

&nbsp; // Templates

&nbsp; getTemplates: (params) => api.get('/twilio/templates', { params }),

&nbsp; createTemplate: (data) => api.post('/twilio/templates', data),

&nbsp; updateTemplate: (id, data) => api.put(`/twilio/templates/${id}`, data),

&nbsp; deleteTemplate: (id) => api.delete(`/twilio/templates/${id}`),

&nbsp; 

&nbsp; // Stats

&nbsp; getStats: () => api.get('/twilio/stats')

};

```



---



\### File: `frontend/src/App.jsx` (Add Communications route)



```jsx

import CommunicationsPage from './pages/CommunicationsPage';



// ... in your Routes:

<Route path="communications" element={<CommunicationsPage />} />

```



---



\### File: `frontend/src/components/DashboardLayout.jsx` (Add to navigation)



```jsx

import { MessageSquare } from 'lucide-react';



// Add to navigation array:

{

&nbsp; name: 'Communications',

&nbsp; href: '/communications',

&nbsp; icon: MessageSquare,

&nbsp; current: location.pathname === '/communications'

}

```



---



\## Phase 4: Add SMS/Call Actions to Leads Page



\### File: `frontend/src/pages/LeadsPage.jsx` (Enhance with SMS/Call buttons)



Add these imports and buttons to your existing LeadsPage:



```jsx

import { MessageSquare, Phone } from 'lucide-react';

import SendSMSModal from '../components/SendSMSModal';



// In your leads table, add action buttons:

<button

&nbsp; onClick={() => handleSendSMS(lead)}

&nbsp; className="text-blue-600 hover:text-blue-800"

&nbsp; title="Send SMS"

>

&nbsp; <MessageSquare className="w-4 h-4" />

</button>

<button

&nbsp; onClick={() => handleMakeCall(lead)}

&nbsp; className="text-green-600 hover:text-green-800"

&nbsp; title="Make Call"

>

&nbsp; <Phone className="w-4 h-4" />

</button>

```



---



\## Environment Variables



\### File: `.env` (Add these)



```env

\# Twilio Configuration (stored per-org in database, but webhook base URL needed)

API\_BASE\_URL=http://localhost:3000



\# For production

\# API\_BASE\_URL=https://your-domain.com

```



---



\## Testing Instructions



\### Step 1: Set up Twilio Account

1\. Go to https://www.twilio.com/try-twilio

2\. Sign up for a free account ($15 credit)

3\. Buy a phone number ($1/month)

4\. Copy your Account SID and Auth Token



\### Step 2: Run Migrations

```bash

npm run migrate

\# or manually:

psql -U your\_user -d uppal\_crm -f database/migrations/006-twilio-integration.sql

```



\### Step 3: Start Backend

```bash

npm run dev

```



\### Step 4: Start Frontend

```bash

cd frontend

npm run dev

```



\### Step 5: Configure Twilio in CRM

1\. Navigate to http://localhost:3002/communications

2\. Click "Configure Twilio"

3\. Enter your Account SID, Auth Token, and Phone Number

4\. Click "Save Configuration"



\### Step 6: Configure Webhooks in Twilio Console

1\. Go to Twilio Console → Phone Numbers

2\. Click on your phone number

3\. Under "Messaging", set Webhook to: `http://your-domain.com/api/twilio/webhook/sms`

4\. Under "Voice", set Webhook to: `http://your-domain.com/api/twilio/webhook/voice`

5\. For local testing, use ngrok: `ngrok http 3000`



\### Step 7: Test SMS

1\. Click "Send SMS" button

2\. Enter a phone number (use your own for testing)

3\. Type a message

4\. Click "Send"

5\. Check SMS history



\### Step 8: Test Incoming SMS

1\. Send an SMS to your Twilio number

2\. Check that it appears in CRM

3\. Verify a new lead was created if sender is unknown



---



\## Success Criteria



✅ Twilio configuration saves correctly

✅ Can send SMS messages to leads/contacts

✅ SMS history displays with proper formatting

✅ Incoming SMS creates new leads automatically

✅ SMS status updates from Twilio webhooks

✅ Phone calls can be initiated

✅ Call history tracks duration and outcome

✅ SMS templates work correctly

✅ Auto-responses trigger based on keywords/business hours

✅ Multi-tenant security prevents cross-org access

✅ UI is responsive and matches existing design

✅ All interactions are logged to lead\_interactions table



---



\## Additional Features to Consider (Future Enhancements)



1\. \*\*Bulk SMS Campaigns\*\* - Send SMS to multiple leads at once

2\. \*\*SMS Scheduling\*\* - Schedule messages for future delivery

3\. \*\*Two-Way SMS Conversations\*\* - Real-time chat interface

4\. \*\*Call Recording Playback\*\* - Play recordings in CRM

5\. \*\*Voice Transcription\*\* - Convert call recordings to text

6\. \*\*SMS Analytics\*\* - Delivery rates, response rates, etc.

7\. \*\*Template Variables\*\* - Dynamic content in templates ({{first\_name}}, etc.)

8\. \*\*Opt-out Management\*\* - STOP keyword handling

9\. \*\*Cost Tracking\*\* - Detailed cost breakdown per message/call

10\. \*\*Integration with Leads\*\* - Auto-send SMS when lead status changes



---



\## Security Notes



⚠️ \*\*IMPORTANT\*\*:

\- Twilio credentials (Auth Token) should be encrypted in production

\- Use environment variables for sensitive data

\- Validate all phone numbers before sending

\- Implement rate limiting for SMS sending

\- Add STOP keyword handling for compliance

\- Store webhooks with proper authentication

\- Never expose Twilio credentials in frontend code



---



\## Production Deployment Checklist



\- \[ ] Encrypt Twilio auth tokens in database

\- \[ ] Set up proper webhook URLs (not localhost)

\- \[ ] Configure Twilio webhook authentication

\- \[ ] Add rate limiting for SMS sending

\- \[ ] Implement STOP/UNSUBSCRIBE keyword handling

\- \[ ] Set up monitoring for failed messages

\- \[ ] Add cost alerts for high usage

\- \[ ] Test all webhooks in production

\- \[ ] Verify multi-tenant isolation

\- \[ ] Add logging for all Twilio operations



---



\## Run the Agent



Save this entire document as `agents/twilio-integration.md` and run:



```bash

claude code "Read the file agents/twilio-integration.md and implement the complete Twilio SMS and Voice integration system as specified. Follow all requirements exactly, including database migrations, backend routes, frontend components, and testing instructions."

```



The agent will build the complete Twilio integration system for your CRM!

