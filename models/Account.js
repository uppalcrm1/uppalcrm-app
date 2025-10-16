const db = require('../database/connection');

class Account {
  constructor(data) {
    this.id = data.id;
    this.organizationId = data.organization_id;
    this.contactId = data.contact_id;
    this.accountName = data.account_name;
    this.accountType = data.account_type;
    this.edition = data.edition;
    this.deviceName = data.device_name;
    this.macAddress = data.mac_address;
    this.deviceRegisteredAt = data.device_registered_at;
    this.licenseKey = data.license_key;
    this.licenseStatus = data.license_status;
    this.billingCycle = data.billing_cycle;
    this.price = data.price;
    this.currency = data.currency;
    this.isTrial = data.is_trial;
    this.trialStartDate = data.trial_start_date;
    this.trialEndDate = data.trial_end_date;
    this.subscriptionStartDate = data.subscription_start_date;
    this.subscriptionEndDate = data.subscription_end_date;
    this.nextRenewalDate = data.next_renewal_date;
    this.createdBy = data.created_by;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
    this.notes = data.notes;
    this.customFields = data.custom_fields;
  }

  toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      contactId: this.contactId,
      accountName: this.accountName,
      accountType: this.accountType,
      edition: this.edition,
      deviceName: this.deviceName,
      macAddress: this.macAddress,
      deviceRegisteredAt: this.deviceRegisteredAt,
      licenseKey: this.licenseKey,
      licenseStatus: this.licenseStatus,
      billingCycle: this.billingCycle,
      price: parseFloat(this.price) || 0,
      currency: this.currency,
      isTrial: this.isTrial,
      trialStartDate: this.trialStartDate,
      trialEndDate: this.trialEndDate,
      subscriptionStartDate: this.subscriptionStartDate,
      subscriptionEndDate: this.subscriptionEndDate,
      nextRenewalDate: this.nextRenewalDate,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      notes: this.notes,
      customFields: this.customFields
    };
  }

  /**
   * Get all accounts with pagination and filters
   */
  static async findAll(organizationId, filters = {}) {
    try {
      const {
        page = 1,
        limit = 20,
        contactId,
        accountType,
        licenseStatus,
        isTrial,
        search,
        sort = 'created_at',
        order = 'desc'
      } = filters;

      const offset = (page - 1) * limit;

      // Build WHERE conditions
      let whereConditions = ['a.organization_id = $1'];
      let queryParams = [organizationId];
      let paramIndex = 2;

      if (contactId) {
        whereConditions.push(`a.contact_id = $${paramIndex}`);
        queryParams.push(contactId);
        paramIndex++;
      }

      if (accountType) {
        whereConditions.push(`a.account_type = $${paramIndex}`);
        queryParams.push(accountType);
        paramIndex++;
      }

      if (licenseStatus) {
        whereConditions.push(`a.license_status = $${paramIndex}`);
        queryParams.push(licenseStatus);
        paramIndex++;
      }

      if (isTrial !== undefined) {
        whereConditions.push(`a.is_trial = $${paramIndex}`);
        queryParams.push(isTrial);
        paramIndex++;
      }

      if (search) {
        whereConditions.push(`(
          a.account_name ILIKE $${paramIndex} OR
          a.device_name ILIKE $${paramIndex} OR
          a.mac_address ILIKE $${paramIndex} OR
          c.first_name ILIKE $${paramIndex} OR
          c.last_name ILIKE $${paramIndex}
        )`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const whereClause = whereConditions.join(' AND ');

      // Validate sort column
      const validSortColumns = ['created_at', 'updated_at', 'account_name', 'next_renewal_date', 'trial_end_date'];
      const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
      const orderDirection = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Add pagination parameters
      queryParams.push(limit, offset);

      // Query accounts with contact info
      const result = await db.query(`
        SELECT a.*,
               c.first_name, c.last_name, c.email, c.phone, c.company
        FROM accounts a
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE ${whereClause}
        ORDER BY a.${sortColumn} ${orderDirection}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, queryParams);

      // Get total count
      const countParams = queryParams.slice(0, -2);
      const countResult = await db.query(`
        SELECT COUNT(*) as total
        FROM accounts a
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE ${whereClause}
      `, countParams);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      return {
        accounts: result.rows.map(row => {
          const account = new Account(row);
          account.contact = {
            firstName: row.first_name,
            lastName: row.last_name,
            email: row.email,
            phone: row.phone,
            company: row.company
          };
          return account;
        }),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1
        }
      };
    } catch (error) {
      console.error('Error finding accounts:', error);
      throw error;
    }
  }

  /**
   * Find account by ID
   */
  static async findById(id, organizationId) {
    try {
      const result = await db.query(`
        SELECT a.*,
               c.first_name, c.last_name, c.email, c.phone, c.company
        FROM accounts a
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE a.id = $1 AND a.organization_id = $2
      `, [id, organizationId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const account = new Account(row);
      account.contact = {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        company: row.company
      };

      return account;
    } catch (error) {
      console.error('Error finding account by ID:', error);
      throw error;
    }
  }

  /**
   * Find all accounts for a specific contact
   */
  static async findByContactId(contactId, organizationId) {
    try {
      const result = await db.query(`
        SELECT a.*,
               c.first_name, c.last_name, c.email, c.phone, c.company
        FROM accounts a
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE a.contact_id = $1 AND a.organization_id = $2
        ORDER BY a.created_at DESC
      `, [contactId, organizationId]);

      return result.rows.map(row => {
        const account = new Account(row);
        account.contact = {
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          company: row.company
        };
        return account;
      });
    } catch (error) {
      console.error('Error finding accounts by contact ID:', error);
      throw error;
    }
  }

  /**
   * Create new account
   */
  static async create(data, organizationId, userId) {
    try {
      const result = await db.query(`
        INSERT INTO accounts (
          organization_id, contact_id, account_name, account_type,
          edition, device_name, mac_address, license_key, license_status,
          billing_cycle, price, currency, is_trial, trial_start_date,
          trial_end_date, subscription_start_date, subscription_end_date,
          next_renewal_date, notes, custom_fields, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING *
      `, [
        organizationId,
        data.contactId,
        data.accountName,
        data.accountType || 'trial',
        data.edition,
        data.deviceName,
        data.macAddress,
        data.licenseKey,
        data.licenseStatus || 'pending',
        data.billingCycle,
        data.price || 0,
        data.currency || 'USD',
        data.isTrial || false,
        data.trialStartDate,
        data.trialEndDate,
        data.subscriptionStartDate,
        data.subscriptionEndDate,
        data.nextRenewalDate,
        data.notes,
        JSON.stringify(data.customFields || {}),
        userId
      ]);

      return new Account(result.rows[0]);
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }

  /**
   * Update account
   */
  static async update(id, data, organizationId) {
    try {
      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramIndex = 1;

      const fieldMapping = {
        accountName: 'account_name',
        accountType: 'account_type',
        edition: 'edition',
        deviceName: 'device_name',
        macAddress: 'mac_address',
        deviceRegisteredAt: 'device_registered_at',
        licenseKey: 'license_key',
        licenseStatus: 'license_status',
        billingCycle: 'billing_cycle',
        price: 'price',
        currency: 'currency',
        isTrial: 'is_trial',
        trialStartDate: 'trial_start_date',
        trialEndDate: 'trial_end_date',
        subscriptionStartDate: 'subscription_start_date',
        subscriptionEndDate: 'subscription_end_date',
        nextRenewalDate: 'next_renewal_date',
        notes: 'notes',
        customFields: 'custom_fields'
      };

      for (const [key, dbColumn] of Object.entries(fieldMapping)) {
        if (data[key] !== undefined) {
          updates.push(`${dbColumn} = $${paramIndex}`);
          values.push(key === 'customFields' ? JSON.stringify(data[key]) : data[key]);
          paramIndex++;
        }
      }

      if (updates.length === 0) {
        return await Account.findById(id, organizationId);
      }

      updates.push(`updated_at = NOW()`);
      values.push(id, organizationId);

      const result = await db.query(`
        UPDATE accounts
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND organization_id = $${paramIndex + 1}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return null;
      }

      return new Account(result.rows[0]);
    } catch (error) {
      console.error('Error updating account:', error);
      throw error;
    }
  }

  /**
   * Delete account
   */
  static async delete(id, organizationId) {
    try {
      const result = await db.query(
        'DELETE FROM accounts WHERE id = $1 AND organization_id = $2 RETURNING id',
        [id, organizationId]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }

  /**
   * Get account statistics
   */
  static async getStats(organizationId) {
    try {
      const result = await db.query(`
        SELECT
          COUNT(*) as total_accounts,
          COUNT(CASE WHEN account_type = 'active' THEN 1 END) as active_accounts,
          COUNT(CASE WHEN account_type = 'trial' THEN 1 END) as trial_accounts,
          COUNT(CASE WHEN is_trial = true THEN 1 END) as is_trial_count,
          COUNT(CASE WHEN license_status = 'active' THEN 1 END) as active_licenses,
          COUNT(CASE WHEN license_status = 'pending' THEN 1 END) as pending_licenses,
          COUNT(CASE WHEN license_status = 'expired' THEN 1 END) as expired_licenses,
          COALESCE(SUM(price), 0) as total_revenue,
          COALESCE(AVG(price), 0) as average_price,
          COUNT(CASE WHEN next_renewal_date < NOW() + INTERVAL '30 days' THEN 1 END) as renewals_due_30_days
        FROM accounts
        WHERE organization_id = $1
      `, [organizationId]);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting account stats:', error);
      throw error;
    }
  }

  /**
   * Activate trial period for an account
   */
  static async activateTrial(id, organizationId, trialDays = 30) {
    try {
      const trialStart = new Date();
      const trialEnd = new Date(trialStart.getTime() + (trialDays * 24 * 60 * 60 * 1000));

      const result = await db.query(`
        UPDATE accounts
        SET
          is_trial = true,
          account_type = 'trial',
          trial_start_date = $1,
          trial_end_date = $2,
          license_status = 'active',
          updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING *
      `, [trialStart, trialEnd, id, organizationId]);

      if (result.rows.length === 0) {
        return null;
      }

      return new Account(result.rows[0]);
    } catch (error) {
      console.error('Error activating trial:', error);
      throw error;
    }
  }

  /**
   * Activate license for an account
   */
  static async activateLicense(id, organizationId, licenseData) {
    try {
      const {
        licenseKey,
        billingCycle,
        price,
        durationMonths = 12
      } = licenseData;

      const subscriptionStart = new Date();
      const subscriptionEnd = new Date(subscriptionStart);
      subscriptionEnd.setMonth(subscriptionEnd.getMonth() + durationMonths);

      const nextRenewal = new Date(subscriptionEnd);

      const result = await db.query(`
        UPDATE accounts
        SET
          license_key = $1,
          license_status = 'active',
          billing_cycle = $2,
          price = $3,
          is_trial = false,
          account_type = 'active',
          subscription_start_date = $4,
          subscription_end_date = $5,
          next_renewal_date = $6,
          updated_at = NOW()
        WHERE id = $7 AND organization_id = $8
        RETURNING *
      `, [
        licenseKey,
        billingCycle,
        price,
        subscriptionStart,
        subscriptionEnd,
        nextRenewal,
        id,
        organizationId
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      return new Account(result.rows[0]);
    } catch (error) {
      console.error('Error activating license:', error);
      throw error;
    }
  }

  /**
   * Check if MAC address is already registered
   */
  static async checkMacAddress(macAddress, organizationId) {
    try {
      const result = await db.query(`
        SELECT a.*, c.first_name, c.last_name, c.email
        FROM accounts a
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE a.mac_address = $1 AND a.organization_id = $2
      `, [macAddress.toUpperCase(), organizationId]);

      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error checking MAC address:', error);
      throw error;
    }
  }

  /**
   * Register device with MAC address
   */
  static async registerDevice(id, organizationId, deviceData) {
    try {
      const result = await db.query(`
        UPDATE accounts
        SET
          device_name = $1,
          mac_address = $2,
          device_registered_at = NOW(),
          updated_at = NOW()
        WHERE id = $3 AND organization_id = $4
        RETURNING *
      `, [
        deviceData.deviceName,
        deviceData.macAddress.toUpperCase(),
        id,
        organizationId
      ]);

      if (result.rows.length === 0) {
        return null;
      }

      return new Account(result.rows[0]);
    } catch (error) {
      console.error('Error registering device:', error);
      throw error;
    }
  }

  /**
   * Get accounts expiring soon
   */
  static async getExpiringSoon(organizationId, days = 30) {
    try {
      const result = await db.query(`
        SELECT a.*,
               c.first_name, c.last_name, c.email, c.phone, c.company
        FROM accounts a
        LEFT JOIN contacts c ON a.contact_id = c.id
        WHERE a.organization_id = $1
        AND (
          (a.is_trial = true AND a.trial_end_date <= NOW() + INTERVAL '${days} days' AND a.trial_end_date > NOW())
          OR
          (a.next_renewal_date <= NOW() + INTERVAL '${days} days' AND a.next_renewal_date > NOW())
        )
        ORDER BY
          CASE
            WHEN a.is_trial THEN a.trial_end_date
            ELSE a.next_renewal_date
          END ASC
      `, [organizationId]);

      return result.rows.map(row => {
        const account = new Account(row);
        account.contact = {
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          company: row.company
        };
        return account;
      });
    } catch (error) {
      console.error('Error getting expiring accounts:', error);
      throw error;
    }
  }
}

module.exports = Account;
