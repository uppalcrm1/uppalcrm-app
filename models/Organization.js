const { query, transaction } = require('../database/connection');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

class Organization {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.slug = data.slug;
    this.domain = data.domain;
    this.settings = data.settings || {};
    this.subscription_plan = data.subscription_plan || 'starter';
    this.max_users = data.max_users || 10;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.is_active = data.is_active !== false;
  }

  /**
   * Create a new organization with admin user
   * @param {Object} orgData - Organization data
   * @param {Object} adminData - Admin user data
   * @returns {Object} Created organization and admin user
   */
  static async create(orgData, adminData) {
    const { name, slug, domain } = orgData;
    const { email, password, first_name, last_name } = adminData;

    // Validate required fields
    if (!name || !slug || !email || !password || !first_name || !last_name) {
      throw new Error('Missing required fields');
    }

    // Generate slug if not provided
    const organizationSlug = slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-');

    // Check if slug is already taken
    const existingOrg = await query(
      'SELECT id FROM organizations WHERE slug = $1',
      [organizationSlug]
    );

    if (existingOrg.rows.length > 0) {
      throw new Error('Organization slug already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    try {
      // Create organization and admin user in a transaction
      const result = await query(`
        SELECT organization_id, user_id 
        FROM create_organization_with_admin($1, $2, $3, $4, $5, $6, $7)
      `, [
        name,
        organizationSlug,
        email.toLowerCase(),
        passwordHash,
        first_name,
        last_name,
        domain
      ]);

      if (result.rows.length === 0) {
        throw new Error('Failed to create organization');
      }

      const { organization_id, user_id } = result.rows[0];

      // Return the created organization and admin user
      const org = await Organization.findById(organization_id);
      return {
        organization: org,
        admin_user_id: user_id
      };
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        if (error.message.includes('organizations_slug_key')) {
          throw new Error('Organization slug already exists');
        }
        if (error.message.includes('users_organization_id_email_key')) {
          throw new Error('Email already exists in this organization');
        }
      }
      throw error;
    }
  }

  /**
   * Find organization by ID
   * @param {string} id - Organization ID
   * @returns {Organization|null} Organization instance or null
   */
  static async findById(id) {
    const result = await query(
      'SELECT * FROM organizations WHERE id = $1 AND is_active = true',
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return new Organization(result.rows[0]);
  }

  /**
   * Find organization by slug
   * @param {string} slug - Organization slug
   * @returns {Organization|null} Organization instance or null
   */
  static async findBySlug(slug) {
    const result = await query(
      'SELECT * FROM organizations WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return new Organization(result.rows[0]);
  }

  /**
   * Find organization by domain
   * @param {string} domain - Organization domain
   * @returns {Organization|null} Organization instance or null
   */
  static async findByDomain(domain) {
    const result = await query(
      'SELECT * FROM organizations WHERE domain = $1 AND is_active = true',
      [domain]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return new Organization(result.rows[0]);
  }

  /**
   * Update organization
   * @param {string} id - Organization ID
   * @param {Object} updates - Fields to update
   * @returns {Organization|null} Updated organization
   */
  static async update(id, updates) {
    const allowedFields = ['name', 'domain', 'settings', 'subscription_plan', 'max_users'];
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [id, ...updateFields.map(field => updates[field])];

    const result = await query(`
      UPDATE organizations 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return null;
    }

    return new Organization(result.rows[0]);
  }

  /**
   * Get user count for organization
   * @param {string} organizationId - Organization ID
   * @returns {number} Active user count
   */
  static async getUserCount(organizationId) {
    const result = await query(
      'SELECT COUNT(*) as count FROM users WHERE organization_id = $1 AND is_active = true',
      [organizationId]
    );

    return parseInt(result.rows[0].count);
  }

  /**
   * Check if organization can add more users
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Whether more users can be added
   */
  static async canAddUsers(organizationId) {
    const result = await query(`
      SELECT 
        COUNT(u.id) as user_count,
        o.max_users
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id AND u.is_active = true
      WHERE o.id = $1 AND o.is_active = true
      GROUP BY o.max_users
    `, [organizationId]);

    if (result.rows.length === 0) {
      return false;
    }

    const { user_count, max_users } = result.rows[0];
    return parseInt(user_count) < parseInt(max_users);
  }

  /**
   * Deactivate organization (soft delete)
   * @param {string} id - Organization ID
   * @returns {boolean} Success status
   */
  static async deactivate(id) {
    const result = await transaction(async (client) => {
      // Deactivate organization
      await client.query(
        'UPDATE organizations SET is_active = false, updated_at = NOW() WHERE id = $1',
        [id]
      );

      // Deactivate all users in the organization
      await client.query(
        'UPDATE users SET is_active = false, updated_at = NOW() WHERE organization_id = $1',
        [id]
      );

      return true;
    });

    return result;
  }

  /**
   * Get organization statistics
   * @param {string} organizationId - Organization ID
   * @returns {Object} Organization statistics
   */
  static async getStats(organizationId) {
    const result = await query(`
      SELECT 
        o.name,
        o.subscription_plan,
        o.max_users,
        COUNT(u.id) as total_users,
        COUNT(CASE WHEN u.is_active THEN 1 END) as active_users,
        COUNT(CASE WHEN u.last_login > NOW() - INTERVAL '30 days' THEN 1 END) as active_last_30_days,
        o.created_at
      FROM organizations o
      LEFT JOIN users u ON u.organization_id = o.id
      WHERE o.id = $1
      GROUP BY o.id, o.name, o.subscription_plan, o.max_users, o.created_at
    `, [organizationId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Convert to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      slug: this.slug,
      domain: this.domain,
      settings: this.settings,
      subscription_plan: this.subscription_plan,
      max_users: this.max_users,
      created_at: this.created_at,
      updated_at: this.updated_at,
      is_active: this.is_active
    };
  }
}

module.exports = Organization;