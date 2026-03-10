const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/connection');

/**
 * POST /api/communications/mark-read
 * Mark a conversation as read for the current user
 */
router.post('/mark-read', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;
    const { conversation_phone, channel } = req.body;

    if (!conversation_phone || !channel) {
      return res.status(400).json({ error: 'conversation_phone and channel are required' });
    }

    const validChannels = ['sms', 'whatsapp', 'call', 'all'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: `channel must be one of: ${validChannels.join(', ')}` });
    }

    try {
      await db.query(`
        INSERT INTO conversation_read_status (organization_id, user_id, conversation_phone, channel, last_read_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (organization_id, user_id, conversation_phone, channel)
        DO UPDATE SET last_read_at = NOW(), updated_at = NOW()
      `, [organizationId, userId, conversation_phone, channel]);
    } catch (tableError) {
      // Table may not exist yet if migration hasn't run
      console.warn('conversation_read_status table not available yet:', tableError.message);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    res.status(500).json({ error: 'Failed to mark conversation as read' });
  }
});

/**
 * POST /api/communications/mark-all-read
 * Mark all conversations in a channel as read for the current user
 */
router.post('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;
    const { channel } = req.body;

    if (!channel) {
      return res.status(400).json({ error: 'channel is required' });
    }

    const validChannels = ['sms', 'whatsapp', 'call'];
    if (!validChannels.includes(channel)) {
      return res.status(400).json({ error: `channel must be one of: ${validChannels.join(', ')}` });
    }

    // Check if table exists
    let hasTable = false;
    try {
      await db.query(`SELECT 1 FROM conversation_read_status LIMIT 0`);
      hasTable = true;
    } catch (e) { /* table doesn't exist yet */ }

    if (hasTable) {
      if (channel === 'sms' || channel === 'whatsapp') {
        const phonesResult = await db.query(`
          SELECT DISTINCT
            CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number
          FROM sms_messages
          WHERE organization_id = $1 AND channel = $2
        `, [organizationId, channel]);

        for (const row of phonesResult.rows) {
          await db.query(`
            INSERT INTO conversation_read_status (organization_id, user_id, conversation_phone, channel, last_read_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (organization_id, user_id, conversation_phone, channel)
            DO UPDATE SET last_read_at = NOW(), updated_at = NOW()
          `, [organizationId, userId, row.phone_number, channel]);
        }
      } else if (channel === 'call') {
        const phonesResult = await db.query(`
          SELECT DISTINCT
            CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number
          FROM phone_calls
          WHERE organization_id = $1
        `, [organizationId]);

        for (const row of phonesResult.rows) {
          await db.query(`
            INSERT INTO conversation_read_status (organization_id, user_id, conversation_phone, channel, last_read_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (organization_id, user_id, conversation_phone, channel)
            DO UPDATE SET last_read_at = NOW(), updated_at = NOW()
          `, [organizationId, userId, row.phone_number, 'call']);
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all as read:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

/**
 * GET /api/communications/unread-counts
 * Get unread conversation counts per channel for the current user
 */
router.get('/unread-counts', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const userId = req.userId;

    // Check if required tables/columns exist
    let hasReadStatusTable = false;
    let hasCallStatusColumn = false;
    try {
      await db.query(`SELECT 1 FROM conversation_read_status LIMIT 0`);
      hasReadStatusTable = true;
    } catch (e) { /* table doesn't exist yet */ }
    try {
      await db.query(`SELECT call_status FROM phone_calls LIMIT 0`);
      hasCallStatusColumn = true;
    } catch (e) { /* column doesn't exist yet */ }

    if (!hasReadStatusTable) {
      return res.json({ sms: 0, whatsapp: 0, calls: 0, total: 0 });
    }

    // SMS unread count: conversations with inbound messages newer than user's last_read_at
    const smsResult = await db.query(`
      WITH latest_inbound AS (
        SELECT
          CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number,
          MAX(created_at) as latest_message_at
        FROM sms_messages
        WHERE organization_id = $1
          AND channel = 'sms'
          AND direction = 'inbound'
        GROUP BY CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
      )
      SELECT COUNT(*) as unread_count
      FROM latest_inbound li
      WHERE li.latest_message_at > COALESCE(
        (SELECT crs.last_read_at
         FROM conversation_read_status crs
         WHERE crs.organization_id = $1
           AND crs.user_id = $2
           AND crs.conversation_phone = li.phone_number
           AND crs.channel = 'sms'),
        '1970-01-01'::timestamptz
      )
    `, [organizationId, userId]);

    // WhatsApp unread count
    const whatsappResult = await db.query(`
      WITH latest_inbound AS (
        SELECT
          CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number,
          MAX(created_at) as latest_message_at
        FROM sms_messages
        WHERE organization_id = $1
          AND channel = 'whatsapp'
          AND direction = 'inbound'
        GROUP BY CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
      )
      SELECT COUNT(*) as unread_count
      FROM latest_inbound li
      WHERE li.latest_message_at > COALESCE(
        (SELECT crs.last_read_at
         FROM conversation_read_status crs
         WHERE crs.organization_id = $1
           AND crs.user_id = $2
           AND crs.conversation_phone = li.phone_number
           AND crs.channel = 'whatsapp'),
        '1970-01-01'::timestamptz
      )
    `, [organizationId, userId]);

    // Calls unread count: missed/no-answer/voicemail calls newer than last_read_at
    let callsResult;
    if (hasCallStatusColumn) {
      callsResult = await db.query(`
        WITH latest_missed AS (
          SELECT
            CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number,
            MAX(created_at) as latest_call_at
          FROM phone_calls
          WHERE organization_id = $1
            AND (call_status IN ('missed', 'no-answer', 'voicemail')
                 OR outcome IN ('no_answer', 'busy', 'voicemail', 'failed'))
            AND direction = 'inbound'
          GROUP BY CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
        )
        SELECT COUNT(*) as unread_count
        FROM latest_missed lm
        WHERE lm.latest_call_at > COALESCE(
          (SELECT crs.last_read_at
           FROM conversation_read_status crs
           WHERE crs.organization_id = $1
             AND crs.user_id = $2
             AND crs.conversation_phone = lm.phone_number
             AND crs.channel = 'call'),
          '1970-01-01'::timestamptz
        )
      `, [organizationId, userId]);
    } else {
      callsResult = await db.query(`
        WITH latest_missed AS (
          SELECT
            CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END as phone_number,
            MAX(created_at) as latest_call_at
          FROM phone_calls
          WHERE organization_id = $1
            AND outcome IN ('no_answer', 'busy', 'voicemail', 'failed')
            AND direction = 'inbound'
          GROUP BY CASE WHEN direction = 'outbound' THEN to_number ELSE from_number END
        )
        SELECT COUNT(*) as unread_count
        FROM latest_missed lm
        WHERE lm.latest_call_at > COALESCE(
          (SELECT crs.last_read_at
           FROM conversation_read_status crs
           WHERE crs.organization_id = $1
             AND crs.user_id = $2
             AND crs.conversation_phone = lm.phone_number
             AND crs.channel = 'call'),
          '1970-01-01'::timestamptz
        )
      `, [organizationId, userId]);
    }

    const sms = parseInt(smsResult.rows[0].unread_count) || 0;
    const whatsapp = parseInt(whatsappResult.rows[0].unread_count) || 0;
    const calls = parseInt(callsResult.rows[0].unread_count) || 0;

    res.json({
      sms,
      whatsapp,
      calls,
      total: sms + whatsapp + calls
    });
  } catch (error) {
    console.error('Error fetching unread counts:', error);
    res.json({ sms: 0, whatsapp: 0, calls: 0, total: 0 });
  }
});

module.exports = router;
