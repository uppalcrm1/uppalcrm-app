const db = require('../database/connection');
const { v4: uuidv4 } = require('uuid');

class LeadController {
  // Get detailed lead with activities and history
  async getLeadDetail(req, res) {
    try {
      const { id } = req.params;
      const { organization_id, id: user_id } = req.user;

      // Get lead details with owner information
      const leadQuery = `
        SELECT
          l.*,
          u.first_name as owner_first_name,
          u.last_name as owner_last_name,
          u.email as owner_email,
          ls.name as source_name,
          lst.name as status_name,
          lst.color as status_color,
          lst.description as status_description,
          lf.id as is_following,
          get_lead_activity_summary(l.id) as activity_summary,
          calculate_lead_stage_duration(l.id, l.status) as time_in_current_stage
        FROM leads l
        LEFT JOIN users u ON l.assigned_to = u.id
        LEFT JOIN lead_sources ls ON l.lead_source = ls.id
        LEFT JOIN lead_statuses lst ON l.status = lst.id
        LEFT JOIN lead_followers lf ON l.id = lf.lead_id AND lf.user_id = $2
        WHERE l.id = $1 AND l.organization_id = $3
      `;

      const leadResult = await db.query(leadQuery, [id, user_id, organization_id]);

      if (leadResult.rows.length === 0) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const lead = leadResult.rows[0];

      // Get recent activities count by type
      const activityStatsQuery = `
        SELECT
          interaction_type,
          COUNT(*) as count,
          MAX(created_at) as latest_activity
        FROM lead_interactions
        WHERE lead_id = $1
        GROUP BY interaction_type
        ORDER BY latest_activity DESC
      `;

      const activityStats = await db.query(activityStatsQuery, [id]);

      // Get potential duplicates
      const duplicatesQuery = `
        SELECT
          ld.*,
          l2.first_name,
          l2.last_name,
          l2.email,
          l2.company,
          l2.phone
        FROM lead_duplicates ld
        JOIN leads l2 ON ld.duplicate_lead_id = l2.id
        WHERE ld.lead_id = $1 AND ld.status = 'detected'
        ORDER BY ld.similarity_score DESC
        LIMIT 5
      `;

      const duplicates = await db.query(duplicatesQuery, [id]);

      res.json({
        lead,
        activityStats: activityStats.rows,
        duplicates: duplicates.rows
      });
    } catch (error) {
      console.error('Error fetching lead detail:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get lead activity timeline
  async getLeadActivities(req, res) {
    try {
      const { id } = req.params;
      const { organization_id } = req.user;
      const {
        page = 1,
        limit = 20,
        type,
        start_date,
        end_date
      } = req.query;

      const offset = (page - 1) * limit;
      let whereConditions = ['li.lead_id = $1'];
      let queryParams = [id];
      let paramCount = 1;

      // Add type filter
      if (type) {
        paramCount++;
        whereConditions.push(`li.interaction_type = $${paramCount}`);
        queryParams.push(type);
      }

      // Add date range filter
      if (start_date) {
        paramCount++;
        whereConditions.push(`li.created_at >= $${paramCount}`);
        queryParams.push(start_date);
      }

      if (end_date) {
        paramCount++;
        whereConditions.push(`li.created_at <= $${paramCount}`);
        queryParams.push(end_date);
      }

      const whereClause = whereConditions.join(' AND ');

      // Get activities with user information
      const activitiesQuery = `
        SELECT
          li.*,
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name,
          u.email as created_by_email
        FROM lead_interactions li
        LEFT JOIN users u ON li.created_by = u.id
        WHERE ${whereClause}
        ORDER BY li.created_at DESC
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(limit, offset);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM lead_interactions li
        WHERE ${whereClause}
      `;

      const [activitiesResult, countResult] = await Promise.all([
        db.query(activitiesQuery, queryParams),
        db.query(countQuery, queryParams.slice(0, -2))
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        activities: activitiesResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching lead activities:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Add new activity
  async addActivity(req, res) {
    try {
      const { id: lead_id } = req.params;
      const { organization_id, id: user_id } = req.user;
      const {
        interaction_type,
        subject,
        description,
        outcome,
        duration,
        scheduled_at,
        participants,
        priority = 'medium',
        activity_metadata = {}
      } = req.body;

      // Validate lead exists and user has access
      const leadCheck = await db.query(
        'SELECT id FROM leads WHERE id = $1 AND organization_id = $2',
        [lead_id, organization_id]
      );

      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Insert the activity
      const activityQuery = `
        INSERT INTO lead_interactions (
          organization_id, lead_id, interaction_type, subject, description,
          outcome, duration, priority, scheduled_at, participants,
          activity_metadata, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const activityResult = await db.query(activityQuery, [
        organization_id,
        lead_id,
        interaction_type,
        subject,
        description,
        outcome,
        duration,
        priority,
        scheduled_at,
        participants ? JSON.stringify(participants) : null,
        JSON.stringify(activity_metadata),
        user_id
      ]);

      // Get the complete activity with user info
      const completeActivityQuery = `
        SELECT
          li.*,
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name,
          u.email as created_by_email
        FROM lead_interactions li
        LEFT JOIN users u ON li.created_by = u.id
        WHERE li.id = $1
      `;

      const completeActivity = await db.query(completeActivityQuery, [activityResult.rows[0].id]);

      res.status(201).json({
        message: 'Activity added successfully',
        activity: completeActivity.rows[0]
      });
    } catch (error) {
      console.error('Error adding activity:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get lead change history
  async getLeadHistory(req, res) {
    try {
      const { id } = req.params;
      const { organization_id } = req.user;
      const { page = 1, limit = 20 } = req.query;

      const offset = (page - 1) * limit;

      // Get change history with user information
      const historyQuery = `
        SELECT
          lch.*,
          u.first_name as changed_by_first_name,
          u.last_name as changed_by_last_name,
          u.email as changed_by_email
        FROM lead_change_history lch
        LEFT JOIN users u ON lch.changed_by = u.id
        WHERE lch.lead_id = $1 AND lch.organization_id = $2
        ORDER BY lch.created_at DESC
        LIMIT $3 OFFSET $4
      `;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM lead_change_history
        WHERE lead_id = $1 AND organization_id = $2
      `;

      const [historyResult, countResult] = await Promise.all([
        db.query(historyQuery, [id, organization_id, limit, offset]),
        db.query(countQuery, [id, organization_id])
      ]);

      const total = parseInt(countResult.rows[0].total);

      res.json({
        history: historyResult.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching lead history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Update lead status (for progress bar)
  async updateLeadStatus(req, res) {
    try {
      const { id } = req.params;
      const { organization_id, id: user_id } = req.user;
      const { status, reason } = req.body;

      // Set user context for trigger
      await db.query('SET app.current_user_id = $1', [user_id]);

      // Update the lead status
      const updateQuery = `
        UPDATE leads
        SET status = $1, updated_at = NOW()
        WHERE id = $2 AND organization_id = $3
        RETURNING *
      `;

      const result = await db.query(updateQuery, [status, id, organization_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      // Add change reason if provided
      if (reason) {
        await db.query(
          'UPDATE lead_change_history SET change_reason = $1 WHERE lead_id = $2 AND field_name = $3 ORDER BY created_at DESC LIMIT 1',
          [reason, id, 'status']
        );
      }

      res.json({
        message: 'Lead status updated successfully',
        lead: result.rows[0]
      });
    } catch (error) {
      console.error('Error updating lead status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Follow/unfollow lead
  async toggleFollowLead(req, res) {
    try {
      const { id: lead_id } = req.params;
      const { organization_id, id: user_id } = req.user;

      // Check if already following
      const existingFollow = await db.query(
        'SELECT id FROM lead_followers WHERE lead_id = $1 AND user_id = $2',
        [lead_id, user_id]
      );

      if (existingFollow.rows.length > 0) {
        // Unfollow
        await db.query(
          'DELETE FROM lead_followers WHERE lead_id = $1 AND user_id = $2',
          [lead_id, user_id]
        );

        res.json({
          message: 'Lead unfollowed successfully',
          following: false
        });
      } else {
        // Follow
        await db.query(
          'INSERT INTO lead_followers (organization_id, lead_id, user_id) VALUES ($1, $2, $3)',
          [organization_id, lead_id, user_id]
        );

        res.json({
          message: 'Lead followed successfully',
          following: true
        });
      }
    } catch (error) {
      console.error('Error toggling lead follow:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get potential duplicates
  async getLeadDuplicates(req, res) {
    try {
      const { id } = req.params;
      const { organization_id } = req.user;

      const duplicatesQuery = `
        SELECT
          ld.*,
          l.first_name,
          l.last_name,
          l.email,
          l.company,
          l.phone,
          l.status,
          u.first_name as owner_first_name,
          u.last_name as owner_last_name
        FROM lead_duplicates ld
        JOIN leads l ON ld.duplicate_lead_id = l.id
        LEFT JOIN users u ON l.assigned_to = u.id
        WHERE ld.lead_id = $1 AND ld.organization_id = $2
        ORDER BY ld.similarity_score DESC, ld.created_at DESC
      `;

      const duplicates = await db.query(duplicatesQuery, [id, organization_id]);

      res.json({ duplicates: duplicates.rows });
    } catch (error) {
      console.error('Error fetching lead duplicates:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Detect duplicates for a lead
  async detectDuplicates(req, res) {
    try {
      const { id } = req.params;
      const { organization_id } = req.user;

      // Get the current lead
      const leadResult = await db.query(
        'SELECT * FROM leads WHERE id = $1 AND organization_id = $2',
        [id, organization_id]
      );

      if (leadResult.rows.length === 0) {
        return res.status(404).json({ message: 'Lead not found' });
      }

      const currentLead = leadResult.rows[0];

      // Find potential duplicates based on email, phone, and name similarity
      const duplicateQuery = `
        SELECT
          l.*,
          CASE
            WHEN l.email = $2 THEN 1.0
            WHEN LOWER(l.first_name) = LOWER($3) AND LOWER(l.last_name) = LOWER($4) THEN 0.9
            WHEN l.phone = $5 THEN 0.8
            WHEN LOWER(l.company) = LOWER($6) AND (
              LOWER(l.first_name) = LOWER($3) OR
              LOWER(l.last_name) = LOWER($4)
            ) THEN 0.7
            ELSE 0.5
          END as similarity_score,
          ARRAY[
            CASE WHEN l.email = $2 THEN 'email' END,
            CASE WHEN LOWER(l.first_name) = LOWER($3) THEN 'first_name' END,
            CASE WHEN LOWER(l.last_name) = LOWER($4) THEN 'last_name' END,
            CASE WHEN l.phone = $5 THEN 'phone' END,
            CASE WHEN LOWER(l.company) = LOWER($6) THEN 'company' END
          ]::text[] as duplicate_fields
        FROM leads l
        WHERE l.organization_id = $1
        AND l.id != $7
        AND (
          l.email = $2 OR
          l.phone = $5 OR
          (LOWER(l.first_name) = LOWER($3) AND LOWER(l.last_name) = LOWER($4)) OR
          (LOWER(l.company) = LOWER($6) AND (
            LOWER(l.first_name) = LOWER($3) OR
            LOWER(l.last_name) = LOWER($4)
          ))
        )
        ORDER BY similarity_score DESC
      `;

      const potentialDuplicates = await db.query(duplicateQuery, [
        organization_id,
        currentLead.email,
        currentLead.first_name,
        currentLead.last_name,
        currentLead.phone,
        currentLead.company,
        id
      ]);

      // Insert detected duplicates into the duplicates table
      for (const duplicate of potentialDuplicates.rows) {
        await db.query(`
          INSERT INTO lead_duplicates (
            organization_id, lead_id, duplicate_lead_id,
            similarity_score, duplicate_fields
          ) VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (lead_id, duplicate_lead_id) DO UPDATE SET
          similarity_score = EXCLUDED.similarity_score,
          duplicate_fields = EXCLUDED.duplicate_fields
        `, [
          organization_id,
          id,
          duplicate.id,
          duplicate.similarity_score,
          JSON.stringify(duplicate.duplicate_fields.filter(f => f))
        ]);
      }

      res.json({
        message: 'Duplicate detection completed',
        duplicates: potentialDuplicates.rows
      });
    } catch (error) {
      console.error('Error detecting duplicates:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }

  // Get lead status progression data
  async getLeadStatusProgression(req, res) {
    try {
      const { id } = req.params;
      const { organization_id } = req.user;

      const progressionQuery = `
        SELECT
          lsh.*,
          u.first_name as changed_by_first_name,
          u.last_name as changed_by_last_name,
          EXTRACT(EPOCH FROM duration_in_previous_status) / 3600 as hours_in_previous_status
        FROM lead_status_history lsh
        LEFT JOIN users u ON lsh.changed_by = u.id
        WHERE lsh.lead_id = $1 AND lsh.organization_id = $2
        ORDER BY lsh.created_at ASC
      `;

      const progression = await db.query(progressionQuery, [id, organization_id]);

      // Get all possible statuses for this organization
      const statusesQuery = `
        SELECT * FROM lead_statuses
        WHERE organization_id = $1
        ORDER BY sort_order ASC, name ASC
      `;

      const statuses = await db.query(statusesQuery, [organization_id]);

      res.json({
        progression: progression.rows,
        availableStatuses: statuses.rows
      });
    } catch (error) {
      console.error('Error fetching lead status progression:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new LeadController();