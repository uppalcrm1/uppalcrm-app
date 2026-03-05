const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilioService');
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/connection');
const Joi = require('joi');

// Fallback to production URL if API_BASE_URL not set
const API_BASE_URL = process.env.API_BASE_URL || 'https://uppalcrm-api.onrender.com';

// Validation schemas
const sendSMSSchema = Joi.object({
  to: Joi.string().required(),
  body: Joi.string().required().max(1600),
  leadId: Joi.string().uuid().optional().allow(null, ''),
  contactId: Joi.string().uuid().optional().allow(null, ''),
  templateId: Joi.string().uuid().optional().allow(null, '')
});

const sendWhatsAppSchema = Joi.object({
  to_number: Joi.string().required(),
  message: Joi.string().required().max(4096),
  lead_id: Joi.string().uuid().optional().allow(null, ''),
  contact_id: Joi.string().uuid().optional().allow(null, '')
});

const makeCallSchema = Joi.object({
  to: Joi.string().required(),
  leadId: Joi.string().uuid().optional().allow(null, ''),
  contactId: Joi.string().uuid().optional().allow(null, ''),
  conferenceId: Joi.string().optional().allow(null, '')
});

const twilioConfigSchema = Joi.object({
  accountSid: Joi.string().required(),
  authToken: Joi.string().required(),
  phoneNumber: Joi.string().required()
});

/**
 * Generate Twilio Access Token for frontend (voice/video calls)
 */
