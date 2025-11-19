const twilio = require('twilio');
const db = require('../database/connection');

// Fallback to production URL if API_BASE_URL not set
const API_BASE_URL = process.env.API_BASE_URL || 'https://uppalcrm-api.onrender.com';

class TwilioService {
  constructor() {
    this.clients = new Map(); // Cache Twilio clients per organization
  }

  /**
   * Get or create Twilio client for organization
   */
  async getClient(organizationId) {
    if (this.clients.has(organizationId)) {
      return this.clients.get(organizationId);
    }

    const query = `
      SELECT account_sid, auth_token, phone_number, is_active
      FROM twilio_config
      WHERE organization_id = $1 AND is_active = true
    `;

    const result = await db.query(query, [organizationId]);

    if (result.rows.length === 0) {
      throw new Error('Twilio not configured for this organization');
    }

    const config = result.rows[0];
    const client = twilio(config.account_sid, config.auth_token);

    this.clients.set(organizationId, {
      client,
      phoneNumber: config.phone_number
    });

    return this.clients.get(organizationId);
  }

  /**
   * Send SMS message
   */
  async sendSMS({ organizationId, to, body, leadId = null, contactId = null, userId, templateId = null }) {
    try {
      const { client, phoneNumber } = await this.getClient(organizationId);

      // Send via Twilio
      const message = await client.messages.create({
        body,
        from: phoneNumber,
        to,
        statusCallback: `${API_BASE_URL}/api/twilio/webhook/sms-status`
      });

      // Save to database
      const insertQuery = `
        INSERT INTO sms_messages (
          organization_id, lead_id, contact_id, user_id,
          direction, from_number, to_number, body,
          twilio_sid, twilio_status, template_id, sent_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        organizationId, leadId, contactId, userId,
        'outbound', phoneNumber, to, body,
        message.sid, message.status, templateId
      ]);

      // Also create interaction record
      if (leadId) {
        await this.createInteraction(organizationId, leadId, userId, 'sms', body, 'sent');
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  /**
   * Make phone call
   */
  async makeCall({ organizationId, to, leadId = null, contactId = null, userId }) {
    try {
      const { client, phoneNumber } = await this.getClient(organizationId);

      const call = await client.calls.create({
        url: `${API_BASE_URL}/api/twilio/webhook/voice`,
        to,
        from: phoneNumber,
        record: true,
        statusCallback: `${API_BASE_URL}/api/twilio/webhook/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
      });

      // Save to database
      const insertQuery = `
        INSERT INTO phone_calls (
          organization_id, lead_id, contact_id, user_id,
          direction, from_number, to_number,
          twilio_call_sid, twilio_status, started_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING *
      `;

      const result = await db.query(insertQuery, [
        organizationId, leadId, contactId, userId,
        'outbound', phoneNumber, to,
        call.sid, call.status
      ]);

