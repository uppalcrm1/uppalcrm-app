const { query } = require('../database/connection');

class TrialSignup {
  constructor(data) {
    this.id = data.id;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.email = data.email;
    this.company = data.company;
    this.website = data.website;
    this.phone = data.phone;
    this.industry = data.industry;
    this.team_size = data.team_size;
    this.status = data.status;
    this.utm_source = data.utm_source;
    this.utm_campaign = data.utm_campaign;
    this.utm_medium = data.utm_medium;
    this.utm_term = data.utm_term;
    this.utm_content = data.utm_content;
    this.notes = data.notes;
    this.converted_organization_id = data.converted_organization_id;
    this.converted_at = data.converted_at;
    this.organization_slug = data.organization_slug;
    this.generated_password = data.generated_password;
    this.credentials_sent_at = data.credentials_sent_at;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // Static methods for database operations
  static async create(signupData) {
    try {
      const {
        first_name,
        last_name,
        email,
        company,
        website,
        phone,
        industry,
        team_size,
        utm_source,
        utm_campaign,
        utm_medium,
        utm_term,
        utm_content
      } = signupData;

      const result = await query(`
        INSERT INTO trial_signups (
          first_name, last_name, email, company, website, phone,
          industry, team_size, utm_source, utm_campaign, utm_medium,
          utm_term, utm_content, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        first_name,
        last_name,
        email.toLowerCase(),
        company,
        website,
        phone,
        industry,
        team_size,
        utm_source,
        utm_campaign,
        utm_medium,
        utm_term,
        utm_content,
        'pending'
      ]);

      return new TrialSignup(result.rows[0]);
    } catch (error) {
      console.error('Error creating trial signup:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const result = await query(
        'SELECT * FROM trial_signups WHERE email = $1',
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return new TrialSignup(result.rows[0]);
    } catch (error) {
      console.error('Error finding trial signup by email:', error);
      throw error;
    }
  }

  static async findById(id) {
    try {
      const result = await query(
        'SELECT * FROM trial_signups WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return new TrialSignup(result.rows[0]);
    } catch (error) {
      console.error('Error finding trial signup by ID:', error);
      throw error;
    }
  }

  static async getAll(filters = {}) {
    try {
      let queryText = 'SELECT * FROM trial_signups';
      const values = [];
      const conditions = [];
      let paramCount = 1;

      // Apply filters
      if (filters.status) {
        conditions.push(`status = $${paramCount}`);
        values.push(filters.status);
        paramCount++;
      }

      if (filters.utm_source) {
        conditions.push(`utm_source = $${paramCount}`);
        values.push(filters.utm_source);
        paramCount++;
      }

      if (filters.utm_campaign) {
        conditions.push(`utm_campaign = $${paramCount}`);
        values.push(filters.utm_campaign);
        paramCount++;
      }

      if (filters.industry) {
        conditions.push(`industry = $${paramCount}`);
        values.push(filters.industry);
        paramCount++;
      }

      if (filters.team_size) {
        conditions.push(`team_size = $${paramCount}`);
        values.push(filters.team_size);
        paramCount++;
      }

      if (filters.search) {
        conditions.push(`(
          LOWER(first_name) LIKE $${paramCount} OR
          LOWER(last_name) LIKE $${paramCount} OR
          LOWER(email) LIKE $${paramCount} OR
          LOWER(company) LIKE $${paramCount}
        )`);
        values.push(`%${filters.search.toLowerCase()}%`);
        paramCount++;
      }

      if (filters.date_from) {
        conditions.push(`created_at >= $${paramCount}`);
        values.push(filters.date_from);
        paramCount++;
      }

      if (filters.date_to) {
        conditions.push(`created_at <= $${paramCount}`);
        values.push(filters.date_to);
        paramCount++;
      }

      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      // Apply sorting
      const sortBy = filters.sort_by || 'created_at';
      const sortOrder = filters.sort_order === 'asc' ? 'ASC' : 'DESC';
      queryText += ` ORDER BY ${sortBy} ${sortOrder}`;

      // Apply pagination
      if (filters.limit) {
        queryText += ` LIMIT $${paramCount}`;
        values.push(filters.limit);
        paramCount++;

        if (filters.offset) {
          queryText += ` OFFSET $${paramCount}`;
          values.push(filters.offset);
        }
      }

      const result = await query(queryText, values);
      return result.rows.map(row => new TrialSignup(row));
    } catch (error) {
      console.error('Error getting trial signups:', error);
      throw error;
    }
  }

  static async getCount(filters = {}) {
    try {
      let queryText = 'SELECT COUNT(*) FROM trial_signups';
      const values = [];
      const conditions = [];
      let paramCount = 1;

      // Apply same filters as getAll
      if (filters.status) {
        conditions.push(`status = $${paramCount}`);
        values.push(filters.status);
        paramCount++;
      }

      if (filters.utm_source) {
        conditions.push(`utm_source = $${paramCount}`);
        values.push(filters.utm_source);
        paramCount++;
      }

      if (filters.utm_campaign) {
        conditions.push(`utm_campaign = $${paramCount}`);
        values.push(filters.utm_campaign);
        paramCount++;
      }

      if (filters.search) {
        conditions.push(`(
          LOWER(first_name) LIKE $${paramCount} OR
          LOWER(last_name) LIKE $${paramCount} OR
          LOWER(email) LIKE $${paramCount} OR
          LOWER(company) LIKE $${paramCount}
        )`);
        values.push(`%${filters.search.toLowerCase()}%`);
        paramCount++;
      }

      if (conditions.length > 0) {
        queryText += ' WHERE ' + conditions.join(' AND ');
      }

      const result = await query(queryText, values);
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('Error getting trial signups count:', error);
      throw error;
    }
  }

  static async getStats() {
    try {
      const result = await query(`
        SELECT
          COUNT(*) as total_signups,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_signups,
          COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_signups,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_signups,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_signups,
          COUNT(CASE WHEN converted_at IS NOT NULL THEN 1 END) as total_conversions,
          COUNT(CASE WHEN utm_source = 'google' THEN 1 END) as google_signups,
          COUNT(CASE WHEN utm_source = 'facebook' THEN 1 END) as facebook_signups,
          COUNT(CASE WHEN utm_source = 'linkedin' THEN 1 END) as linkedin_signups,
          COUNT(CASE WHEN utm_source = 'direct' THEN 1 END) as direct_signups,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as signups_last_7_days,
          COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as signups_last_30_days
        FROM trial_signups
      `);

      const stats = result.rows[0];

      // Calculate conversion rate
      const totalSignups = parseInt(stats.total_signups);
      const totalConversions = parseInt(stats.total_conversions);
      stats.conversion_rate = totalSignups > 0 ? (totalConversions / totalSignups * 100).toFixed(2) : '0.00';

      return stats;
    } catch (error) {
      console.error('Error getting trial signup stats:', error);
      throw error;
    }
  }

  // Instance methods
  async updateStatus(status, notes = null) {
    try {
      const validStatuses = ['pending', 'contacted', 'qualified', 'converted', 'rejected'];
      if (!validStatuses.includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }

      await query(
        'UPDATE trial_signups SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3',
        [status, notes, this.id]
      );

      this.status = status;
      this.notes = notes;
      this.updated_at = new Date();
    } catch (error) {
      console.error('Error updating trial signup status:', error);
      throw error;
    }
  }

  async addNotes(notes) {
    try {
      const currentNotes = this.notes || '';
      const timestamp = new Date().toISOString();
      const newNotes = currentNotes
        ? `${currentNotes}\n\n[${timestamp}] ${notes}`
        : `[${timestamp}] ${notes}`;

      await query(
        'UPDATE trial_signups SET notes = $1, updated_at = NOW() WHERE id = $2',
        [newNotes, this.id]
      );

      this.notes = newNotes;
      this.updated_at = new Date();
    } catch (error) {
      console.error('Error adding notes to trial signup:', error);
      throw error;
    }
  }

  async markAsConverted(organizationId) {
    try {
      await query(`
        UPDATE trial_signups
        SET status = 'converted',
            converted_organization_id = $1,
            converted_at = NOW(),
            updated_at = NOW()
        WHERE id = $2
      `, [organizationId, this.id]);

      this.status = 'converted';
      this.converted_organization_id = organizationId;
      this.converted_at = new Date();
      this.updated_at = new Date();
    } catch (error) {
      console.error('Error marking trial signup as converted:', error);
      throw error;
    }
  }

  async update(updates) {
    try {
      const allowedUpdates = [
        'first_name', 'last_name', 'company', 'website', 'phone',
        'industry', 'team_size', 'notes'
      ];

      const setClause = [];
      const values = [];
      let paramCount = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          setClause.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (setClause.length === 0) {
        throw new Error('No valid fields to update');
      }

      setClause.push(`updated_at = NOW()`);
      values.push(this.id);

      const result = await query(`
        UPDATE trial_signups
        SET ${setClause.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error('Trial signup not found');
      }

      // Update instance properties
      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      console.error('Error updating trial signup:', error);
      throw error;
    }
  }

  // Delete trial signup
  static async delete(id) {
    try {
      const result = await query(
        'DELETE FROM trial_signups WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        throw new Error('Trial signup not found');
      }

      return true;
    } catch (error) {
      console.error('Error deleting trial signup:', error);
      throw error;
    }
  }

  // Get full name
  get fullName() {
    return `${this.first_name} ${this.last_name}`.trim();
  }

  // Check if signup is recent (within last 24 hours)
  get isRecent() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return new Date(this.created_at) > twentyFourHoursAgo;
  }

  // Get status badge color for UI
  get statusColor() {
    const colors = {
      pending: 'yellow',
      contacted: 'blue',
      qualified: 'purple',
      converted: 'green',
      rejected: 'red'
    };
    return colors[this.status] || 'gray';
  }
}

module.exports = TrialSignup;