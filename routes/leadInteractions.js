const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../database/connection');
const Joi = require('joi');

// Validation schema
const interactionSchema = Joi.object({
  interaction_type: Joi.string().valid('call', 'email', 'meeting', 'note', 'task').required(),
  subject: Joi.string().max(255).optional().allow(''),
  description: Joi.string().required(),
  outcome: Joi.string().max(100).optional().allow(''),
  scheduled_at: Joi.date().iso().optional().allow(null, ''),
  duration_minutes: Joi.number().integer().min(0).optional().allow(null, '')
});

/**
 * GET /api/leads/:leadId/interactions
 * Get all interactions for a specific lead
 */
router.get('/:leadId/interactions', authenticateToken, async (req, res) => {
  try {
    const { leadId } = req.params;
    const organizationId = req.user.organizationId;

    // Verify lead belongs to organization
    const leadCheck = await db.query(
      'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
      [leadId, organizationId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Get all interactions for this lead
    const query = `
      SELECT
        li.*,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        u.email as user_email
      FROM lead_interactions li
      LEFT JOIN users u ON li.user_id = u.id
      WHERE li.lead_id = $1
      ORDER BY
        CASE
          WHEN li.status = 'scheduled' THEN li.scheduled_at
          ELSE li.created_at
        END DESC
    `;

    const result = await db.query(query, [leadId]);

    res.json({ interactions: result.rows });
  } catch (error) {
    console.error('Error fetching interactions:', error);
    res.status(500).json({ error: 'Failed to fetch interactions' });
  }
});

/**
 * POST /api/leads/:leadId/interactions
 * Create new interaction for a lead
 */
router.post('/:leadId/interactions', authenticateToken, async (req, res) => {
  try {
    const { error } = interactionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { leadId } = req.params;
    const organizationId = req.user.organizationId;
    const userId = req.user.userId;

    // Verify lead belongs to organization
    const leadCheck = await db.query(
      'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
      [leadId, organizationId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const {
      interaction_type,
      subject,
      description,
      outcome,
      scheduled_at,
      duration_minutes
    } = req.body;

    // Determine status based on whether it's scheduled for future
    const status = scheduled_at && new Date(scheduled_at) > new Date()
      ? 'scheduled'
      : 'completed';

    const completed_at = status === 'completed' ? new Date() : null;

    // Insert interaction
    const insertQuery = `
      INSERT INTO lead_interactions (
        lead_id, user_id, interaction_type, subject, description,
        outcome, scheduled_at, completed_at, duration_minutes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await db.query(insertQuery, [
      leadId,
      userId,
      interaction_type,
      subject || null,
      description,
      outcome || null,
      scheduled_at || null,
      completed_at,
      duration_minutes || null,
      status
    ]);

    // Update lead's last_contact_date if interaction is completed
    if (status === 'completed') {
      await db.query(
        'UPDATE leads SET last_contact_date = NOW(), updated_at = NOW() WHERE id = $1',
        [leadId]
      );
    }

    res.status(201).json({
      message: 'Interaction created successfully',
      interaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating interaction:', error);
    res.status(500).json({ error: 'Failed to create interaction' });
  }
});

/**
 * PUT /api/leads/:leadId/interactions/:interactionId
 * Update an existing interaction
 */
router.put('/:leadId/interactions/:interactionId', authenticateToken, async (req, res) => {
  try {
    const { leadId, interactionId } = req.params;
    const organizationId = req.user.organizationId;

    // Verify lead belongs to organization
    const leadCheck = await db.query(
      'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
      [leadId, organizationId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const {
      interaction_type,
      subject,
      description,
      outcome,
      scheduled_at,
      duration_minutes,
      status
    } = req.body;

    // Update interaction
    const query = `
      UPDATE lead_interactions
      SET
        interaction_type = COALESCE($1, interaction_type),
        subject = COALESCE($2, subject),
        description = COALESCE($3, description),
        outcome = COALESCE($4, outcome),
        scheduled_at = COALESCE($5, scheduled_at),
        duration_minutes = COALESCE($6, duration_minutes),
        status = COALESCE($7, status),
        completed_at = CASE
          WHEN COALESCE($7, status) = 'completed' AND completed_at IS NULL
          THEN NOW()
          ELSE completed_at
        END,
        updated_at = NOW()
      WHERE id = $8 AND lead_id = $9
      RETURNING *
    `;

    const result = await db.query(query, [
      interaction_type,
      subject,
      description,
      outcome,
      scheduled_at,
      duration_minutes,
      status,
      interactionId,
      leadId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    res.json({
      message: 'Interaction updated successfully',
      interaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating interaction:', error);
    res.status(500).json({ error: 'Failed to update interaction' });
  }
});

/**
 * DELETE /api/leads/:leadId/interactions/:interactionId
 * Delete an interaction
 */
router.delete('/:leadId/interactions/:interactionId', authenticateToken, async (req, res) => {
  try {
    const { leadId, interactionId } = req.params;
    const organizationId = req.user.organizationId;

    // Verify lead belongs to organization
    const leadCheck = await db.query(
      'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
      [leadId, organizationId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Delete interaction
    const query = `
      DELETE FROM lead_interactions
      WHERE id = $1 AND lead_id = $2
      RETURNING id
    `;

    const result = await db.query(query, [interactionId, leadId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    res.json({ message: 'Interaction deleted successfully' });
  } catch (error) {
    console.error('Error deleting interaction:', error);
    res.status(500).json({ error: 'Failed to delete interaction' });
  }
});

/**
 * PATCH /api/leads/:leadId/interactions/:interactionId/complete
 * Mark a scheduled interaction as completed
 */
router.patch('/:leadId/interactions/:interactionId/complete', authenticateToken, async (req, res) => {
  try {
    const { leadId, interactionId } = req.params;
    const { outcome, duration_minutes } = req.body;
    const organizationId = req.user.organizationId;

    // Verify lead belongs to organization
    const leadCheck = await db.query(
      'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
      [leadId, organizationId]
    );

    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Mark as completed
    const query = `
      UPDATE lead_interactions
      SET
        status = 'completed',
        completed_at = NOW(),
        outcome = COALESCE($1, outcome),
        duration_minutes = COALESCE($2, duration_minutes),
        updated_at = NOW()
      WHERE id = $3 AND lead_id = $4
      RETURNING *
    `;

    const result = await db.query(query, [outcome, duration_minutes, interactionId, leadId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    // Update lead's last_contact_date
    await db.query(
      'UPDATE leads SET last_contact_date = NOW(), updated_at = NOW() WHERE id = $1',
      [leadId]
    );

    res.json({
      message: 'Interaction marked as completed',
      interaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error completing interaction:', error);
    res.status(500).json({ error: 'Failed to complete interaction' });
  }
});

module.exports = router;