      return result.rows[0];
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }

  /**
   * Create interaction record for lead
   */
  async createInteraction(organizationId, leadId, userId, type, description, outcome) {
    const query = `
      INSERT INTO lead_interactions (
        lead_id, user_id, interaction_type, description, outcome, completed_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `;

    await db.query(query, [leadId, userId, type, description, outcome]);
  }

  /**
   * Process incoming SMS
   */
  async processIncomingSMS(data) {
    const { From, To, Body, MessageSid, NumMedia, MediaUrl0 } = data;

    console.log('Processing incoming SMS:', { From, To, MessageSid });

    // Normalize phone number (remove any non-digit characters except +)
    const normalizedTo = To.replace(/[^\d+]/g, '');

    // Find organization by phone number (flexible matching)
    const orgQuery = `
      SELECT organization_id FROM twilio_config
      WHERE phone_number = $1
         OR phone_number = $2
         OR REPLACE(REPLACE(phone_number, '-', ''), ' ', '') = $3
    `;
    const orgResult = await db.query(orgQuery, [To, normalizedTo, normalizedTo]);

    if (orgResult.rows.length === 0) {
      console.error('No organization found for phone number:', To, '(normalized:', normalizedTo, ')');
      return;
    }

    const organizationId = orgResult.rows[0].organization_id;

    // Find existing lead/contact by phone number
    let leadId = null;
    let contactId = null;

    // Check contacts first
    const contactQuery = `
      SELECT id FROM contacts WHERE organization_id = $1 AND phone = $2 LIMIT 1
    `;
    const contactResult = await db.query(contactQuery, [organizationId, From]);

    if (contactResult.rows.length > 0) {
      contactId = contactResult.rows[0].id;
    } else {
      // Check leads
      const leadQuery = `
        SELECT id FROM leads WHERE organization_id = $1 AND phone = $2 LIMIT 1
      `;
      const leadResult = await db.query(leadQuery, [organizationId, From]);

      if (leadResult.rows.length > 0) {
        leadId = leadResult.rows[0].id;
      } else {
        // Create new lead from incoming SMS
        const createLeadQuery = `
          INSERT INTO leads (organization_id, phone, source, status, last_contact_date, first_name)
          VALUES ($1, $2, 'SMS', 'new', NOW(), 'SMS Lead')
          RETURNING id
        `;
        const newLead = await db.query(createLeadQuery, [organizationId, From]);
        leadId = newLead.rows[0].id;
        console.log('Created new lead from SMS:', leadId);
      }
    }

    // Save SMS message
    const mediaUrls = NumMedia > 0 ? [MediaUrl0] : null;

    const insertQuery = `
      INSERT INTO sms_messages (
        organization_id, lead_id, contact_id,
        direction, from_number, to_number, body,
        twilio_sid, twilio_status, num_media, media_urls,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      organizationId, leadId, contactId,
      'inbound', From, To, Body,
      MessageSid, 'received', parseInt(NumMedia || 0), JSON.stringify(mediaUrls)
    ]);

    // Check for auto-responses
    await this.checkAutoResponse(organizationId, Body, From, leadId);

    return result.rows[0];
  }

  /**
   * Check and send auto-responses based on rules
   */
  async checkAutoResponse(organizationId, incomingMessage, toNumber, leadId) {
    const query = `
      SELECT ar.*, st.body as template_body
      FROM sms_auto_responses ar
      LEFT JOIN sms_templates st ON ar.template_id = st.id
      WHERE ar.organization_id = $1 AND ar.is_active = true
      ORDER BY ar.priority DESC
    `;

    const rules = await db.query(query, [organizationId]);

    for (const rule of rules.rows) {
      let shouldRespond = false;

      if (rule.trigger_type === 'keyword' && rule.keyword) {
        const lowerMessage = incomingMessage.toLowerCase();
        const lowerKeyword = rule.keyword.toLowerCase();
        shouldRespond = lowerMessage.includes(lowerKeyword);
      }

      if (rule.trigger_type === 'business_hours') {
        const now = new Date();
        const currentHour = now.getHours();
        const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.

        const startHour = parseInt(rule.business_hours_start?.split(':')[0] || 9);
        const endHour = parseInt(rule.business_hours_end?.split(':')[0] || 17);

        const isBusinessDay = rule.business_days?.includes(currentDay);
        const isBusinessHours = currentHour >= startHour && currentHour < endHour;

        shouldRespond = !isBusinessDay || !isBusinessHours;
      }

      if (shouldRespond) {
        const responseBody = rule.response_message || rule.template_body;

        await this.sendSMS({
          organizationId,
          to: toNumber,
          body: responseBody,
          leadId,
          userId: null, // Auto-response
          templateId: rule.template_id
        });

        break; // Only send first matching auto-response
      }
    }
  }

  /**
   * Update SMS status from webhook
   */
  async updateSMSStatus(messageSid, status, errorCode = null, errorMessage = null) {
    const query = `
      UPDATE sms_messages
      SET twilio_status = $1,
          error_code = $2,
          error_message = $3,
          delivered_at = CASE WHEN $1 = 'delivered' THEN NOW() ELSE delivered_at END
      WHERE twilio_sid = $4
      RETURNING *
    `;

    const result = await db.query(query, [status, errorCode, errorMessage, messageSid]);
    return result.rows[0];
  }

  /**
   * Update call status from webhook
   */
  async updateCallStatus(callSid, status, duration = null, recordingUrl = null) {
    const query = `
      UPDATE phone_calls
      SET twilio_status = $1,
          duration_seconds = $2,
          recording_url = $3,
          has_recording = $4,
          ended_at = CASE WHEN $1 IN ('completed', 'failed', 'busy', 'no-answer') THEN NOW() ELSE ended_at END,
          answered_at = CASE WHEN $1 = 'answered' THEN NOW() ELSE answered_at END
      WHERE twilio_call_sid = $5
      RETURNING *
    `;

    const result = await db.query(query, [
      status,
      duration,
      recordingUrl,
      recordingUrl ? true : false,
      callSid
    ]);

    return result.rows[0];
  }
}

module.exports = new TwilioService();
