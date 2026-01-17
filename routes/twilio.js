const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/connection');
const Joi = require('joi');

// Validation schemas
const sendSMSSchema = Joi.object({
  to: Joi.string().required(),
  body: Joi.string().required().max(1600),
  leadId: Joi.string().uuid().optional().allow(null, ''),
  contactId: Joi.string().uuid().optional().allow(null, ''),
  templateId: Joi.string().uuid().optional().allow(null, '')
});

const makeCallSchema = Joi.object({
  to: Joi.string().required(),
  leadId: Joi.string().uuid().optional().allow(null, ''),
  contactId: Joi.string().uuid().optional().allow(null, '')
});

const twilioConfigSchema = Joi.object({
  accountSid: Joi.string().required(),
  authToken: Joi.string().required(),
  phoneNumber: Joi.string().required()
});

/**
 * Configure Twilio for organization
 */
router.post('/config', authenticateToken, async (req, res) => {
  try {
    const { error } = twilioConfigSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { accountSid, authToken, phoneNumber } = req.body;
    const organizationId = req.organizationId;
    const userId = req.userId;

    // Verify Twilio credentials by testing
    const twilio = require('twilio');
    const client = twilio(accountSid, authToken);

    try {
      await client.incomingPhoneNumbers.list({ limit: 1 });
    } catch (err) {
      return res.status(400).json({ error: 'Invalid Twilio credentials' });
    }

    const query = `
      INSERT INTO twilio_config (
        organization_id, account_sid, auth_token, phone_number,
        is_active, verified_at, created_by
      ) VALUES ($1, $2, $3, $4, true, NOW(), $5)
      ON CONFLICT (organization_id)
      DO UPDATE SET
        account_sid = EXCLUDED.account_sid,
        auth_token = EXCLUDED.auth_token,
        phone_number = EXCLUDED.phone_number,
        verified_at = NOW(),
        updated_at = NOW()
      RETURNING id, organization_id, phone_number, sms_enabled, voice_enabled, is_active
    `;

    const result = await db.query(query, [
      organizationId, accountSid, authToken, phoneNumber, userId
    ]);

    res.json({
      message: 'Twilio configured successfully',
      config: result.rows[0]
    });
  } catch (error) {
    console.error('Error configuring Twilio:', error);
    res.status(500).json({ error: 'Failed to configure Twilio' });
  }
});

/**
 * Get Twilio configuration
 */
router.get('/config', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;

    const query = `
      SELECT id, phone_number, sms_enabled, voice_enabled, is_active, verified_at
      FROM twilio_config
      WHERE organization_id = $1
    `;

    const result = await db.query(query, [organizationId]);

    if (result.rows.length === 0) {
      return res.json({ configured: false });
    }

    res.json({
      configured: true,
      config: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching Twilio config:', error);
    res.status(500).json({ error: 'Failed to fetch configuration' });
  }
});

/**
 * Send SMS
 */
