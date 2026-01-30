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

    // Additional contact fields
    this.department = data.department;
    this.linkedin = data.linkedin;
    this.customer_value = data.customer_value;

    // Address fields
    this.address_line1 = data.address_line1;
    this.address_line2 = data.address_line2;
    this.city = data.city;
    this.state = data.state;
    this.postal_code = data.postal_code;
    this.country = data.country;

    // Store custom fields from JSONB column
    this.custom_fields = data.custom_fields || {};
  }

  /**
   * Create a new contact
   * @param {Object} contactData - Contact data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - ID of user creating this contact
   * @returns {Contact} Created contact instance
   */
  static async create(contactData, organizationId, createdBy) {
    // Define standard fields that map to database columns
    const standardFieldNames = [
      'title', 'company', 'first_name', 'last_name', 'email', 'phone',
      'status', 'type', 'source', 'priority', 'value', 'notes',
      'assigned_to', 'next_follow_up', 'converted_from_lead_id',
      'department', 'linkedin', 'customer_value', 'last_contact_date',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'
    ];

    // Separate standard fields from custom fields
    const standardData = {};
    const customFields = {};

    Object.keys(contactData).forEach(key => {
      if (standardFieldNames.includes(key)) {
        standardData[key] = contactData[key];
      } else {
        customFields[key] = contactData[key];
      }
    });

    // Extract standard fields with defaults
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
    } = standardData;

    if (!first_name || !last_name || !organizationId) {
      throw new Error('Missing required fields: first_name, last_name');
    }

    // Convert empty email string to null to avoid unique constraint issues
    const normalizedEmail = email && email.trim() !== '' ? email : null;

    try {
      const result = await query(`
        INSERT INTO contacts (
          organization_id, title, company, first_name, last_name, email, phone,
          status, source, priority, lifetime_value, notes, assigned_to, created_by,
          next_follow_up, custom_fields
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        organizationId,
        title,
        company,
        first_name,
        last_name,
        normalizedEmail,
        phone,
        status,
        source,
        priority,
        parseFloat(value), // maps to lifetime_value
        notes,
        assigned_to,
        createdBy,
        next_follow_up,
        JSON.stringify(customFields) // Store custom fields as JSONB
      ], organizationId);

      console.log('✅ Created contact with custom fields:', Object.keys(customFields));

      return new Contact(result.rows[0]);
    } catch (error) {
      // Only throw "email already exists" error if email was actually provided and the error is about duplicate key
      if (error.message.includes('duplicate key') && normalizedEmail) {
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
   * Get contacts with full-text search, pagination, and aggregated data
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Object} Contacts with pagination info and calculated fields
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
        limit = 10000,
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

      // Build WHERE conditions
      let whereConditions = ['c.organization_id = $1'];
      const params = [organizationId];
      let paramCount = 1;

      if (status) {
        whereConditions.push(`c.status = $${++paramCount}`);
        params.push(status);
      }

      if (type) {
        whereConditions.push(`c.type = $${++paramCount}`);
        params.push(type);
      }

      if (priority) {
        whereConditions.push(`c.priority = $${++paramCount}`);
        params.push(priority);
      }

      if (assigned_to) {
        whereConditions.push(`c.assigned_to = $${++paramCount}`);
        params.push(assigned_to);
      }

      if (source) {
        whereConditions.push(`c.source ILIKE $${++paramCount}`);
        params.push(`%${source}%`);
      }

      if (search) {
        whereConditions.push(`(
          c.first_name ILIKE $${++paramCount} OR
          c.last_name ILIKE $${paramCount} OR
          c.name ILIKE $${paramCount} OR
          c.company ILIKE $${paramCount} OR
          c.email ILIKE $${paramCount} OR
          c.phone ILIKE $${paramCount} OR
          c.notes ILIKE $${paramCount}
        )`);
        params.push(`%${search}%`);
      }

      const whereClause = whereConditions.join(' AND ');

      // Valid sort fields
      const validSorts = ['created_at', 'updated_at', 'first_name', 'last_name', 'company', 'status', 'name'];
      const sortField = validSorts.includes(sort) ? `c.${sort}` : 'c.created_at';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Main query with aggregations and JOINs
      const query_text = `
        SELECT
          c.id,
          c.organization_id,
          c.first_name,
          c.last_name,
          COALESCE(c.name, c.first_name || ' ' || c.last_name) as name,
          c.email,
          c.phone,
          c.company,
          c.title,
          c.website,
          c.status,
          c.type,
          c.source,
          c.priority,
          c.lifetime_value as value,
          c.notes,
          c.assigned_to,
          c.created_by,
          c.created_at,
          c.updated_at,
          c.last_contact_date,
          c.next_follow_up,
          c.converted_from_lead_id,
          c.first_purchase_date,
          c.last_purchase_date,

          -- Calculated fields: Accounts count
          COUNT(DISTINCT a.id)::integer as accounts_count,

          -- Calculated fields: Transactions count (from both contact_id and account_id)
          COUNT(DISTINCT t.id)::integer as transactions_count,

          -- Calculated fields: Total revenue (sum of all non-cancelled transactions)
          COALESCE(SUM(
            CASE
              WHEN t.status IS NULL OR t.status != 'cancelled' THEN t.amount
              ELSE 0
            END
          ), 0)::numeric as total_revenue,

          -- Calculated fields: Customer since (earliest transaction or account date)
          LEAST(
            MIN(t.transaction_date),
            MIN(a.created_at),
            c.first_purchase_date
          ) as customer_since,

          -- Calculated fields: Last interaction date
          c.last_contact_date as last_interaction_date,

          -- Calculated fields: Next renewal (earliest future expiry date)
          MIN(
            CASE
              WHEN a.next_renewal_date > NOW() THEN a.next_renewal_date
              ELSE NULL
            END
          ) as next_renewal_date,

          -- Calculated fields: Days until renewal
          EXTRACT(
            DAY FROM (
              MIN(
                CASE
                  WHEN a.next_renewal_date > NOW() THEN a.next_renewal_date
                  ELSE NULL
                END
              ) - NOW()
            )
          )::integer as days_until_renewal

        FROM contacts c

        LEFT JOIN accounts a
          ON a.contact_id = c.id
          AND a.organization_id = c.organization_id

        LEFT JOIN transactions t
          ON (t.contact_id = c.id OR t.account_id = a.id)
          AND t.organization_id = c.organization_id

        WHERE ${whereClause}

        GROUP BY
          c.id, c.organization_id, c.first_name, c.last_name, c.name,
          c.email, c.phone, c.company, c.title, c.website,
          c.status, c.type, c.source,
          c.priority, c.lifetime_value, c.notes, c.assigned_to,
          c.created_by, c.created_at, c.updated_at, c.last_contact_date,
          c.next_follow_up, c.converted_from_lead_id, c.first_purchase_date,
          c.last_purchase_date

        ORDER BY ${sortField} ${sortOrder}
        LIMIT $${++paramCount} OFFSET $${++paramCount}
      `;

      params.push(limit, offset);

      const result = await query(query_text, params, organizationId);

      const contacts = result.rows.map(row => {
        // Return raw row data with all calculated fields
        return {
          id: row.id,
          organization_id: row.organization_id,
          first_name: row.first_name,
          last_name: row.last_name,
          name: row.name,
          email: row.email,
          phone: row.phone,
          company: row.company,
          title: row.title,
          website: row.website,
          status: row.status,
          type: row.type,
          source: row.source,
          priority: row.priority,
          value: parseFloat(row.value) || 0,
          notes: row.notes,
          assigned_to: row.assigned_to,
          created_by: row.created_by,
          created_at: row.created_at,
          updated_at: row.updated_at,
          last_contact_date: row.last_contact_date,
          next_follow_up: row.next_follow_up,
          converted_from_lead_id: row.converted_from_lead_id,
          first_purchase_date: row.first_purchase_date,
          last_purchase_date: row.last_purchase_date,
          // Calculated fields
          accounts_count: parseInt(row.accounts_count) || 0,
          transactions_count: parseInt(row.transactions_count) || 0,
          total_revenue: parseFloat(row.total_revenue) || 0,
          customer_since: row.customer_since,
          last_interaction_date: row.last_interaction_date,
          next_renewal_date: row.next_renewal_date,
          days_until_renewal: row.days_until_renewal ? parseInt(row.days_until_renewal) : null
        };
      });

      // Count query (without aggregations for performance)
      let countQuery = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM contacts c
        WHERE ${whereClause}
      `;

      // Remove limit/offset params for count
      const countParams = params.slice(0, -2);
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
    // Define standard fields that map to database columns
    const standardFields = [
      'title', 'company', 'first_name', 'last_name', 'email', 'phone',
      'type', 'status', 'source', 'priority', 'notes', 'assigned_to',
      'last_contact_date', 'next_follow_up', 'department', 'linkedin', 'customer_value',
      'address_line1', 'address_line2', 'city', 'state', 'postal_code', 'country'
    ];

    // Separate standard fields from custom fields
    const standardUpdates = {};
    const customUpdates = {};

    Object.keys(updates).forEach(key => {
      if (standardFields.includes(key)) {
        standardUpdates[key] = updates[key];
      } else {
        // Everything else goes to custom_fields JSONB
        customUpdates[key] = updates[key];
      }
    });

    // Need at least one field to update
    if (Object.keys(standardUpdates).length === 0 && Object.keys(customUpdates).length === 0) {
      throw new Error('No valid fields to update');
    }

    // Build the update clause
    const setClauses = [];
    const values = [id, organizationId];
    let paramIndex = 3;

    // Handle standard field updates
    for (const field of Object.keys(standardUpdates)) {
      let value = standardUpdates[field];

      // Convert empty strings to null
      if (['email', 'phone', 'notes', 'title', 'company'].includes(field)) {
        if (value === '' || value === undefined) {
          value = null;
        }
      }

      setClauses.push(`${field} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }

    // Handle custom field updates - merge into custom_fields JSONB
    if (Object.keys(customUpdates).length > 0) {
      setClauses.push(`custom_fields = COALESCE(custom_fields, '{}'::jsonb) || $${paramIndex}::jsonb`);
      values.push(JSON.stringify(customUpdates));
      paramIndex++;
    }

    const setClause = setClauses.join(', ');

    try {
      console.log('📝 Updating contact:', id);
      console.log('  Standard fields:', Object.keys(standardUpdates));
      console.log('  Custom fields:', Object.keys(customUpdates));

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
    } catch (error) {
      console.error('❌ Contact.update error:', error.message);
      console.error('Details:', error);
      throw error;
    }
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
      // Set user context for triggers
      await client.query('SET app.current_user_id = $1', [convertedBy]);

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

      // First, check what columns actually exist in the table
      const columnCheck = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'contacts' AND table_schema = 'public'
      `, [], organizationId);
      
      const existingColumns = columnCheck.rows.map(row => row.column_name);
      console.log('Existing columns in contacts table:', existingColumns);
      
      // Build stats query based on available columns
      const hasType = existingColumns.includes('type');
      const hasConvertedFromLead = existingColumns.includes('converted_from_lead_id');
      const hasValue = existingColumns.includes('value');
      
      const statsQuery = `
        SELECT 
          COUNT(*) as total_contacts,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_contacts,
          ${hasType ? "COUNT(CASE WHEN type = 'customer' THEN 1 END)" : "0"} as customers,
          ${hasType ? "COUNT(CASE WHEN type = 'prospect' THEN 1 END)" : "0"} as prospects,
          ${hasConvertedFromLead ? "COUNT(CASE WHEN converted_from_lead_id IS NOT NULL THEN 1 END)" : "0"} as converted_from_leads,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_this_week,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month,
          ${hasValue ? "COALESCE(SUM(value), 0)" : "0"} as total_value,
          ${hasValue ? "COALESCE(AVG(value), 0)" : "0"} as average_value
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
   * Create contact interaction
   * @param {Object} interactionData - Interaction data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - ID of user creating this interaction
   * @returns {Object} Created interaction
   */
  static async createInteraction(interactionData, organizationId, createdBy) {
    const {
      contact_id,
      interaction_type, // email, call, meeting, note, support_ticket
      direction, // inbound, outbound
      subject,
      content,
      duration_minutes,
      email_message_id
    } = interactionData;

    const result = await query(`
      INSERT INTO contact_interactions (
        contact_id, organization_id, interaction_type, direction,
        subject, content, duration_minutes, email_message_id, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      contact_id, organizationId, interaction_type, direction,
      subject, content, duration_minutes, email_message_id, createdBy
    ], organizationId);

    // Update last contact date for the contact
    await query(`
      UPDATE contacts
      SET last_contact_date = NOW(), updated_at = NOW()
      WHERE id = $1 AND organization_id = $2
    `, [contact_id, organizationId], organizationId);

    return result.rows[0];
  }

  /**
   * Get contact interactions
   * @param {string} contactId - Contact ID
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Contact interactions
   */
  static async getInteractions(contactId, organizationId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      interaction_type,
      direction,
      sort = 'created_at',
      order = 'desc'
    } = options;

    let whereClause = 'WHERE ci.contact_id = $1 AND ci.organization_id = $2';
    const params = [contactId, organizationId];
    let paramCount = 2;

    if (interaction_type) {
      paramCount++;
      whereClause += ` AND ci.interaction_type = $${paramCount}`;
      params.push(interaction_type);
    }

    if (direction) {
      paramCount++;
      whereClause += ` AND ci.direction = $${paramCount}`;
      params.push(direction);
    }

    const result = await query(`
      SELECT
        ci.*,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name,
        u.email as created_by_email
      FROM contact_interactions ci
      LEFT JOIN users u ON ci.created_by = u.id
      ${whereClause}
      ORDER BY ci.${sort} ${order}
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset], organizationId);

    return result.rows.map(row => ({
      ...row,
      created_by_user: row.created_by_first_name ? {
        id: row.created_by,
        first_name: row.created_by_first_name,
        last_name: row.created_by_last_name,
        full_name: `${row.created_by_first_name} ${row.created_by_last_name}`.trim(),
        email: row.created_by_email
      } : null
    }));
  }

  /**
   * Get interaction statistics for a contact
   * @param {string} contactId - Contact ID
   * @param {string} organizationId - Organization ID
   * @returns {Object} Interaction statistics
   */
  static async getInteractionStats(contactId, organizationId) {
    const result = await query(`
      SELECT
        COUNT(*) as total_interactions,
        COUNT(CASE WHEN interaction_type = 'email' THEN 1 END) as emails,
        COUNT(CASE WHEN interaction_type = 'call' THEN 1 END) as calls,
        COUNT(CASE WHEN interaction_type = 'meeting' THEN 1 END) as meetings,
        COUNT(CASE WHEN interaction_type = 'note' THEN 1 END) as notes,
        COUNT(CASE WHEN interaction_type = 'support_ticket' THEN 1 END) as support_tickets,
        COUNT(CASE WHEN direction = 'inbound' THEN 1 END) as inbound,
        COUNT(CASE WHEN direction = 'outbound' THEN 1 END) as outbound,
        MAX(created_at) as last_interaction_date,
        AVG(CASE WHEN interaction_type = 'call' AND duration_minutes IS NOT NULL
                 THEN duration_minutes END) as avg_call_duration
      FROM contact_interactions
      WHERE contact_id = $1 AND organization_id = $2
    `, [contactId, organizationId], organizationId);

    const stats = result.rows[0];
    return {
      total_interactions: parseInt(stats.total_interactions) || 0,
      emails: parseInt(stats.emails) || 0,
      calls: parseInt(stats.calls) || 0,
      meetings: parseInt(stats.meetings) || 0,
      notes: parseInt(stats.notes) || 0,
      support_tickets: parseInt(stats.support_tickets) || 0,
      inbound: parseInt(stats.inbound) || 0,
      outbound: parseInt(stats.outbound) || 0,
      last_interaction_date: stats.last_interaction_date,
      avg_call_duration: parseFloat(stats.avg_call_duration) || 0
    };
  }

  /**
   * Update contact interaction
   * @param {string} interactionId - Interaction ID
   * @param {Object} updateData - Data to update
   * @param {string} organizationId - Organization ID
   * @returns {Object} Updated interaction
   */
  static async updateInteraction(interactionId, updateData, organizationId) {
    const {
      interaction_type,
      direction,
      subject,
      content,
      duration_minutes,
      email_message_id
    } = updateData;

    const result = await query(`
      UPDATE contact_interactions
      SET
        interaction_type = COALESCE($1, interaction_type),
        direction = COALESCE($2, direction),
        subject = COALESCE($3, subject),
        content = COALESCE($4, content),
        duration_minutes = COALESCE($5, duration_minutes),
        email_message_id = COALESCE($6, email_message_id),
        updated_at = NOW()
      WHERE id = $7 AND organization_id = $8
      RETURNING *
    `, [
      interaction_type, direction, subject, content,
      duration_minutes, email_message_id, interactionId, organizationId
    ], organizationId);

    return result.rows[0];
  }

  /**
   * Delete contact interaction
   * @param {string} interactionId - Interaction ID
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Success status
   */
  static async deleteInteraction(interactionId, organizationId) {
    const result = await query(`
      DELETE FROM contact_interactions
      WHERE id = $1 AND organization_id = $2
    `, [interactionId, organizationId], organizationId);

    return result.rowCount > 0;
  }

  /**
   * Get recent interactions across all contacts
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Recent interactions
   */
  static async getRecentInteractions(organizationId, options = {}) {
    const {
      limit = 20,
      offset = 0,
      interaction_type,
      days = 30
    } = options;

    let whereClause = `WHERE ci.organization_id = $1
                      AND ci.created_at >= NOW() - INTERVAL '${days} days'`;
    const params = [organizationId];
    let paramCount = 1;

    if (interaction_type) {
      paramCount++;
      whereClause += ` AND ci.interaction_type = $${paramCount}`;
      params.push(interaction_type);
    }

    const result = await query(`
      SELECT
        ci.*,
        c.first_name as contact_first_name,
        c.last_name as contact_last_name,
        c.company as contact_company,
        u.first_name as created_by_first_name,
        u.last_name as created_by_last_name
      FROM contact_interactions ci
      JOIN contacts c ON ci.contact_id = c.id
      LEFT JOIN users u ON ci.created_by = u.id
      ${whereClause}
      ORDER BY ci.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, [...params, limit, offset], organizationId);

    return result.rows.map(row => ({
      ...row,
      contact: {
        id: row.contact_id,
        first_name: row.contact_first_name,
        last_name: row.contact_last_name,
        full_name: `${row.contact_first_name} ${row.contact_last_name}`.trim(),
        company: row.contact_company
      },
      created_by_user: row.created_by_first_name ? {
        id: row.created_by,
        first_name: row.created_by_first_name,
        last_name: row.created_by_last_name,
        full_name: `${row.created_by_first_name} ${row.created_by_last_name}`.trim()
      } : null
    }));
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
      converted_from_lead: this.converted_from_lead,
      department: this.department,
      linkedin: this.linkedin,
      customer_value: this.customer_value,
      address_line1: this.address_line1,
      address_line2: this.address_line2,
      city: this.city,
      state: this.state,
      postal_code: this.postal_code,
      country: this.country,
      custom_fields: this.custom_fields,
      // Merge custom fields at the top level
      ...this.custom_fields
    };
  }
}

module.exports = Contact;