router.post('/token', authenticateToken, async (req, res) => {
  try {
    const twilio = require('twilio');
    const organizationId = req.organizationId;
    const userId = req.userId;

    // Verify required environment variables
    const apiKey = process.env.TWILIO_API_KEY;
    const apiSecret = process.env.TWILIO_API_SECRET;
    const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

    if (!apiKey || !apiSecret) {
      console.error('Missing Twilio API credentials in environment variables');
      return res.status(500).json({
        error: 'Twilio API credentials not configured',
        message: 'TWILIO_API_KEY and TWILIO_API_SECRET must be set in environment'
      });
    }

    // Get Twilio configuration
    const configQuery = `
      SELECT account_sid, auth_token, phone_number
      FROM twilio_config
      WHERE organization_id = $1 AND is_active = true
    `;

    const configResult = await db.query(configQuery, [organizationId]);

    if (configResult.rows.length === 0) {
      return res.status(400).json({ error: 'Twilio not configured for this organization' });
    }

    const config = configResult.rows[0];
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Generate a unique identity for this user (agent-{userId} format for client dialing)
    const identity = `agent-${userId}`;

    // Create access token with identity in constructor
    const token = new AccessToken(
      config.account_sid,
      apiKey,
      apiSecret,
      { identity }
    );

    token.addGrant(new VoiceGrant({
      outgoingApplicationSid: twimlAppSid || undefined,
      incomingAllow: true  // Allow incoming calls to this client identity
    }));

    res.json({
      token: token.toJwt(),
      identity,
      phoneNumber: config.phone_number
    });
  } catch (error) {
    console.error('Error generating Twilio token:', error);
    res.status(500).json({
      error: 'Failed to generate access token',
      message: error.message
    });
  }
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
      SELECT id, phone_number, sms_enabled, voice_enabled, is_active, verified_at, whatsapp_enabled, whatsapp_number
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
 * Send WhatsApp message
 */
router.post('/whatsapp/send', authenticateToken, async (req, res) => {
  try {
    const { error } = sendWhatsAppSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { to_number, message, lead_id, contact_id } = req.body;
    const organizationId = req.organizationId;
    const userId = req.userId;

    const whatsappMessage = await twilioService.sendWhatsApp({
      organizationId,
      toNumber: to_number,
      body: message,
      leadId: lead_id,
      contactId: contact_id,
      userId
    });

    res.json({
      message: 'WhatsApp message sent successfully',
      data: whatsappMessage
    });
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    res.status(500).json({ error: error.message || 'Failed to send WhatsApp message' });
  }
});

/**
 * Get SMS/WhatsApp history (with channel filtering)
 */
router.get('/sms', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { leadId, contactId, direction, channel = 'all', limit = 50, offset = 0 } = req.query;

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

    // Add channel filter (default: all)
    if (channel && channel !== 'all') {
      paramCount++;
      query += ` AND sm.channel = $${paramCount}`;
      params.push(channel);
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
    if (channel && channel !== 'all') countQuery += ` AND channel = $${countParams.push(channel)}`;

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
    console.error('Error fetching SMS/WhatsApp history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

/**
 * Get SMS/WhatsApp conversations (grouped by phone number, includes all channels)
 */
router.get('/sms/conversations', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { channel = 'all' } = req.query;

    // First, check if sms_messages table has any records for this organization
    let countQuery = 'SELECT COUNT(*) FROM sms_messages WHERE organization_id = $1';
    const countParams = [organizationId];

    // Add channel filter if specified
    if (channel && channel !== 'all') {
      countQuery += ` AND channel = $2`;
      countParams.push(channel);
    }

    const countResult = await db.query(countQuery, countParams);

    // If no messages exist, return empty array immediately (avoids empty JOIN issues)
    if (parseInt(countResult.rows[0].count) === 0) {
      return res.json({ conversations: [] });
    }

    // Build WHERE clause for channel filtering
    const channelFilter = channel && channel !== 'all' ? `AND channel = $2` : '';
    const queryParams = [organizationId];
    if (channel && channel !== 'all') {
      queryParams.push(channel);
    }

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
          COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_count,
          COUNT(*) FILTER (WHERE channel = 'sms') as sms_count,
          COUNT(*) FILTER (WHERE channel = 'whatsapp') as whatsapp_count
        FROM sms_messages
        WHERE organization_id = $1 ${channelFilter}
        GROUP BY CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
      ),
      last_messages AS (
        SELECT DISTINCT ON (
          CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
        )
          CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number,
          body as last_message,
          direction as last_direction,
          channel as last_channel,
          lead_id,
          contact_id
        FROM sms_messages
        WHERE organization_id = $1 ${channelFilter}
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
        cs.sms_count,
        cs.whatsapp_count,
        lm.last_message,
        lm.last_direction,
        lm.last_channel,
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

    const result = await db.query(query, queryParams);

    res.json({
      conversations: result.rows.map(row => ({
        phoneNumber: row.phone_number,
        lastMessageAt: row.last_message_at,
        messageCount: parseInt(row.message_count),
        inboundCount: parseInt(row.inbound_count),
        outboundCount: parseInt(row.outbound_count),
        smsCount: parseInt(row.sms_count),
        whatsappCount: parseInt(row.whatsapp_count),
        lastMessage: row.last_message,
        lastDirection: row.last_direction,
        lastChannel: row.last_channel || 'sms', // Default to sms if null (backward compatibility)
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
    // Return empty array instead of error, as this is expected when no messages exist
    res.json({ conversations: [] });
  }
});

/**
 * Get messages for a specific conversation (by phone number, with channel filtering)
 */
router.get('/sms/conversation/:phoneNumber', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { phoneNumber } = req.params;
    const { channel = 'all', limit = 100, offset = 0 } = req.query;

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
        AND (sm.to_number = $2 OR sm.from_number = $2)
    `;

    const params = [organizationId, phoneNumber];

    // Add channel filter (default: all)
    if (channel && channel !== 'all') {
      query += ` AND sm.channel = $3`;
      params.push(channel);
    }

    query += ` ORDER BY sm.created_at ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

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

    // Calculate channel breakdown for this conversation
    const statsQuery = `
      SELECT
        COUNT(*) as total_count,
        COUNT(*) FILTER (WHERE channel = 'sms') as sms_count,
        COUNT(*) FILTER (WHERE channel = 'whatsapp') as whatsapp_count
      FROM sms_messages
      WHERE organization_id = $1
        AND (to_number = $2 OR from_number = $2)
    `;
    const statsResult = await db.query(statsQuery, [organizationId, phoneNumber]);
    const stats = statsResult.rows[0];

    res.json({
      phoneNumber,
      contactInfo,
      channelFilter: channel,
      stats: {
        totalMessages: parseInt(stats.total_count),
        smsCount: parseInt(stats.sms_count),
        whatsappCount: parseInt(stats.whatsapp_count)
      },
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
    console.log('📞 Incoming call request:', {
      body: req.body,
      organizationId: req.organizationId,
      userId: req.userId
    });

    const { error } = makeCallSchema.validate(req.body);
    if (error) {
      console.error('❌ Validation error:', error.details);
      return res.status(400).json({
        error: error.details[0].message,
        details: error.details,
        received: req.body
      });
    }

    const { to, leadId, contactId, conferenceId } = req.body;
    const organizationId = req.organizationId;
    const userId = req.userId;

    // Validate that organization has Twilio configured
    const configResult = await db.query(
      'SELECT * FROM twilio_config WHERE organization_id = $1 AND is_active = true',
      [organizationId]
    );

    if (configResult.rows.length === 0) {
      return res.status(400).json({
        error: 'Twilio is not configured for this organization'
      });
    }

    const call = await twilioService.makeCall({
      organizationId,
      to,
      leadId,
      contactId,
      userId,
      conferenceId
    });

    console.log('✅ Call initiated successfully:', call.id);

    res.json({
      message: 'Call initiated successfully',
      data: call
    });
  } catch (error) {
    console.error('❌ Error making call:', error);
    res.status(500).json({
      error: error.message || 'Failed to initiate call',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
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
    const result = await twilioService.processIncomingSMS(req.body);

    // Emit real-time SMS notification via WebSocket
    if (result && result.organizationId) {
      const websocketService = require('../services/websocketService');
      websocketService.emitIncomingSMS(result.organizationId, {
        messageSid: req.body.MessageSid,
        from: req.body.From,
        to: req.body.To,
        body: req.body.Body,
        contactName: result.contactName || null,
        leadId: result.leadId || null,
        contactId: result.contactId || null
      });
    }

    // Respond with TwiML (required by Twilio)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('Error processing incoming SMS:', error);
    res.status(500).send('Error processing SMS');
  }
});

/**
 * Twilio Webhooks - Incoming WhatsApp
 */
router.post('/webhook/whatsapp', async (req, res) => {
  try {
    const result = await twilioService.processIncomingWhatsApp(req.body);

    // Emit real-time WhatsApp notification via WebSocket
    if (result && result.organizationId) {
      const websocketService = require('../services/websocketService');
      websocketService.emitIncomingSMS(result.organizationId, {
        messageSid: req.body.MessageSid,
        from: req.body.From.replace(/^whatsapp:/, ''),
        to: req.body.To.replace(/^whatsapp:/, ''),
        body: req.body.Body,
        channel: 'whatsapp',
        contactName: result.contactName || null,
        leadId: result.leadId || null,
        contactId: result.contactId || null
      });
    }

    // Respond with TwiML (required by Twilio)
    res.type('text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    console.error('Error processing incoming WhatsApp:', error);
    res.status(500).send('Error processing WhatsApp');
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
 * Twilio Webhooks - WhatsApp Status Updates
 */
router.post('/webhook/whatsapp-status', async (req, res) => {
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
    console.error('Error updating WhatsApp status:', error);
    res.status(500).send('Error');
  }
});

/**
 * Twilio Webhooks - Voice (TwiML for incoming and outbound calls)
 */
router.post('/webhook/voice', async (req, res) => {
  try {
    const { From, To, CallSid, Direction } = req.body;
    // Conference params can come from either query (REST API) or body (Voice SDK)
    const conference = req.query.conference || req.body.conference;
    const participant = req.query.participant || req.body.participant;

    console.log('Voice webhook call:', { From, To, CallSid, Direction, conference, participant });

    // === HANDLE CONFERENCE CALLS (Voice SDK for agents) ===
    if (conference && participant) {
      if (participant === 'agent') {
        console.log(`Agent joining conference: ${conference}`);

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
      record="record-from-start"
      recordingStatusCallback="${API_BASE_URL}/api/twilio/webhook/recording"
      statusCallback="${API_BASE_URL}/api/twilio/webhook/conference-status"
      statusCallbackEvent="start end join leave"
    >${conference}</Conference>
  </Dial>
</Response>`;
        res.type('text/xml');
        res.send(twiml);
        return;
      }

      if (participant === 'customer') {
        console.log(`Customer joining conference: ${conference}`);

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      startConferenceOnEnter="false"
      endConferenceOnExit="true"
      beep="false"
      record="record-from-start"
      recordingStatusCallback="${API_BASE_URL}/api/twilio/webhook/recording"
      statusCallback="${API_BASE_URL}/api/twilio/webhook/conference-status"
      statusCallbackEvent="start end join leave"
    >${conference}</Conference>
  </Dial>
</Response>`;
        res.type('text/xml');
        res.send(twiml);
        return;
      }
    }

    // === OUTBOUND CALLS (REST API dials customer) ===
    if (Direction === 'outbound' || Direction === 'outbound-api') {
      console.log('✅ Customer answered outbound call - putting in queue');

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Please hold while we connect you to an agent.</Say>
  <Enqueue
    waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
    maxQueueWait="60"
    action="${API_BASE_URL}/api/twilio/webhook/queue-result"
    method="POST"
  >support_queue</Enqueue>
</Response>`;
      res.type('text/xml');
      res.send(twiml);
      return;
    }

    // === INCOMING CALLS (customer calling company number) ===
    // Find organization by Twilio phone number
    const orgQuery = `
      SELECT organization_id FROM twilio_config
      WHERE phone_number = $1
         OR phone_number = $2
         OR REPLACE(REPLACE(phone_number, '-', ''), ' ', '') = $3
    `;
    const normalizedTo = To.replace(/[^\d+]/g, '');
    const orgResult = await db.query(orgQuery, [To, normalizedTo, normalizedTo]);

    if (orgResult.rows.length > 0) {
      const organizationId = orgResult.rows[0].organization_id;
      const { client, phoneNumber } = await twilioService.getClient(organizationId);

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

      // Generate unique conference ID for this incoming call
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const conferenceId = `conf-incoming-${timestamp}-${random}`;

      // Store incoming call in database
      try {
        const insertIncomingCallQuery = `
          INSERT INTO incoming_calls (
            organization_id, call_sid, from_number, to_number, status, conference_id
          ) VALUES ($1, $2, $3, $4, 'ringing', $5)
          ON CONFLICT (call_sid) DO UPDATE SET status = 'ringing', conference_id = $5, updated_at = NOW()
          RETURNING *
        `;

        await db.query(insertIncomingCallQuery, [
          organizationId,
          CallSid,
          From,
          To,
          conferenceId
        ]);

        console.log(`✅ Stored incoming call ${CallSid} with conference ${conferenceId}`);
      } catch (dbError) {
        console.error(`❌ Error storing incoming call in database: ${dbError.message}`);
        // Continue with the call even if database storage fails
      }

      // STEP 1: Put customer into conference with hold music
      const customerTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thank you for calling. Please hold while we connect you to an agent.</Say>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      beep="false"
      waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
      record="record-from-start"
      recordingStatusCallback="${API_BASE_URL}/api/twilio/webhook/recording"
      statusCallback="${API_BASE_URL}/api/twilio/webhook/conference-status"
      statusCallbackEvent="start end join leave"
    >${conferenceId}</Conference>
  </Dial>
</Response>`;

      res.type('text/xml');
      res.send(customerTwiml);

      // STEP 2: Ring all active agents via REST API (after responding to Twilio)
      // Only ring agents with active sessions to avoid unnecessary calls
      setTimeout(async () => {
        try {
          console.log(`📞 Ringing agents for incoming call ${CallSid}...`);

          // Get all users with active sessions in this organization
          const agentsQuery = `
            SELECT DISTINCT u.id, u.first_name, u.last_name, u.created_at
            FROM users u
            INNER JOIN user_sessions s ON u.id = s.user_id
            WHERE u.organization_id = $1
              AND u.is_active = true
              AND s.expires_at > NOW()
            ORDER BY u.created_at DESC
          `;

          const agentsResult = await db.query(agentsQuery, [organizationId]);
          const agents = agentsResult.rows;

          if (agents.length === 0) {
            console.log('⚠️  No agents with active sessions found. Customer will go to voicemail.');
            return;
          }

          console.log(`Found ${agents.length} agents with active sessions`);

          // Track agent call SIDs so we can cancel them when one agent answers
          const agentCallSids = [];

          // Ring each agent (and track userId mapping)
          const agentCallMapping = [];  // Array of {callSid, userId}

          for (const agent of agents) {
            try {
              const clientIdentity = `agent-${agent.id}`;
              const agentName = `${agent.first_name} ${agent.last_name}`.trim();

              console.log(`📞 Ringing agent: ${agentName} (${clientIdentity})`);

              const call = await client.calls.create({
                to: `client:${clientIdentity}`,
                from: phoneNumber,
                url: `${API_BASE_URL}/api/twilio/webhook/agent-bridge?conference=${conferenceId}`,
                statusCallback: `${API_BASE_URL}/api/twilio/webhook/agent-call-status?callSid=${CallSid}`,
                statusCallbackEvent: ['answered', 'completed'],
                timeout: 60  // Auto-cancel if no answer after 60 seconds
              });

              agentCallSids.push(call.sid);
              // Store mapping of callSid -> userId for later lookup
              agentCallMapping.push({
                callSid: call.sid,
                userId: agent.id
              });
              console.log(`✅ Agent call created: ${call.sid} for ${agentName}`);
            } catch (agentError) {
              console.error(`❌ Error ringing agent ${agent.id}: ${agentError.message}`);
              // Continue with next agent even if this one fails
            }
          }

          // Store agent call mapping in database for later cancellation and userId lookup
          if (agentCallMapping.length > 0) {
            try {
              await db.query(`
                UPDATE incoming_calls
                SET agent_call_sids = $1
                WHERE call_sid = $2
              `, [JSON.stringify(agentCallMapping), CallSid]);
            } catch (updateError) {
              console.error(`Error storing agent call mapping: ${updateError.message}`);
            }
          }

          // TIMEOUT: If no agent answers within 60 seconds, redirect customer to voicemail
          setTimeout(async () => {
            try {
              console.log(`⏰ Checking if any agent answered for call ${CallSid}...`);

              // Check current status of incoming call
              const statusQuery = `
                SELECT status FROM incoming_calls
                WHERE call_sid = $1
              `;
              const statusResult = await db.query(statusQuery, [CallSid]);

              if (statusResult.rows.length > 0 && statusResult.rows[0].status === 'ringing') {
                // Still ringing - no agent answered, redirect to voicemail
                console.log(`📞 No agent answered within 60 seconds. Redirecting customer to voicemail...`);

                const voicemailTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We apologize, all agents are currently busy. Please leave a detailed message after the beep, and we will return your call as soon as possible.</Say>
  <Record maxLength="120" playBeep="true"
    recordingStatusCallback="${API_BASE_URL}/api/twilio/webhook/recording"
    recordingStatusCallbackEvent="completed" />
  <Say voice="alice">Thank you for your message. Goodbye.</Say>
  <Hangup />
</Response>`;

                // Redirect customer to voicemail using Twilio REST API
                await client.calls(CallSid).update({
                  twiml: voicemailTwiml
                });

                // Update call status in database
                await db.query(`
                  UPDATE incoming_calls
                  SET status = 'voicemail', updated_at = NOW()
                  WHERE call_sid = $1
                `, [CallSid]);

                console.log(`✅ Customer ${CallSid} redirected to voicemail`);
              } else if (statusResult.rows.length > 0) {
                console.log(`✅ Call ${CallSid} already handled (status: ${statusResult.rows[0].status})`);
              }
            } catch (timeoutError) {
              console.error(`⚠️  Error handling 60s timeout for call ${CallSid}: ${timeoutError.message}`);
            }
          }, 61000); // 61 seconds - gives agents 60 seconds to answer
        } catch (error) {
          console.error(`Error ringing agents: ${error.message}`);
        }
      }, 100); // Small delay to ensure response is sent first
    } else {
      // Organization not found - return error TwiML
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're sorry, but we cannot process your call at this time. Goodbye.</Say>
  <Hangup />
</Response>`;
      res.type('text/xml');
      res.send(twiml);
    }
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
 * Agent Bridge - Agent joins the conference
 * Called when agent's client receives incoming call and TwiML app dials to conference
 */
router.post('/webhook/agent-bridge', async (req, res) => {
  try {
    const { conference } = req.query;

    if (!conference) {
      console.error('Agent bridge: Missing conference parameter');
      res.type('text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Error: No conference specified. Goodbye.</Say>
  <Hangup />
</Response>`);
      return;
    }

    console.log(`✅ Agent joining conference: ${conference}`);

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      beep="false">
      ${conference}
    </Conference>
  </Dial>
</Response>`;

    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error in agent bridge webhook:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Error connecting to conference. Goodbye.</Say>
  <Hangup />
</Response>`);
  }
});

/**
 * Agent Call Status - Handle agent call status updates
 * When an agent answers (in-progress), cancel ringing to other agents
 * Ignore 'completed' status (which fires when call ends, including timeout)
 */
router.post('/webhook/agent-call-status', async (req, res) => {
  try {
    const { CallStatus, CallSid } = req.body;
    const { callSid: incomingCallSid } = req.query;

    console.log(`Agent call status: ${CallStatus} for agent call ${CallSid}`);

    // ONLY process when agent ANSWERS (in-progress), NOT when call ends (completed)
    if (CallStatus === 'in-progress') {
      console.log(`✅ Agent answered! Extracting userId and cancelling other agent calls...`);

      try {
        // Get the incoming call, organization, and agent call mapping
        const incomingCallQuery = `
          SELECT organization_id, agent_call_sids
          FROM incoming_calls
          WHERE call_sid = $1
        `;
        const result = await db.query(incomingCallQuery, [incomingCallSid]);

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const organizationId = row.organization_id;

          // Parse agent call mapping: [{callSid, userId}, ...]
          const agentCallMapping = JSON.parse(row.agent_call_sids || '[]');

          // Find the userId for the agent who just answered
          let answeringAgentUserId = null;
          for (const mapping of agentCallMapping) {
            if (mapping.callSid === CallSid) {
              answeringAgentUserId = mapping.userId;
              break;
            }
          }

          if (!answeringAgentUserId) {
            console.warn(`⚠️  Could not find userId for answered call ${CallSid}`);
          } else {
            console.log(`✅ Answering agent userId: ${answeringAgentUserId}`);
          }

          // Get Twilio client
          const { client } = await twilioService.getClient(organizationId);

          // Cancel all OTHER agent calls (not the one that just answered)
          for (const mapping of agentCallMapping) {
            if (mapping.callSid !== CallSid) {
              try {
                await client.calls(mapping.callSid).update({
                  status: 'completed'
                });
                console.log(`✅ Cancelled other agent call: ${mapping.callSid} (userId: ${mapping.userId})`);
              } catch (cancelError) {
                console.error(`Error cancelling agent call ${mapping.callSid}: ${cancelError.message}`);
              }
            }
          }

          // Update incoming call status to accepted with the answering agent's userId
          const updateQuery = `
            UPDATE incoming_calls
            SET status = 'accepted', accepted_by = $1, updated_at = NOW()
            WHERE call_sid = $2
          `;
          await db.query(updateQuery, [answeringAgentUserId, incomingCallSid]);
          console.log(`✅ Incoming call ${incomingCallSid} marked as accepted by agent ${answeringAgentUserId}`);
        }
      } catch (error) {
        console.error(`Error processing agent answer: ${error.message}`);
      }
    } else if (CallStatus === 'completed') {
      // 'completed' fires when a call ends (including timeout after 60 seconds)
      // We ignore this for the "agent answered" logic
      console.log(`Agent call ${CallSid} completed/ended (timeout or agent hung up) - no action needed`);
    }

    // Return 200 OK for webhook
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error in agent call status webhook:', error);
    res.status(200).send('OK');  // Always return 200 for webhooks
  }
});

/**
 * Accept incoming call - Notify frontend to join the conference
 */
router.post('/incoming-calls/accept', authenticateToken, async (req, res) => {
  try {
    const { callSid } = req.body;
    const organizationId = req.organizationId;
    const userId = req.userId;

    console.log(`Accepting incoming call: ${callSid}`);

    // The conference was already created when customer called
    // Use CallSid as conference name (same as what was created in voice webhook)
    const conferenceId = `incoming-${callSid}`;

    console.log(`Agent will join existing conference: ${conferenceId}`);

    // Update call status in database
    const updateQuery = `
      UPDATE incoming_calls 
      SET status = 'accepted', accepted_by = $1, updated_at = NOW()
      WHERE call_sid = $2 AND organization_id = $3
      RETURNING *
    `;

    try {
      const result = await db.query(updateQuery, [userId, callSid, organizationId]);

      if (result.rows.length === 0) {
        console.warn(`⚠️  Call ${callSid} not found in database for organization ${organizationId}`);
        // Continue anyway - the call still needs to proceed, table might not exist yet
      } else {
        console.log(`✅ Updated call ${callSid} status to 'accepted' by user ${userId}`);
      }
    } catch (dbErr) {
      console.warn(`⚠️  Could not update call status in database: ${dbErr.message}`);
      // Continue anyway - the call still needs to proceed
    }

    // Emit call-accepted notification via WebSocket
    const websocketService = require('../services/websocketService');
    websocketService.emitCallAccepted(organizationId, callSid, userId);

    res.json({
      success: true,
      conferenceId,
      message: 'Agent will join existing conference'
    });

  } catch (error) {
    console.error('Error accepting call:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Decline incoming call - Hang up and clear from queue
 */
router.post('/incoming-calls/decline', authenticateToken, async (req, res) => {
  try {
    const { callSid } = req.body;
    const organizationId = req.organizationId;

    console.log(`Declining incoming call: ${callSid}`);

    // Update call status in database
    const updateQuery = `
      UPDATE incoming_calls 
      SET status = 'hangup', updated_at = NOW()
      WHERE call_sid = $1 AND organization_id = $2
      RETURNING *
    `;

    try {
      const result = await db.query(updateQuery, [callSid, organizationId]);

      if (result.rows.length === 0) {
        console.warn(`⚠️  Call ${callSid} not found in database for organization ${organizationId}`);
        // Continue anyway - the call still needs to be hung up
      } else {
        console.log(`✅ Updated call ${callSid} status to 'hangup' in database`);
      }
    } catch (dbErr) {
      console.warn(`⚠️  Could not update call status in database: ${dbErr.message}`);
      // Continue anyway - the call still needs to be hung up
    }

    // Get Twilio client and hang up the call
    const { client } = await twilioService.getClient(organizationId);

    await client.calls(callSid).update({
      status: 'completed'
    });

    res.json({
      success: true,
      message: 'Call declined and ended'
    });

  } catch (error) {
    console.error('Error declining call:', error);
    res.status(500).json({
      error: error.message || 'Failed to decline call'
    });
  }
});

/**
 * Queue result handler - Called when customer leaves queue or call ends
 */
router.post('/webhook/queue-result', async (req, res) => {
  const { CallSid, QueueResult, QueueTime } = req.body;

  console.log('========================================');
  console.log('QUEUE RESULT:', QueueResult);
  console.log('CallSid:', CallSid);
  console.log('QueueTime:', QueueTime, 'seconds');
  console.log('========================================');

  if (QueueResult === 'hangup') {
    console.log('Customer hung up while in queue');
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Hangup />
</Response>`;
    res.type('text/xml');
    res.send(twiml);
    return;
  }

  // For all other results (leave, redirected, etc.), send to voicemail
  console.log(`Sending to voicemail (result: ${QueueResult})`);
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We apologize, all of our agents are currently assisting other customers. Please leave a detailed message after the beep, and we will return your call as soon as possible.</Say>
  <Record
    maxLength="120"
    playBeep="true"
    recordingStatusCallback="${API_BASE_URL}/api/twilio/webhook/recording"
    recordingStatusCallbackEvent="completed"
  />
  <Say voice="alice">Thank you for your message. We will get back to you shortly. Goodbye.</Say>
  <Hangup />
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Voicemail redirect - Called when we forcefully dequeue after timeout
 */
router.post('/webhook/voicemail-redirect', async (req, res) => {
  const { CallSid } = req.body;

  console.log('========================================');
  console.log('📞 VOICEMAIL REDIRECT');
  console.log('CallSid:', CallSid);
  console.log('Customer being sent to voicemail after 60s timeout');
  console.log('========================================');

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">We apologize, all of our agents are currently assisting other customers. Please leave a detailed message after the beep, and we will return your call as soon as possible.</Say>
  <Record
    maxLength="120"
    playBeep="true"
    recordingStatusCallback="${API_BASE_URL}/api/twilio/webhook/recording"
    recordingStatusCallbackEvent="completed"
  />
  <Say voice="alice">Thank you for your message. We will get back to you shortly. Goodbye.</Say>
  <Hangup />
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Dequeued handler - Customer was removed from queue by agent accepting
 */
router.post('/webhook/dequeued', async (req, res) => {
  const { conference } = req.query;

  console.log(`Customer dequeued, joining conference: ${conference}`);

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Connecting you now.</Say>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      beep="false"
      waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient"
    >${conference}</Conference>
  </Dial>
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

/**
 * Conference status updates - Track conference events
 */
router.post('/webhook/conference-status', async (req, res) => {
  try {
    const { ConferenceSid, FriendlyName, StatusCallbackEvent, Timestamp } = req.body;

    console.log('Conference status update:', {
      ConferenceSid,
      FriendlyName,
      StatusCallbackEvent,
      Timestamp
    });

    // Log conference events for debugging
    // Events: start, end, join, leave, mute, hold, etc.

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling conference status:', error);
    res.status(200).send('OK'); // Always return 200 for webhook
  }
});

/**
 * Clear pending incoming call (when answered/declined)
 * Note: No longer used in polling system, kept for backward compatibility
 */
router.post('/incoming-calls/clear', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { callSid } = req.body;

    // Update the call status to 'hangup' if not already updated
    let updateQuery;
    let params;

    if (callSid) {
      // If callSid is provided, clear that specific call
      updateQuery = `
        UPDATE incoming_calls 
        SET status = 'hangup', updated_at = NOW()
        WHERE call_sid = $1 AND organization_id = $2 AND status = 'ringing'
      `;
      params = [callSid, organizationId];
    } else {
      // Otherwise clear all ringing calls for this organization (cleanup)
      updateQuery = `
        UPDATE incoming_calls 
        SET status = 'hangup', updated_at = NOW()
        WHERE organization_id = $1 AND status = 'ringing'
      `;
      params = [organizationId];
    }

    try {
      await db.query(updateQuery, params);
    } catch (dbErr) {
      console.warn(`⚠️  Could not clear calls in database: ${dbErr.message}`);
      // Continue anyway - might not have table yet
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing pending call:', error);
    res.status(500).json({ error: error.message || 'Failed to clear pending call' });
  }
});

/**
 * Twilio Webhooks - Recording Callback
 */
router.post('/webhook/recording', async (req, res) => {
  try {
    const { CallSid, RecordingUrl, RecordingSid, RecordingDuration } = req.body;

    console.log('Recording completed:', { CallSid, RecordingSid, RecordingDuration });

    // Update the phone call record with recording information
    const updateQuery = `
      UPDATE phone_calls
      SET
        recording_url = $1,
        duration_seconds = $2,
        has_recording = true
      WHERE twilio_call_sid = $3
    `;

    await db.query(updateQuery, [
      RecordingUrl,
      RecordingDuration ? parseInt(RecordingDuration) : null,
      CallSid
    ]);

    console.log('Recording saved to database for CallSid:', CallSid);

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling recording callback:', error);
    res.status(500).send('Error');
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
      // Update the phone call record with transcription
      const updateQuery = `
        UPDATE phone_calls
        SET
          notes = COALESCE(notes || E'\\n\\n', '') || 'Voicemail Transcription: ' || $1,
          updated_at = NOW()
        WHERE twilio_call_sid = $2
      `;

      await db.query(updateQuery, [TranscriptionText, CallSid]);

      console.log('Transcription saved to database for CallSid:', CallSid);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling transcription callback:', error);
    res.status(500).send('Error');
  }
});

/**
 * Twilio Webhooks - Call Status Updates
 */
router.post('/webhook/call-status', async (req, res) => {
  try {
    const { CallSid, CallStatus, CallDuration, RecordingUrl } = req.body;

    await twilioService.updateCallStatus(
      CallSid,
      CallStatus,
      CallDuration ? parseInt(CallDuration) : null,
      RecordingUrl
    );

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error updating call status:', error);
    res.status(500).send('Error');
  }
});

/**
 * Get SMS/WhatsApp/Call Statistics
 *
 * Returns statistics for SMS, WhatsApp, and phone calls:
 * - SMS stats include separate counts for total_sms and total_whatsapp
 * - Sent/received counts are combined for both channels
 * - Cost is the sum of all SMS and WhatsApp messaging costs
 * - Returns 0 for all counts if no messages/calls exist
 * - Cost returns null (converted to 0 by frontend) if no activity
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;

    // SMS and WhatsApp stats (combined and channel breakdown)
    // Note: channel column defaults to 'sms' for backward compatibility
    const smsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE channel = 'sms') as total_sms,
        COUNT(*) FILTER (WHERE channel = 'whatsapp') as total_whatsapp,
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
      sms: smsResult.rows[0] || {
        total_sms: 0,
        total_whatsapp: 0,
        sent: 0,
        received: 0,
        delivered: 0,
        failed: 0,
        total_sms_cost: null
      },
      calls: callResult.rows[0] || {
        total_calls: 0,
        outbound: 0,
        inbound: 0,
        answered: 0,
        total_duration: null,
        total_call_cost: null
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    // Return empty stats instead of error for better UX
    res.json({
      sms: {
        total_sms: 0,
        total_whatsapp: 0,
        sent: 0,
        received: 0,
        delivered: 0,
        failed: 0,
        total_sms_cost: null
      },
      calls: {
        total_calls: 0,
        outbound: 0,
        inbound: 0,
        answered: 0,
        total_duration: null,
        total_call_cost: null
      }
    });
  }
});

module.exports = router;
