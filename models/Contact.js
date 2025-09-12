const { query, transaction } = require('../database/connection');
const crypto = require('crypto');

class Contact {
  constructor(data = {}) {
    this.id = data.id;
    this.organization_id = data.organization_id;
    this.title = data.title;
    this.company = data.company;
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.email = data.email;
    this.phone = data.phone;
    this.status = data.status || 'active';
    this.type = data.type || 'customer';
    this.source = data.source;
    this.priority = data.priority || 'medium';
    this.value = data.value || 0;
    this.notes = data.notes;
    this.assigned_to = data.assigned_to;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.last_contact_date = data.last_contact_date;
    this.next_follow_up = data.next_follow_up;
    this.converted_from_lead_id = data.converted_from_lead_id;
  }

  /**
   * Create a new contact
   * @param {Object} contactData - Contact data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - ID of user creating this contact
   * @returns {Contact} Created contact instance
   */
  static async create(contactData, organizationId, createdBy) {
    const {
      title,
      company,
      first_name,
      last_name,
      email,
      phone,
      status = 'active',
      type = 'customer',
      source,
      priority = 'medium',
      value = 0,
      notes,
      assigned_to,
      next_follow_up,
      converted_from_lead_id
    } = contactData;

    if (!first_name || !last_name || !organizationId) {
      throw new Error('Missing required fields: first_name, last_name');
    }

    try {
      const result = await query(`
        INSERT INTO contacts (
          organization_id, title, company, first_name, last_name, email, phone,
          contact_status, contact_source, priority, lifetime_value, notes, assigned_to, created_by,
          next_follow_up
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING id, name, tenant_id, status, source, email, first_name, last_name, company, phone, notes, created_at, updated_at
      `, [
        organizationId,
        title,
        company,
        first_name,
        last_name,
        email,
        phone,
        status, // maps to contact_status
        source, // maps to contact_source
        priority,
        parseFloat(value), // maps to lifetime_value
        notes,
        assigned_to,
        createdBy,
        next_follow_up
      ], organizationId);

      return new Contact(result.rows[0]);
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error('Contact with this email already exists in organization');
      }
      throw error;
    }
  }

  /**
   * Find contact by ID within organization context
   * @param {string} id - Contact ID
   * @param {string} organizationId - Organization ID
   * @returns {Contact|null} Contact instance or null
   */
  static async findById(id, organizationId) {
    const result = await query(`
      SELECT c.*, 
             u.first_name as assigned_first_name, 
             u.last_name as assigned_last_name,
             cb.first_name as creator_first_name,
             cb.last_name as creator_last_name,
             l.first_name as lead_first_name,
             l.last_name as lead_last_name
      FROM contacts c
      LEFT JOIN users u ON c.assigned_to = u.id AND u.organization_id = c.organization_id
      LEFT JOIN users cb ON c.created_by = cb.id AND cb.organization_id = c.organization_id
      LEFT JOIN leads l ON c.converted_from_lead_id = l.id AND l.organization_id = c.organization_id
      WHERE c.id = $1 AND c.organization_id = $2
    `, [id, organizationId], organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    const contactData = result.rows[0];
    const contact = new Contact(contactData);
    
    if (contactData.assigned_to) {
      contact.assigned_user = {
        id: contactData.assigned_to,
        first_name: contactData.assigned_first_name,
        last_name: contactData.assigned_last_name,
        full_name: `${contactData.assigned_first_name} ${contactData.assigned_last_name}`
      };
    }

    if (contactData.created_by) {
      contact.created_by_user = {
        id: contactData.created_by,
        first_name: contactData.creator_first_name,
        last_name: contactData.creator_last_name,
        full_name: `${contactData.creator_first_name} ${contactData.creator_last_name}`
      };
    }

    if (contactData.converted_from_lead_id) {
      contact.converted_from_lead = {
        id: contactData.converted_from_lead_id,
        first_name: contactData.lead_first_name,
        last_name: contactData.lead_last_name,
        full_name: `${contactData.lead_first_name} ${contactData.lead_last_name}`
      };
    }

    return contact;
  }

  /**
   * Get contacts with full-text search and pagination
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Object} Contacts with pagination info
   */
  static async findByOrganization(organizationId, options = {}) {
    try {
      const tableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'contacts'
      `, []);
      
      if (tableCheck.rows.length === 0) {
        throw new Error('Contacts table not found in database. Please run migrations.');
      }

      const {
        limit = 50,
        offset = 0,
        status,
        type,
        priority,
        assigned_to,
        source,
        search,
        sort = 'created_at',
        order = 'desc'
      } = options;

      let query_text = `
        SELECT c.*, 
               u.first_name as assigned_first_name, 
               u.last_name as assigned_last_name
        FROM contacts c
        LEFT JOIN users u ON c.assigned_to = u.id AND u.organization_id = c.organization_id
        WHERE c.organization_id = $1
      `;
      
      const params = [organizationId];
      let paramCount = 1;

      if (status) {
        query_text += ` AND c.status = $${++paramCount}`;
        params.push(status);
      }

      if (type) {
        query_text += ` AND c.type = $${++paramCount}`;
        params.push(type);
      }

      if (priority) {
        query_text += ` AND c.priority = $${++paramCount}`;
        params.push(priority);
      }

      if (assigned_to) {
        query_text += ` AND c.assigned_to = $${++paramCount}`;
        params.push(assigned_to);
      }

      if (source) {
        query_text += ` AND c.source ILIKE $${++paramCount}`;
        params.push(`%${source}%`);
      }

      if (search) {
        query_text += ` AND (
          c.first_name ILIKE $${++paramCount} OR 
          c.last_name ILIKE $${++paramCount} OR 
          c.company ILIKE $${++paramCount} OR 
          c.email ILIKE $${++paramCount} OR
          c.phone ILIKE $${++paramCount} OR
          c.notes ILIKE $${++paramCount}
        )`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const validSorts = ['created_at', 'updated_at', 'first_name', 'last_name', 'company', 'value', 'status'];
      const sortField = validSorts.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      query_text += ` ORDER BY c.${sortField} ${sortOrder}`;
      query_text += ` LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(limit, offset);

      const result = await query(query_text, params, organizationId);
      
      const contacts = result.rows.map(row => {
        const contact = new Contact(row);
        
        if (row.assigned_to) {
          contact.assigned_user = {
            id: row.assigned_to,
            first_name: row.assigned_first_name,
            last_name: row.assigned_last_name,
            full_name: `${row.assigned_first_name} ${row.assigned_last_name}`
          };
        }
        
        return contact;
      });

      let countQuery = `SELECT COUNT(*) as total FROM contacts WHERE organization_id = $1`;
      const countParams = [organizationId];
      let countParamCount = 1;

      if (status) {
        countQuery += ` AND status = $${++countParamCount}`;
        countParams.push(status);
      }
      if (type) {
        countQuery += ` AND type = $${++countParamCount}`;
        countParams.push(type);
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
        countQuery += ` AND source ILIKE $${++countParamCount}`;
        countParams.push(`%${source}%`);
      }
      if (search) {
        countQuery += ` AND (
          first_name ILIKE $${++countParamCount} OR 
          last_name ILIKE $${++countParamCount} OR 
          company ILIKE $${++countParamCount} OR 
          email ILIKE $${++countParamCount} OR
          phone ILIKE $${++countParamCount} OR
          notes ILIKE $${++countParamCount}
        )`;
        const searchPattern = `%${search}%`;
        countParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
      }

      const countResult = await query(countQuery, countParams, organizationId);
      const total = parseInt(countResult.rows[0].total);

      return {
        contacts,
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
   * Update contact
   * @param {string} id - Contact ID
   * @param {Object} updates - Fields to update
   * @param {string} organizationId - Organization ID
   * @returns {Contact|null} Updated contact
   */
  static async update(id, updates, organizationId) {
    const allowedFields = [
      'title', 'company', 'first_name', 'last_name', 'email', 'phone',
      'status', 'type', 'source', 'priority', 'value', 'notes', 'assigned_to',
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
      UPDATE contacts 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `, values, organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    return new Contact(result.rows[0]);
  }

  /**
   * Delete contact (hard delete)
   * @param {string} id - Contact ID
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Success status
   */
  static async delete(id, organizationId) {
    const result = await query(`
      DELETE FROM contacts WHERE id = $1 AND organization_id = $2
    `, [id, organizationId], organizationId);

    return result.rowCount > 0;
  }

  /**
   * Convert a lead to contact
   * @param {string} leadId - Lead ID to convert
   * @param {string} organizationId - Organization ID
   * @param {string} convertedBy - ID of user performing conversion
   * @param {Object} additionalData - Additional contact data
   * @returns {Contact} Created contact
   */
  static async convertFromLead(leadId, organizationId, convertedBy, additionalData = {}) {
    return await transaction(async (client) => {
      const leadResult = await client.query(`
        SELECT * FROM leads WHERE id = $1 AND organization_id = $2
      `, [leadId, organizationId]);

      if (leadResult.rows.length === 0) {
        throw new Error('Lead not found');
      }

      const lead = leadResult.rows[0];

      const contactData = {
        title: lead.title,
        company: lead.company,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        priority: lead.priority,
        value: lead.value,
        notes: lead.notes,
        assigned_to: lead.assigned_to,
        converted_from_lead_id: leadId,
        ...additionalData
      };

      const contactResult = await client.query(`
        INSERT INTO contacts (
          organization_id, title, company, first_name, last_name, email, phone,
          source, priority, value, notes, assigned_to, created_by, converted_from_lead_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `, [
        organizationId,
        contactData.title,
        contactData.company,
        contactData.first_name,
        contactData.last_name,
        contactData.email,
        contactData.phone,
        contactData.source,
        contactData.priority,
        parseFloat(contactData.value),
        contactData.notes,
        contactData.assigned_to,
        convertedBy,
        leadId
      ]);

      await client.query(`
        UPDATE leads SET status = 'converted', updated_at = NOW() 
        WHERE id = $1 AND organization_id = $2
      `, [leadId, organizationId]);

      return new Contact(contactResult.rows[0]);
    }, organizationId);
  }

  /**
   * Get software editions
   * @param {string} organizationId - Organization ID
   * @returns {Array} Software editions
   */
  static async getEditions(organizationId) {
    const result = await query(`
      SELECT * FROM software_editions 
      WHERE organization_id = $1 
      ORDER BY created_at DESC
    `, [organizationId], organizationId);

    return result.rows;
  }

  /**
   * Create software edition
   * @param {Object} editionData - Edition data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - User creating the edition
   * @returns {Object} Created edition
   */
  static async createEdition(editionData, organizationId, createdBy) {
    const { name, version, description, price, features, is_active = true } = editionData;

    if (!name || !version) {
      throw new Error('Missing required fields: name, version');
    }

    const result = await query(`
      INSERT INTO software_editions (
        organization_id, name, version, description, price, features, is_active, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      organizationId,
      name,
      version,
      description,
      parseFloat(price) || 0,
      JSON.stringify(features || []),
      is_active,
      createdBy
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Create account for contact
   * @param {Object} accountData - Account data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - User creating the account
   * @returns {Object} Created account
   */
  static async createAccount(accountData, organizationId, createdBy) {
    const {
      contact_id,
      account_name,
      account_type = 'business',
      status = 'active',
      billing_address,
      shipping_address,
      payment_terms,
      credit_limit
    } = accountData;

    if (!contact_id || !account_name) {
      throw new Error('Missing required fields: contact_id, account_name');
    }

    const result = await query(`
      INSERT INTO accounts (
        organization_id, contact_id, account_name, account_type, status,
        billing_address, shipping_address, payment_terms, credit_limit, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      organizationId,
      contact_id,
      account_name,
      account_type,
      status,
      JSON.stringify(billing_address || {}),
      JSON.stringify(shipping_address || {}),
      payment_terms,
      parseFloat(credit_limit) || 0,
      createdBy
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Get accounts
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Accounts
   */
  static async getAccounts(organizationId, options = {}) {
    const { contact_id, status, account_type } = options;

    let query_text = `
      SELECT a.*, c.first_name, c.last_name, c.email
      FROM accounts a
      LEFT JOIN contacts c ON a.contact_id = c.id
      WHERE a.organization_id = $1
    `;
    
    const params = [organizationId];
    let paramCount = 1;

    if (contact_id) {
      query_text += ` AND a.contact_id = $${++paramCount}`;
      params.push(contact_id);
    }

    if (status) {
      query_text += ` AND a.status = $${++paramCount}`;
      params.push(status);
    }

    if (account_type) {
      query_text += ` AND a.account_type = $${++paramCount}`;
      params.push(account_type);
    }

    query_text += ` ORDER BY a.created_at DESC`;

    const result = await query(query_text, params, organizationId);
    return result.rows;
  }

  /**
   * Register device with MAC address tracking
   * @param {Object} deviceData - Device data
   * @param {string} organizationId - Organization ID
   * @returns {Object} Registered device
   */
  static async registerDevice(deviceData, organizationId) {
    const {
      contact_id,
      device_name,
      mac_address,
      device_type,
      os_info,
      hardware_info,
      license_id
    } = deviceData;

    if (!contact_id || !mac_address) {
      throw new Error('Missing required fields: contact_id, mac_address');
    }

    const result = await query(`
      INSERT INTO devices (
        organization_id, contact_id, device_name, mac_address, device_type,
        os_info, hardware_info, license_id, registered_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `, [
      organizationId,
      contact_id,
      device_name || 'Unknown Device',
      mac_address.toUpperCase(),
      device_type,
      JSON.stringify(os_info || {}),
      JSON.stringify(hardware_info || {}),
      license_id
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Get registered devices
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Devices
   */
  static async getDevices(organizationId, options = {}) {
    const { contact_id, license_id, mac_address } = options;

    let query_text = `
      SELECT d.*, c.first_name, c.last_name, l.license_key
      FROM devices d
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN licenses l ON d.license_id = l.id
      WHERE d.organization_id = $1
    `;
    
    const params = [organizationId];
    let paramCount = 1;

    if (contact_id) {
      query_text += ` AND d.contact_id = $${++paramCount}`;
      params.push(contact_id);
    }

    if (license_id) {
      query_text += ` AND d.license_id = $${++paramCount}`;
      params.push(license_id);
    }

    if (mac_address) {
      query_text += ` AND d.mac_address = $${++paramCount}`;
      params.push(mac_address.toUpperCase());
    }

    query_text += ` ORDER BY d.registered_at DESC`;

    const result = await query(query_text, params, organizationId);
    return result.rows;
  }

  /**
   * Generate license
   * @param {Object} licenseData - License data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - User creating the license
   * @returns {Object} Generated license
   */
  static async generateLicense(licenseData, organizationId, createdBy) {
    const {
      contact_id,
      edition_id,
      license_type = 'standard',
      duration_months = 12,
      max_devices = 1,
      custom_features
    } = licenseData;

    if (!contact_id || !edition_id) {
      throw new Error('Missing required fields: contact_id, edition_id');
    }

    const license_key = this.generateLicenseKey();
    const expires_at = new Date();
    expires_at.setMonth(expires_at.getMonth() + duration_months);

    const result = await query(`
      INSERT INTO licenses (
        organization_id, contact_id, edition_id, license_key, license_type,
        expires_at, max_devices, custom_features, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9)
      RETURNING *
    `, [
      organizationId,
      contact_id,
      edition_id,
      license_key,
      license_type,
      expires_at,
      max_devices,
      JSON.stringify(custom_features || {}),
      createdBy
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Get licenses
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Licenses
   */
  static async getLicenses(organizationId, options = {}) {
    const { contact_id, status, license_type, expired_only } = options;

    let query_text = `
      SELECT l.*, c.first_name, c.last_name, c.email, se.name as edition_name, se.version
      FROM licenses l
      LEFT JOIN contacts c ON l.contact_id = c.id
      LEFT JOIN software_editions se ON l.edition_id = se.id
      WHERE l.organization_id = $1
    `;
    
    const params = [organizationId];
    let paramCount = 1;

    if (contact_id) {
      query_text += ` AND l.contact_id = $${++paramCount}`;
      params.push(contact_id);
    }

    if (status) {
      query_text += ` AND l.status = $${++paramCount}`;
      params.push(status);
    }

    if (license_type) {
      query_text += ` AND l.license_type = $${++paramCount}`;
      params.push(license_type);
    }

    if (expired_only) {
      query_text += ` AND l.expires_at < NOW()`;
    }

    query_text += ` ORDER BY l.created_at DESC`;

    const result = await query(query_text, params, organizationId);
    return result.rows;
  }

  /**
   * Create trial
   * @param {Object} trialData - Trial data
   * @param {string} organizationId - Organization ID
   * @returns {Object} Created trial
   */
  static async createTrial(trialData, organizationId) {
    const {
      contact_id,
      edition_id,
      trial_days = 30,
      features_enabled
    } = trialData;

    if (!contact_id || !edition_id) {
      throw new Error('Missing required fields: contact_id, edition_id');
    }

    const expires_at = new Date();
    expires_at.setDate(expires_at.getDate() + trial_days);
    const trial_key = this.generateTrialKey();

    const result = await query(`
      INSERT INTO trials (
        organization_id, contact_id, edition_id, trial_key, expires_at,
        features_enabled, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'active')
      RETURNING *
    `, [
      organizationId,
      contact_id,
      edition_id,
      trial_key,
      expires_at,
      JSON.stringify(features_enabled || {})
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Get trials
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Trials
   */
  static async getTrials(organizationId, options = {}) {
    const { contact_id, status, active_only } = options;

    let query_text = `
      SELECT t.*, c.first_name, c.last_name, c.email, se.name as edition_name
      FROM trials t
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN software_editions se ON t.edition_id = se.id
      WHERE t.organization_id = $1
    `;
    
    const params = [organizationId];
    let paramCount = 1;

    if (contact_id) {
      query_text += ` AND t.contact_id = $${++paramCount}`;
      params.push(contact_id);
    }

    if (status) {
      query_text += ` AND t.status = $${++paramCount}`;
      params.push(status);
    }

    if (active_only) {
      query_text += ` AND t.status = 'active' AND t.expires_at > NOW()`;
    }

    query_text += ` ORDER BY t.created_at DESC`;

    const result = await query(query_text, params, organizationId);
    return result.rows;
  }

  /**
   * Transfer license with time calculations
   * @param {string} licenseId - License ID to transfer
   * @param {string} newContactId - New contact ID
   * @param {string} organizationId - Organization ID
   * @param {string} transferredBy - User performing transfer
   * @returns {Object} Transfer result
   */
  static async transferLicense(licenseId, newContactId, organizationId, transferredBy) {
    return await transaction(async (client) => {
      const licenseResult = await client.query(`
        SELECT l.*, c.first_name as old_first_name, c.last_name as old_last_name
        FROM licenses l
        LEFT JOIN contacts c ON l.contact_id = c.id
        WHERE l.id = $1 AND l.organization_id = $2
      `, [licenseId, organizationId]);

      if (licenseResult.rows.length === 0) {
        throw new Error('License not found');
      }

      const license = licenseResult.rows[0];
      const now = new Date();
      const remainingTime = new Date(license.expires_at) - now;
      const remainingDays = Math.max(0, Math.ceil(remainingTime / (1000 * 60 * 60 * 24)));

      const transferResult = await client.query(`
        INSERT INTO license_transfers (
          organization_id, license_id, old_contact_id, new_contact_id,
          transferred_by, transferred_at, remaining_days, notes
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
        RETURNING *
      `, [
        organizationId,
        licenseId,
        license.contact_id,
        newContactId,
        transferredBy,
        remainingDays,
        `License transferred with ${remainingDays} days remaining`
      ]);

      await client.query(`
        UPDATE licenses
        SET contact_id = $1, updated_at = NOW()
        WHERE id = $2 AND organization_id = $3
      `, [newContactId, licenseId, organizationId]);

      await client.query(`
        UPDATE devices
        SET contact_id = $1
        WHERE license_id = $2 AND organization_id = $3
      `, [newContactId, licenseId, organizationId]);

      return {
        transfer: transferResult.rows[0],
        remaining_days: remainingDays,
        old_contact: {
          first_name: license.old_first_name,
          last_name: license.old_last_name
        }
      };
    }, organizationId);
  }

  /**
   * Record software download
   * @param {Object} downloadData - Download data
   * @param {string} organizationId - Organization ID
   * @returns {Object} Download record
   */
  static async recordDownload(downloadData, organizationId) {
    const {
      contact_id,
      edition_id,
      license_id,
      trial_id,
      download_url,
      ip_address,
      user_agent,
      file_size,
      version
    } = downloadData;

    const result = await query(`
      INSERT INTO downloads (
        organization_id, contact_id, edition_id, license_id, trial_id,
        download_url, ip_address, user_agent, file_size, version, downloaded_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING *
    `, [
      organizationId,
      contact_id,
      edition_id,
      license_id,
      trial_id,
      download_url,
      ip_address,
      user_agent,
      file_size,
      version
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Record software activation
   * @param {Object} activationData - Activation data
   * @param {string} organizationId - Organization ID
   * @returns {Object} Activation record
   */
  static async recordActivation(activationData, organizationId) {
    const {
      contact_id,
      license_id,
      trial_id,
      device_id,
      activation_key,
      ip_address,
      hardware_fingerprint,
      software_version
    } = activationData;

    const result = await query(`
      INSERT INTO activations (
        organization_id, contact_id, license_id, trial_id, device_id,
        activation_key, ip_address, hardware_fingerprint, software_version, activated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `, [
      organizationId,
      contact_id,
      license_id,
      trial_id,
      device_id,
      activation_key,
      ip_address,
      hardware_fingerprint,
      software_version
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Get contact statistics
   * @param {string} organizationId - Organization ID
   * @returns {Object} Contact statistics
   */
  static async getStats(organizationId) {
    try {
      console.log('Getting contact stats for organization:', organizationId);
      
      // First check if contacts table exists
      const tableCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'contacts'
      `, []);
      
      console.log('Contacts table check result:', tableCheck.rows);
      
      if (tableCheck.rows.length === 0) {
        console.error('Contacts table does not exist! Creating it automatically...');
        
        // Auto-create the contacts table
        await query(`
          CREATE TABLE IF NOT EXISTS contacts (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            title VARCHAR(255),
            company VARCHAR(255),
            first_name VARCHAR(100) NOT NULL,
            last_name VARCHAR(100) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            status VARCHAR(50) DEFAULT 'active',
            type VARCHAR(50) DEFAULT 'customer',
            source VARCHAR(100),
            priority VARCHAR(20) DEFAULT 'medium',
            value DECIMAL(10,2) DEFAULT 0,
            notes TEXT,
            assigned_to UUID REFERENCES users(id),
            created_by UUID REFERENCES users(id),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            last_contact_date TIMESTAMP WITH TIME ZONE,
            next_follow_up TIMESTAMP WITH TIME ZONE,
            converted_from_lead_id UUID REFERENCES leads(id)
          )
        `);
        
        // Create indexes
        await query(`
          CREATE INDEX IF NOT EXISTS idx_contacts_organization_id ON contacts(organization_id);
          CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
          CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);
          CREATE INDEX IF NOT EXISTS idx_contacts_type ON contacts(type);
        `);
        
        console.log('✅ Contacts table auto-created successfully');
      }

      const statsQuery = `
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_contacts,
          COUNT(CASE WHEN type = 'customer' THEN 1 END) as customers,
          COUNT(CASE WHEN type = 'prospect' THEN 1 END) as prospects,
          COUNT(CASE WHEN converted_from_lead_id IS NOT NULL THEN 1 END) as converted_from_leads,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
          COALESCE(SUM(value), 0) as total_value,
          COALESCE(AVG(value), 0) as average_value
        FROM contacts 
        WHERE organization_id = $1
      `;

      const result = await query(statsQuery, [organizationId], organizationId);
      return result.rows[0];
    } catch (error) {
      console.error('Error in getStats:', error);
      throw error;
    }
  }

  /**
   * Generate license key
   * @returns {string} License key
   */
  static generateLicenseKey() {
    const segments = [];
    for (let i = 0; i < 4; i++) {
      segments.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return segments.join('-');
  }

  /**
   * Generate trial key
   * @returns {string} Trial key
   */
  static generateTrialKey() {
    return 'TRIAL-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  }

  /**
   * Get full name of contact
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
      status: this.status,
      type: this.type,
      source: this.source,
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
      next_follow_up: this.next_follow_up,
      converted_from_lead_id: this.converted_from_lead_id,
      converted_from_lead: this.converted_from_lead
    };
  }
}

module.exports = Contact;