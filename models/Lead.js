const { query, transaction } = require('../database/connection');

class Lead {
  constructor(data = {}) {
    this.id = data.id;
    this.organization_id = data.organization_id;
    this.title = data.title;
    this.company = data.company;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.email = data.email;
    this.phone = data.phone;
    this.source = data.source;
    this.status = data.status || 'new';
    this.priority = data.priority || 'medium';
    this.value = data.value || 0;
    this.notes = data.notes;
    this.assigned_to = data.assigned_to;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.last_contact_date = data.last_contact_date;
    this.next_follow_up = data.next_follow_up;
  }

  /**
   * Create a new lead
   * @param {Object} leadData - Lead data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - ID of user creating this lead
   * @returns {Lead} Created lead instance
   */
  static async create(leadData, organizationId, createdBy) {
    const {
      title,
      company,
      first_name,
      last_name,
      email,
      phone,
      source,
      status = 'new',
      priority = 'medium',
      value = 0,
      notes,
      assigned_to,
      next_follow_up
    } = leadData;

    // Validate required fields
    if (!first_name || !last_name || !organizationId) {
      throw new Error('Missing required fields');
    }

    try {
      const result = await query(`
        INSERT INTO leads (
          organization_id, title, company, first_name, last_name, email, phone,
          source, status, priority, value, notes, assigned_to, created_by,
          next_follow_up
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        organizationId,
        title,
        company,
        first_name,
        last_name,
        email,
        phone,
        source,
        status,
        priority,
        parseFloat(value),
        notes,
        assigned_to,
        createdBy,
        next_follow_up
      ], organizationId);

      return new Lead(result.rows[0]);
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error('Lead with this email already exists in organization');
      }
      throw error;
    }
  }

  /**
   * Find lead by ID within organization context
   * @param {string} id - Lead ID
   * @param {string} organizationId - Organization ID
   * @returns {Lead|null} Lead instance or null
   */
  static async findById(id, organizationId) {
    const result = await query(`
      SELECT l.*, 
             u.first_name as assigned_first_name, 
             u.last_name as assigned_last_name,
             cb.first_name as creator_first_name,
             cb.last_name as creator_last_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id AND u.organization_id = l.organization_id
      LEFT JOIN users cb ON l.created_by = cb.id AND cb.organization_id = l.organization_id
      WHERE l.id = $1 AND l.organization_id = $2
    `, [id, organizationId], organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    const leadData = result.rows[0];
    const lead = new Lead(leadData);
    
    // Add assigned user info
    if (leadData.assigned_to) {
      lead.assigned_user = {
        id: leadData.assigned_to,
        first_name: leadData.assigned_first_name,
        last_name: leadData.assigned_last_name,
        full_name: `${leadData.assigned_first_name} ${leadData.assigned_last_name}`
      };
    }

    // Add creator info
    if (leadData.created_by) {
      lead.created_by_user = {
        id: leadData.created_by,
        first_name: leadData.creator_first_name,
        last_name: leadData.creator_last_name,
        full_name: `${leadData.creator_first_name} ${leadData.creator_last_name}`
      };
    }

    return lead;
  }

  /**
   * Get leads with filtering and pagination
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Object} Leads with pagination info
   */
  static async findByOrganization(organizationId, options = {}) {
    try {
      console.log('Finding leads for organization:', organizationId, 'with options:', options);
      
      // First check if leads table exists
      const tableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'leads'
      `, []);
      
      if (tableCheck.rows.length === 0) {
        console.error('Leads table does not exist!');
        throw new Error('Leads table not found in database. Please run migrations.');
      }

      const {
        limit = 50,
        offset = 0,
        status,
        priority,
        assigned_to,
        source,
        search,
        sort = 'created_at',
        order = 'desc'
      } = options;

    let query_text = `
      SELECT l.*, 
             u.first_name as assigned_first_name, 
             u.last_name as assigned_last_name
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id AND u.organization_id = l.organization_id
      WHERE l.organization_id = $1
    `;
    
    const params = [organizationId];
    let paramCount = 1;

    // Add filters
    if (status) {
      query_text += ` AND l.status = $${++paramCount}`;
      params.push(status);
    }

    if (priority) {
      query_text += ` AND l.priority = $${++paramCount}`;
      params.push(priority);
    }

    if (assigned_to) {
      query_text += ` AND l.assigned_to = $${++paramCount}`;
      params.push(assigned_to);
    }

    if (source) {
      query_text += ` AND l.source = $${++paramCount}`;
      params.push(source);
    }

    if (search) {
      query_text += ` AND (
        l.first_name ILIKE $${++paramCount} OR 
        l.last_name ILIKE $${++paramCount} OR 
        l.company ILIKE $${++paramCount} OR 
        l.email ILIKE $${++paramCount}
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Add sorting
    const validSorts = ['created_at', 'updated_at', 'first_name', 'last_name', 'company', 'value', 'status'];
    const sortField = validSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    
    query_text += ` ORDER BY l.${sortField} ${sortOrder}`;
    query_text += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(query_text, params, organizationId);
    
    const leads = result.rows.map(row => {
      const lead = new Lead(row);
      
      // Add assigned user info
      if (row.assigned_to) {
        lead.assigned_user = {
          id: row.assigned_to,
          first_name: row.assigned_first_name,
          last_name: row.assigned_last_name,
          full_name: `${row.assigned_first_name} ${row.assigned_last_name}`
        };
      }
      
      return lead;
    });

    // Get total count
    let countQuery = `SELECT COUNT(*) as total FROM leads WHERE organization_id = $1`;
    const countParams = [organizationId];
    let countParamCount = 1;

    // Apply same filters for count
    if (status) {
      countQuery += ` AND status = $${++countParamCount}`;
      countParams.push(status);
    }
    if (priority) {
      countQuery += ` AND priority = $${++countParamCount}`;
      countParams.push(priority);
    }
    if (assigned_to) {
      countQuery += ` AND assigned_to = $${++countParamCount}`;
      countParams.push(assigned_to);
    }
    if (source) {
      countQuery += ` AND source = $${++countParamCount}`;
      countParams.push(source);
    }
    if (search) {
      countQuery += ` AND (
        first_name ILIKE $${++countParamCount} OR 
        last_name ILIKE $${++countParamCount} OR 
        company ILIKE $${++countParamCount} OR 
        email ILIKE $${++countParamCount}
      )`;
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const countResult = await query(countQuery, countParams, organizationId);
    const total = parseInt(countResult.rows[0].total);

      return {
        leads,
        pagination: {
          total,
          page: Math.floor(offset / limit) + 1,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error in findByOrganization:', error);
      throw error;
    }
  }

  /**
   * Update lead
   * @param {string} id - Lead ID
   * @param {Object} updates - Fields to update
   * @param {string} organizationId - Organization ID
   * @returns {Lead|null} Updated lead
   */
  static async update(id, updates, organizationId) {
    const allowedFields = [
      'title', 'company', 'first_name', 'last_name', 'email', 'phone',
      'source', 'status', 'priority', 'value', 'notes', 'assigned_to',
      'last_contact_date', 'next_follow_up'
    ];
    
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 3}`).join(', ');
    const values = [id, organizationId, ...updateFields.map(field => {
      if (field === 'value') {
        return parseFloat(updates[field]) || 0;
      }
      return updates[field];
    })];

    const result = await query(`
      UPDATE leads 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `, values, organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    return new Lead(result.rows[0]);
  }

  /**
   * Delete lead (hard delete)
   * @param {string} id - Lead ID
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Success status
   */
  static async delete(id, organizationId) {
    const result = await query(`
      DELETE FROM leads WHERE id = $1 AND organization_id = $2
    `, [id, organizationId], organizationId);

    return result.rowCount > 0;
  }

  /**
   * Get lead statistics
   * @param {string} organizationId - Organization ID
   * @returns {Object} Lead statistics
   */
  static async getStats(organizationId) {
    try {
      console.log('Getting stats for organization:', organizationId);
      
      // First check if leads table exists
      const tableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'leads'
      `, []);
      
      console.log('Table check result:', tableCheck.rows);
      
      if (tableCheck.rows.length === 0) {
        console.error('Leads table does not exist!');
        throw new Error('Leads table not found in database. Please run migrations.');
      }

      const result = await query(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
          COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_leads,
          COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_leads,
          COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_leads,
          COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_leads,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
          COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_leads,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
          COALESCE(SUM(value), 0) as total_value,
          COALESCE(AVG(value), 0) as average_value
        FROM leads 
        WHERE organization_id = $1
      `, [organizationId], organizationId);

      console.log('Stats query result:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error in getStats:', error);
      throw error;
    }
  }

  /**
   * Get full name of lead
   * @returns {string} Full name
   */
  getFullName() {
    return `${this.first_name} ${this.last_name}`.trim();
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      organization_id: this.organization_id,
      title: this.title,
      company: this.company,
      first_name: this.first_name,
      last_name: this.last_name,
      full_name: this.getFullName(),
      email: this.email,
      phone: this.phone,
      source: this.source,
      status: this.status,
      priority: this.priority,
      value: parseFloat(this.value) || 0,
      notes: this.notes,
      assigned_to: this.assigned_to,
      assigned_user: this.assigned_user,
      created_by: this.created_by,
      created_by_user: this.created_by_user,
      created_at: this.created_at,
      updated_at: this.updated_at,
      last_contact_date: this.last_contact_date,
      next_follow_up: this.next_follow_up
    };
  }
}

module.exports = Lead;