router.post('/sms/send', authenticateToken, async (req, res) => {
  try {
    const { error } = sendSMSSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { to, body, leadId, contactId, templateId } = req.body;
    const organizationId = req.organizationId;
    const userId = req.userId;

    const message = await twilioService.sendSMS({
      organizationId,
      to,
      body,
      leadId,
      contactId,
      userId,
      templateId
    });

    res.json({
      message: 'SMS sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({ error: error.message || 'Failed to send SMS' });
  }
});

/**
 * Get SMS history
 */
router.get('/sms', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { leadId, contactId, direction, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        sm.*,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM sms_messages sm
      LEFT JOIN leads l ON sm.lead_id = l.id
      LEFT JOIN contacts c ON sm.contact_id = c.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE sm.organization_id = $1
    `;

    const params = [organizationId];
    let paramCount = 1;

    if (leadId) {
      paramCount++;
      query += ` AND sm.lead_id = $${paramCount}`;
      params.push(leadId);
    }

    if (contactId) {
      paramCount++;
      query += ` AND sm.contact_id = $${paramCount}`;
      params.push(contactId);
    }

    if (direction) {
      paramCount++;
      query += ` AND sm.direction = $${paramCount}`;
      params.push(direction);
    }

    query += ` ORDER BY sm.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM sms_messages WHERE organization_id = $1';
    const countParams = [organizationId];

    if (leadId) countQuery += ` AND lead_id = $${countParams.push(leadId)}`;
    if (contactId) countQuery += ` AND contact_id = $${countParams.push(contactId)}`;
    if (direction) countQuery += ` AND direction = $${countParams.push(direction)}`;

    const countResult = await db.query(countQuery, countParams);

    res.json({
      messages: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching SMS history:', error);
    res.status(500).json({ error: 'Failed to fetch SMS history' });
  }
});

/**
 * Get SMS conversations (grouped by phone number)
 */
router.get('/sms/conversations', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;

    const query = `
      WITH conversation_stats AS (
        SELECT
          CASE
            WHEN direction = 'outbound' THEN to_number
            ELSE from_number
          END as phone_number,
          MAX(created_at) as last_message_at,
          COUNT(*) as message_count,
          COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_count,
          COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_count
        FROM sms_messages
        WHERE organization_id = $1
        GROUP BY CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
      ),
      last_messages AS (
        SELECT DISTINCT ON (
          CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
        )
          CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number,
          body as last_message,
          direction as last_direction,
          lead_id,
          contact_id
        FROM sms_messages
        WHERE organization_id = $1
        ORDER BY
          CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END,
          created_at DESC
      )
      SELECT
        cs.phone_number,
        cs.last_message_at,
        cs.message_count,
        cs.inbound_count,
        cs.outbound_count,
        lm.last_message,
        lm.last_direction,
        lm.lead_id,
        lm.contact_id,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name
      FROM conversation_stats cs
      JOIN last_messages lm ON cs.phone_number = lm.phone_number
      LEFT JOIN leads l ON lm.lead_id = l.id
      LEFT JOIN contacts c ON lm.contact_id = c.id
      ORDER BY cs.last_message_at DESC
    `;

    const result = await db.query(query, [organizationId]);

    res.json({
      conversations: result.rows.map(row => ({
        phoneNumber: row.phone_number,
        lastMessageAt: row.last_message_at,
        messageCount: parseInt(row.message_count),
        inboundCount: parseInt(row.inbound_count),
        outboundCount: parseInt(row.outbound_count),
        lastMessage: row.last_message,
        lastDirection: row.last_direction,
        leadId: row.lead_id,
        contactId: row.contact_id,
        contactName: row.contact_first_name
          ? `${row.contact_first_name} ${row.contact_last_name || ''}`.trim()
          : row.lead_first_name
            ? `${row.lead_first_name} ${row.lead_last_name || ''}`.trim()
            : null
      }))
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

/**
 * Get messages for a specific conversation (by phone number)
 */
router.get('/sms/conversation/:phoneNumber', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { phoneNumber } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const query = `
      SELECT
        sm.*,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM sms_messages sm
      LEFT JOIN leads l ON sm.lead_id = l.id
      LEFT JOIN contacts c ON sm.contact_id = c.id
      LEFT JOIN users u ON sm.user_id = u.id
      WHERE sm.organization_id = $1
        AND (sm.to_number = $2 OR sm.from_number = $2)
      ORDER BY sm.created_at ASC
      LIMIT $3 OFFSET $4
    `;

    const result = await db.query(query, [organizationId, phoneNumber, limit, offset]);

    // Get contact/lead info for this conversation
    let contactInfo = null;
    if (result.rows.length > 0) {
      const firstMsg = result.rows[0];
      if (firstMsg.contact_first_name) {
        contactInfo = {
          type: 'contact',
          id: firstMsg.contact_id,
          name: `${firstMsg.contact_first_name} ${firstMsg.contact_last_name || ''}`.trim()
        };
      } else if (firstMsg.lead_first_name) {
        contactInfo = {
          type: 'lead',
          id: firstMsg.lead_id,
          name: `${firstMsg.lead_first_name} ${firstMsg.lead_last_name || ''}`.trim()
        };
      }
    }

    res.json({
      phoneNumber,
      contactInfo,
      messages: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

/**
 * Make phone call
 */
router.post('/call/make', authenticateToken, async (req, res) => {
  try {
    const { error } = makeCallSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { to, leadId, contactId } = req.body;
    const organizationId = req.organizationId;
    const userId = req.userId;

    const call = await twilioService.makeCall({
      organizationId,
      to,
      leadId,
      contactId,
      userId
    });

    res.json({
      message: 'Call initiated successfully',
      data: call
    });
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ error: error.message || 'Failed to initiate call' });
  }
});

/**
 * Get call history
 */
router.get('/call', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { leadId, contactId, direction, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        pc.*,
        l.first_name as lead_first_name,
        l.last_name as lead_last_name,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        u.first_name as user_first_name,
        u.last_name as user_last_name
      FROM phone_calls pc
      LEFT JOIN leads l ON pc.lead_id = l.id
      LEFT JOIN contacts c ON pc.contact_id = c.id
      LEFT JOIN users u ON pc.user_id = u.id
      WHERE pc.organization_id = $1
    `;

    const params = [organizationId];
    let paramCount = 1;

    if (leadId) {
      paramCount++;
      query += ` AND pc.lead_id = $${paramCount}`;
      params.push(leadId);
    }

    if (contactId) {
      paramCount++;
      query += ` AND pc.contact_id = $${paramCount}`;
      params.push(contactId);
    }

    if (direction) {
      paramCount++;
      query += ` AND pc.direction = $${paramCount}`;
      params.push(direction);
    }

    query += ` ORDER BY pc.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      calls: result.rows,
      pagination: {
        total: result.rows.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

/**
 * SMS Templates - List all
 */
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { category } = req.query;

    let query = `
      SELECT * FROM sms_templates
      WHERE organization_id = $1 AND is_active = true
    `;

    const params = [organizationId];

    if (category) {
      query += ` AND category = $2`;
      params.push(category);
    }

    query += ` ORDER BY name ASC`;

    const result = await db.query(query, params);

    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

/**
 * SMS Templates - Create
 */
router.post('/templates', authenticateToken, async (req, res) => {
  try {
    const { name, category, body } = req.body;
    const organizationId = req.organizationId;
    const userId = req.userId;

    const query = `
      INSERT INTO sms_templates (organization_id, name, category, body, created_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(query, [organizationId, name, category, body, userId]);

    res.json({
      message: 'Template created successfully',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

/**
 * SMS Templates - Update
 */
router.put('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, body, is_active } = req.body;
    const organizationId = req.organizationId;

    const query = `
      UPDATE sms_templates
      SET name = COALESCE($1, name),
          category = COALESCE($2, category),
          body = COALESCE($3, body),
          is_active = COALESCE($4, is_active),
          updated_at = NOW()
      WHERE id = $5 AND organization_id = $6
      RETURNING *
    `;

    const result = await db.query(query, [name, category, body, is_active, id, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({
      message: 'Template updated successfully',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

/**
 * SMS Templates - Delete
 */
router.delete('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const organizationId = req.organizationId;

    const query = `
      DELETE FROM sms_templates
      WHERE id = $1 AND organization_id = $2
      RETURNING id
    `;

    const result = await db.query(query, [id, organizationId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * Twilio Webhooks - Incoming SMS
 */
router.post('/webhook/sms', async (req, res) => {
  try {
    await twilioService.processIncomingSMS(req.body);

    // Respond with TwiML (required by Twilio)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('Error processing incoming SMS:', error);
    res.status(500).send('Error processing SMS');
  }
});

/**
 * Twilio Webhooks - SMS Status Updates
 */
router.post('/webhook/sms-status', async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;

    await twilioService.updateSMSStatus(
      MessageSid,
      MessageStatus,
      ErrorCode ? parseInt(ErrorCode) : null,
      ErrorMessage
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error updating SMS status:', error);
    res.status(500).send('Error');
  }
});

/**
 * Twilio Webhooks - Voice (TwiML for incoming calls)
 */
router.post('/webhook/voice', async (req, res) => {
  try {
    const { From, To, CallSid, Direction, CallStatus } = req.body;

    console.log('Voice webhook call - Full request body:', req.body);
    console.log('Voice webhook call:', { From, To, CallSid, Direction, CallStatus });

    // Find organization by Twilio phone number to check if this is an incoming call
    const orgQuery = `
      SELECT organization_id FROM twilio_config
      WHERE phone_number = $1
         OR phone_number = $2
         OR REPLACE(REPLACE(phone_number, '-', ''), ' ', '') = $3
    `;
    const normalizedTo = To.replace(/[^\d+]/g, '');
    const orgResult = await db.query(orgQuery, [To, normalizedTo, normalizedTo]);

    // If To number is NOT our Twilio number, this is an OUTBOUND call
    const isIncomingCall = orgResult.rows.length > 0;
    const isOutboundCall = !isIncomingCall;

    console.log(`Call direction detected: ${isOutboundCall ? 'OUTBOUND' : 'INCOMING'} (isIncoming=${isIncomingCall})`);

    // For OUTBOUND calls (agent calling customer), record both channels for two-way audio
    if (isOutboundCall) {
      console.log('Outbound call detected - recording two-way audio');
      // numChannels="2" records both caller and callee, keeps connection open for conversation
      // maxLength="3600" allows up to 1 hour conversation
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record numChannels="2" maxLength="3600" recordingStatusCallback="https://uppalcrm-api.onrender.com/api/twilio/webhook/recording"/>
</Response>`;
      res.type('text/xml');
      res.send(twiml);
      return;
    }

    // INCOMING CALL HANDLING (customer calling the company number)
    const organizationId = orgResult.rows[0].organization_id;

    // Check if caller is a known lead or contact
    const contactQuery = `
      SELECT 'lead' as type, id, first_name, last_name FROM leads
      WHERE organization_id = $1 AND phone = $2
      UNION ALL
      SELECT 'contact' as type, id, first_name, last_name FROM contacts
      WHERE organization_id = $1 AND phone = $2
      LIMIT 1
    `;
    const contactResult = await db.query(contactQuery, [organizationId, From]);
    const contactInfo = contactResult.rows[0] || null;

    // Save incoming call to database
    const insertQuery = `
      INSERT INTO phone_calls (
        organization_id, lead_id, contact_id,
        direction, from_number, to_number,
        twilio_call_sid, twilio_status, started_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ringing', NOW())
      RETURNING *
    `;

    await db.query(insertQuery, [
      organizationId,
      contactInfo?.type === 'lead' ? contactInfo.id : null,
      contactInfo?.type === 'contact' ? contactInfo.id : null,
      'inbound',
      From,
      To,
      CallSid
    ]);

    // Cache organization for this call (for webhook callbacks)
    if (!global.callOrganizations) {
      global.callOrganizations = {};
    }
    global.callOrganizations[CallSid] = organizationId;

    // Auto-expire cache after 4 hours
    setTimeout(() => {
      delete global.callOrganizations[CallSid];
    }, 4 * 60 * 60 * 1000);

    // Store pending incoming call for frontend notification
    const cacheKey = `incoming_call:${organizationId}`;
    if (!global.incomingCalls) {
      global.incomingCalls = {};
    }
    global.incomingCalls[cacheKey] = {
      callSid: CallSid,
      from: From,
      to: To,
      callerName: contactInfo ? `${contactInfo.first_name || ''} ${contactInfo.last_name || ''}`.trim() : null,
      timestamp: new Date().toISOString()
    };

    // Clear after 30 seconds if not answered
    setTimeout(() => {
      if (global.incomingCalls && global.incomingCalls[cacheKey]?.callSid === CallSid) {
        delete global.incomingCalls[cacheKey];
      }
    }, 30000);

    // Return TwiML to handle the call - Voicemail recording system
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. We are unable to take your call at the moment. Please leave a message after the beep, and we will get back to you as soon as possible.</Say>
  <Record
    maxLength="60"
    playBeep="true"
    recordingStatusCallback="https://uppalcrm-api.onrender.com/api/twilio/webhook/recording"
    recordingStatusCallbackEvent="completed"
  />
  <Say voice="alice">Thank you for your message. Goodbye.</Say>
  <Hangup />
</Response>`;

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error handling voice webhook:', error);
    // Return a basic TwiML response even on error
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say>We're sorry, but we cannot take your call at this time.</Say>
        <Hangup />
      </Response>`);
  }
});

/**
 * Get pending incoming calls (for frontend polling)
 */
router.get('/incoming-calls/pending', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const cacheKey = `incoming_call:${organizationId}`;

    const incomingCall = global.incomingCalls?.[cacheKey] || null;

    res.json({ incomingCall });
  } catch (error) {
    console.error('Error getting pending calls:', error);
    res.status(500).json({ error: 'Failed to get pending calls' });
  }
});

/**
 * Clear pending incoming call (when answered/declined)
 */
router.post('/incoming-calls/clear', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const cacheKey = `incoming_call:${organizationId}`;

    if (global.incomingCalls) {
      delete global.incomingCalls[cacheKey];
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing pending call:', error);
    res.status(500).json({ error: 'Failed to clear pending call' });
  }
});

/**
 * Twilio Webhooks - Recording Callback
 */
router.post('/webhook/recording', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

    console.log('Recording completed:', { CallSid, RecordingSid, RecordingDuration });

    // Get organization context from cache
    if (!global.callOrganizations) {
      global.callOrganizations = {};
    }
    const organizationId = global.callOrganizations[CallSid];

    if (!organizationId) {
      console.warn(`Organization not found for call ${CallSid} - cache may have expired`);
      res.status(200).send('OK'); // Still return OK to prevent Twilio from retrying
      return;
    }

    // Update the phone call record with recording information
    const updateQuery = `
      UPDATE phone_calls
      SET
        recording_url = $1,
        duration_seconds = $2,
        has_recording = true,
        updated_at = NOW()
      WHERE twilio_call_sid = $3
    `;

    await db.query(updateQuery, [
      RecordingUrl,
      RecordingDuration ? parseInt(RecordingDuration) : null,
      CallSid
    ], organizationId);

    console.log('Recording saved to database for CallSid:', CallSid);

    res.status(200).send('OK');
  } catch (error) {
    // IMPORTANT: Always return 200 OK for webhooks, even on error
    // Returning 5xx causes Twilio to retry infinitely
    console.error('Error handling recording callback:', { error: error.message, stack: error.stack });
    res.status(200).send('OK');
  }
});

/**
 * Twilio Webhooks - Transcription Callback
 */
router.post('/webhook/transcription', async (req, res) => {
  try {
    const { CallSid, TranscriptionText, TranscriptionStatus } = req.body;

    console.log('Transcription completed:', { CallSid, TranscriptionStatus });

    if (TranscriptionStatus === 'completed' && TranscriptionText) {
      // Get organization context from cache
      if (!global.callOrganizations) {
        global.callOrganizations = {};
      }
      const organizationId = global.callOrganizations[CallSid];

      if (!organizationId) {
        console.warn(`Organization not found for call ${CallSid} - cache may have expired`);
        res.status(200).send('OK'); // Still return OK to prevent Twilio from retrying
        return;
      }

      // Update the phone call record with transcription
      const updateQuery = `
        UPDATE phone_calls
        SET
          notes = COALESCE(notes || E'\\n\\n', '') || 'Voicemail Transcription: ' || $1,
          updated_at = NOW()
        WHERE twilio_call_sid = $2
      `;

      await db.query(updateQuery, [TranscriptionText, CallSid], organizationId);

      console.log('Transcription saved to database for CallSid:', CallSid);
    }

    res.status(200).send('OK');
  } catch (error) {
    // IMPORTANT: Always return 200 OK for webhooks, even on error
    // Returning 5xx causes Twilio to retry infinitely
    console.error('Error handling transcription callback:', { error: error.message, stack: error.stack });
    res.status(200).send('OK');
  }
});

/**
 * Twilio Webhooks - Call Status Updates
 */
router.post('/webhook/call-status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

    console.log('Call status webhook received:', { CallSid, CallStatus, CallDuration });

    // Get organization context from cache
    if (!global.callOrganizations) {
      global.callOrganizations = {};
    }
    const organizationId = global.callOrganizations[CallSid];

    if (!organizationId) {
      console.warn(`Organization not found for call ${CallSid} - cache may have expired`);
      res.status(200).send('OK'); // Still return OK to prevent Twilio from retrying
      return;
    }

    await twilioService.updateCallStatus(
      CallSid,
      CallStatus,
      CallDuration ? parseInt(CallDuration) : null,
      RecordingUrl,
      organizationId
    );

    console.log('Call status updated successfully:', { CallSid, CallStatus });
    res.status(200).send('OK');
  } catch (error) {
    // IMPORTANT: Always return 200 OK for webhooks, even on error
    // Returning 5xx causes Twilio to retry infinitely
    console.error('Error updating call status:', { error: error.message, stack: error.stack });
    res.status(200).send('OK');
  }
});

/**
 * Twilio Webhooks - Gather Response (when caller presses a key or timeout)
 */
router.post('/webhook/gather-response', async (req, res) => {
  try {
    const { CallSid, Digits } = req.body;

    console.log('Gather response received:', { CallSid, Digits });

    // If timeout (no digits pressed), loop back and continue holding
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="0" timeout="3600" action="https://uppalcrm-api.onrender.com/api/twilio/webhook/gather-response">
    <Pause length="3600"/>
  </Gather>
</Response>`;

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error handling gather response:', { error: error.message });
    res.status(200).send('OK');
  }
});

/**
 * Twilio Webhooks - Conference Status (for outbound calls)
 */
router.post('/webhook/conference-status', async (req, res) => {
  try {
    const { ConferenceSid, StatusCallbackEvent, FriendlyName } = req.body;

    console.log('Conference status event:', { ConferenceSid, StatusCallbackEvent, FriendlyName });

    // FriendlyName contains the CallSid in our setup
    const CallSid = FriendlyName;

    // Get organization context from cache
    if (!global.callOrganizations) {
      global.callOrganizations = {};
    }
    const organizationId = global.callOrganizations[CallSid];

    if (!organizationId) {
      console.warn(`Organization not found for conference ${CallSid}`);
      res.status(200).send('OK');
      return;
    }

    // Log conference events but don't need to store them separately
    // The call status webhook will handle the final call status
    console.log(`Conference event processed: ${StatusCallbackEvent}`);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling conference status:', { error: error.message });
    res.status(200).send('OK');
  }
});

/**
 * Get SMS/Call Statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;

    // SMS stats
    const smsQuery = `
      SELECT
        COUNT(*) as total_sms,
        COUNT(*) FILTER (WHERE direction = 'outbound') as sent,
        COUNT(*) FILTER (WHERE direction = 'inbound') as received,
        COUNT(*) FILTER (WHERE twilio_status = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE twilio_status = 'failed') as failed,
        SUM(cost) as total_sms_cost
      FROM sms_messages
      WHERE organization_id = $1
    `;

    const smsResult = await db.query(smsQuery, [organizationId]);

    // Call stats
    const callQuery = `
      SELECT
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
        COUNT(*) FILTER (WHERE outcome = 'answered') as answered,
        SUM(duration_seconds) as total_duration,
        SUM(cost) as total_call_cost
      FROM phone_calls
      WHERE organization_id = $1
    `;

    const callResult = await db.query(callQuery, [organizationId]);

    res.json({
      sms: smsResult.rows[0],
      calls: callResult.rows[0]
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
