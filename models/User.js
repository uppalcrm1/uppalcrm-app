const { query, transaction } = require('../database/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.organization_id = data.organization_id;
    this.email = data.email;
    this.name = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim();
    this.first_name = data.first_name;
    this.last_name = data.last_name;
    this.role = data.role || 'user';
    this.status = data.status || 'active';
    this.permissions = data.permissions || [];
    this.last_login = data.last_login;
    this.email_verified = data.email_verified || false;
    this.is_active = data.is_active !== false;
    this.is_first_login = data.is_first_login || false;
    this.failed_login_attempts = data.failed_login_attempts || 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
    this.deleted_at = data.deleted_at;
    this.created_by = data.created_by;
  }

  /**
   * Create a new user within an organization
   * @param {Object} userData - User data
   * @param {string} organizationId - Organization ID
   * @param {string} createdBy - ID of user creating this user
   * @returns {User} Created user instance
   */
  static async create(userData, organizationId, createdBy = null) {
    const { email, password, first_name, last_name, role = 'user', is_first_login = false } = userData;

    // Validate required fields
    if (!email || !password || !first_name || !last_name || !organizationId) {
      throw new Error('Missing required fields');
    }

    // Validate role
    const validRoles = ['admin', 'manager', 'user', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role specified');
    }

    try {
      // Check if a soft-deleted user with this email exists
      const existingUser = await query(`
        SELECT * FROM users 
        WHERE organization_id = $1 AND LOWER(email) = LOWER($2)
      `, [organizationId, email], organizationId);

      if (existingUser.rows.length > 0) {
        const user = existingUser.rows[0];
        
        // If user is soft-deleted, reactivate them
        if (user.deleted_at) {
          const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);
          
          const reactivated = await query(`
            UPDATE users 
            SET 
              password_hash = $1,
              first_name = $2,
              last_name = $3,
              role = $4,
              is_active = true,
              deleted_at = NULL,
              deleted_by = NULL,
              updated_at = NOW()
            WHERE id = $5 AND organization_id = $6
            RETURNING *
          `, [passwordHash, first_name, last_name, role, user.id, organizationId], organizationId);
          
          console.log(`✅ Reactivated soft-deleted user: ${email}`);
          return new User(reactivated.rows[0]);
        } else {
          // User exists and is active
          throw new Error('Email already exists in this organization');
        }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS) || 12);

      // Create new user
      const result = await query(`
        INSERT INTO users (
          organization_id, email, password_hash, first_name, last_name,
          role, created_by, email_verified, is_first_login
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        organizationId,
        email.toLowerCase(),
        passwordHash,
        first_name,
        last_name,
        role,
        createdBy,
        false, // email_verified
        is_first_login
      ], organizationId);

      return new User(result.rows[0]);
    } catch (error) {
      if (error.message.includes('duplicate key')) {
        throw new Error('Email already exists in this organization');
      }
      if (error.message.includes('User limit exceeded')) {
        throw new Error('User limit exceeded for organization');
      }
      throw error;
    }
  }

  /**
   * Find user by ID within organization context
   * @param {string} id - User ID
   * @param {string} organizationId - Organization ID
   * @returns {User|null} User instance or null
   */
  static async findById(id, organizationId) {
    const result = await query(`
      SELECT * FROM users 
      WHERE id = $1 AND organization_id = $2 AND is_active = true
    `, [id, organizationId], organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  /**
   * Find user by email within organization (legacy method)
   * @param {string} email - User email
   * @param {string} organizationId - Organization ID
   * @returns {User|null} User instance or null
   */
  static async findByEmail(email, organizationId) {
    const result = await query(`
      SELECT * FROM users 
      WHERE email = $1 AND organization_id = $2 AND is_active = true
    `, [email.toLowerCase(), organizationId], organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  /**
   * Find user by email globally (no organization context needed)
   * @param {string} email - User email
   * @returns {User|null} User instance or null
   */
  static async findByEmailGlobal(email) {
    const { pool } = require('../database/connection');
    const client = await pool.connect();
    
    try {
      // Temporarily disable RLS for global lookup
      await client.query('SET LOCAL row_security = off');
      
      const result = await client.query(`
        SELECT * FROM users 
        WHERE email = $1 AND is_active = true
      `, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      return new User(result.rows[0]);
    } finally {
      client.release();
    }
  }

  /**
   * Authenticate user with email and password
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} organizationId - Organization ID (optional, for legacy compatibility)
   * @returns {User|null} User instance if authenticated, null otherwise
   */
  static async authenticate(email, password, organizationId = null) {
    // Use global email lookup for simplified login - bypass RLS for authentication
    const { pool } = require('../database/connection');
    const client = await pool.connect();

    try {
      // Temporarily disable RLS for authentication lookup
      await client.query('SET LOCAL row_security = off');

      const result = await client.query(`
        SELECT * FROM users
        WHERE email = $1 AND is_active = true
      `, [email.toLowerCase()]);

      if (result.rows.length === 0) {
        return null;
      }

      const user = new User(result.rows[0]);
      const isValid = await bcrypt.compare(password, result.rows[0].password_hash);

      if (!isValid) {
        return null;
      }

      // Re-enable RLS and set organization context for the update
      await client.query('SET LOCAL row_security = on');
      await client.query('SELECT set_config($1, $2, true)', [
        'app.current_organization_id',
        user.organization_id
      ]);

      // Update last login
      await client.query(`
        UPDATE users SET last_login = NOW() WHERE id = $1
      `, [user.id]);

      user.last_login = new Date();
      return user;
    } finally {
      client.release();
    }
  }

  /**
   * Legacy authenticate method with organization requirement
   * @param {string} email - User email
   * @param {string} password - User password
   * @param {string} organizationId - Organization ID
   * @returns {User|null} User instance if authenticated, null otherwise
   */
  static async authenticateWithOrg(email, password, organizationId) {
    const result = await query(`
      SELECT * FROM users 
      WHERE email = $1 AND organization_id = $2 AND is_active = true
    `, [email.toLowerCase(), organizationId], organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    const user = new User(result.rows[0]);
    const isValid = await bcrypt.compare(password, result.rows[0].password_hash);

    if (!isValid) {
      return null;
    }

    // Update last login
    await query(`
      UPDATE users SET last_login = NOW() WHERE id = $1
    `, [user.id], organizationId);

    user.last_login = new Date();
    return user;
  }

  /**
   * Generate JWT token for user
   * @param {string} ipAddress - Client IP address
   * @param {string} userAgent - Client user agent
   * @returns {Object} Token data
   */
  async generateToken(ipAddress = null, userAgent = null) {
    const payload = {
      userId: this.id,
      organizationId: this.organization_id,
      email: this.email,
      role: this.role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '24h',
      issuer: 'uppal-crm'
    });

    console.log('[generateToken] Token created for user:', {
      userId: this.id,
      email: this.email,
      organizationId: this.organization_id
    });

    // Store session in database
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    try {
      await query(`
        INSERT INTO user_sessions (user_id, organization_id, token_hash, expires_at, ip_address, user_agent)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        this.id,
        this.organization_id,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent
      ], this.organization_id);

      console.log('[generateToken] Session stored successfully');
    } catch (error) {
      console.error('[generateToken] Error storing session:', error.message);
      throw error;
    }

    return {
      token,
      expiresAt,
      user: this.toJSON()
    };
  }

  /**
   * Verify JWT token and get user
   * @param {string} token - JWT token
   * @returns {User|null} User instance if valid, null otherwise
   */
  static async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      console.log('[verifyToken] Decoded token:', {
        userId: decoded.userId,
        organizationId: decoded.organizationId,
        email: decoded.email
      });

      // Check if session exists and is not expired
      // IMPORTANT: Pass organizationId to enable RLS context for user_sessions table
      const sessionResult = await query(`
        SELECT
          u.id, u.organization_id, u.email, u.first_name, u.last_name,
          u.role, u.permissions, u.last_login, u.email_verified,
          u.is_active, u.created_at, u.updated_at, u.created_by
        FROM user_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.is_active = true
      `, [tokenHash], decoded.organizationId);

      console.log('[verifyToken] Session query result rows:', sessionResult.rows.length);

      if (sessionResult.rows.length === 0) {
        console.log('[verifyToken] No session found for token hash');
        return null;
      }

      const userData = sessionResult.rows[0];

      // Critical validation: Ensure user has valid UUID fields
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!userData.id || !userData.organization_id ||
          typeof userData.id !== 'string' || typeof userData.organization_id !== 'string' ||
          userData.id.trim() === '' || userData.organization_id.trim() === '' ||
          !uuidRegex.test(userData.id) || !uuidRegex.test(userData.organization_id)) {
        console.error('Invalid user data from database:', {
          id: userData.id,
          organization_id: userData.organization_id,
          email: userData.email
        });
        return null;
      }

      return new User(userData);
    } catch (error) {
      // Token verification errors are expected for expired tokens - don't log
      // console.error('Token verification error:', error.message);
      return null;
    }
  }

  /**
   * Revoke user token (logout)
   * @param {string} token - JWT token to revoke
   */
  static async revokeToken(token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    await query(`
      DELETE FROM user_sessions WHERE token_hash = $1
    `, [tokenHash]);
  }

  /**
   * Revoke all tokens for user
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   */
  static async revokeAllTokens(userId, organizationId) {
    await query(`
      DELETE FROM user_sessions WHERE user_id = $1 AND organization_id = $2
    `, [userId, organizationId], organizationId);
  }

  /**
   * Get all users in organization
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Array of User instances
   */
  static async findByOrganization(organizationId, options = {}) {
    const { limit = 50, offset = 0, role = null, search = null } = options;
    
    let query_text = `
      SELECT * FROM users 
      WHERE organization_id = $1 AND is_active = true
    `;
    
    const params = [organizationId];
    let paramCount = 1;

    if (role) {
      query_text += ` AND role = $${++paramCount}`;
      params.push(role);
    }

    if (search) {
      query_text += ` AND (
        first_name ILIKE $${++paramCount} OR 
        last_name ILIKE $${++paramCount} OR 
        email ILIKE $${++paramCount}
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query_text += ` ORDER BY created_at DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
    params.push(limit, offset);

    const result = await query(query_text, params, organizationId);
    return result.rows.map(row => new User(row));
  }

  /**
   * Update user
   * @param {string} id - User ID
   * @param {Object} updates - Fields to update
   * @param {string} organizationId - Organization ID
   * @returns {User|null} Updated user
   */
  static async update(id, updates, organizationId) {
    const allowedFields = ['first_name', 'last_name', 'role', 'permissions', 'email_verified'];
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = updateFields.map((field, index) => `${field} = $${index + 3}`).join(', ');
    const values = [id, organizationId, ...updateFields.map(field => updates[field])];

    const result = await query(`
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND is_active = true
      RETURNING *
    `, values, organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }

  /**
   * Change user password
   * @param {string} id - User ID
   * @param {string} newPassword - New password
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Success status
   */
  static async changePassword(id, newPassword, organizationId) {
    const passwordHash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);

    const result = await query(`
      UPDATE users 
      SET password_hash = $1, updated_at = NOW()
      WHERE id = $2 AND organization_id = $3 AND is_active = true
      RETURNING id
    `, [passwordHash, id, organizationId], organizationId);

    return result.rows.length > 0;
  }

  /**
   * Deactivate user (soft delete)
   * @param {string} id - User ID
   * @param {string} organizationId - Organization ID
   * @returns {boolean} Success status
   */
  static async deactivate(id, organizationId) {
    const result = await transaction(async (client) => {
      // Deactivate user
      await client.query(`
        UPDATE users SET is_active = false, updated_at = NOW() 
        WHERE id = $1 AND organization_id = $2
      `, [id, organizationId]);

      // Revoke all active sessions
      await client.query(`
        DELETE FROM user_sessions WHERE user_id = $1
      `, [id]);

      return true;
    }, organizationId);

    return result;
  }

  /**
   * Check if user has permission
   * @param {string} permission - Permission to check
   * @returns {boolean} Whether user has permission
   */
  hasPermission(permission) {
    // Admin users have all permissions
    if (this.role === 'admin') {
      return true;
    }

    return this.permissions.includes(permission);
  }

  /**
   * Get user's full name
   * @returns {string} Full name
   */
  getFullName() {
    return `${this.first_name} ${this.last_name}`.trim();
  }

  /**
   * Convert to JSON representation (excluding sensitive data)
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      id: this.id,
      organization_id: this.organization_id,
      email: this.email,
      first_name: this.first_name,
      last_name: this.last_name,
      full_name: this.getFullName(),
      role: this.role,
      permissions: this.permissions,
      last_login: this.last_login,
      email_verified: this.email_verified,
      is_active: this.is_active,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  // Removed duplicate create method - using the main create method at line 35

  /**
   * Enhanced update method for user management
   * @param {string} id - User ID
   * @param {Object} updates - Fields to update
   * @param {string} organizationId - Organization ID
   * @returns {User|null} Updated user
   */
  static async update(id, updates, organizationId) {
    const allowedFields = [
      'name', 'email', 'role', 'status', 'first_name', 'last_name', 
      'is_first_login', 'failed_login_attempts', 'password', 'deleted_at'
    ];
    
    const updateFields = Object.keys(updates).filter(key => allowedFields.includes(key));
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Handle special cases
    const processedUpdates = { ...updates };
    
    // If updating name, split into first/last name
    if (processedUpdates.name) {
      const nameParts = processedUpdates.name.trim().split(' ');
      processedUpdates.first_name = nameParts[0];
      processedUpdates.last_name = nameParts.slice(1).join(' ') || '';
      delete processedUpdates.name;
    }

    // If updating password, hash it
    if (processedUpdates.password) {
      processedUpdates.password_hash = await bcrypt.hash(processedUpdates.password, 12);
      delete processedUpdates.password;
    }

    // If updating email, lowercase it
    if (processedUpdates.email) {
      processedUpdates.email = processedUpdates.email.toLowerCase();
    }

    const finalUpdateFields = Object.keys(processedUpdates).filter(key => 
      [...allowedFields, 'password_hash'].includes(key)
    );

    if (finalUpdateFields.length === 0) {
      throw new Error('No valid fields to update after processing');
    }

    const setClause = finalUpdateFields.map((field, index) => 
      `${field} = $${index + 3}`
    ).join(', ');
    
    const values = [
      id, 
      organizationId, 
      ...finalUpdateFields.map(field => processedUpdates[field])
    ];

    try {
      const result = await query(`
        UPDATE users 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *
      `, values, organizationId);

      if (result.rows.length === 0) {
        return null;
      }

      return new User(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID within organization
   * @param {string} id - User ID
   * @param {string} organizationId - Organization ID
   * @returns {User|null} User instance or null
   */
  static async findById(id, organizationId) {
    const result = await query(`
      SELECT * FROM users 
      WHERE id = $1 AND organization_id = $2
    `, [id, organizationId], organizationId);

    if (result.rows.length === 0) {
      return null;
    }

    return new User(result.rows[0]);
  }
}

module.exports = User;