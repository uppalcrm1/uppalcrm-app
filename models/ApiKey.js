const { query, transaction } = require('../database/connection');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class ApiKey {
  constructor(data = {}) {
    this.id = data.id;
    this.organization_id = data.organization_id;
    this.name = data.name;
    this.key_hash = data.key_hash;
    this.key_prefix = data.key_prefix;
    this.permissions = data.permissions || [];
    this.allowed_sources = data.allowed_sources;
    this.rate_limit_per_hour = data.rate_limit_per_hour || 1000;
    this.is_active = data.is_active !== false;
    this.last_used_at = data.last_used_at;
    this.created_by = data.created_by;
    this.created_at = data.created_at;
    this.expires_at = data.expires_at;
    this.total_requests = data.total_requests || 0;
    this.last_request_ip = data.last_request_ip;
  }

  /**
   * Generate a secure API key with organization context
   * @param {string} organizationSlug - Organization slug for key format
   * @returns {string} - Generated API key in format: uppal_{org_slug}_{random_string}
   */
  static generateApiKey(organizationSlug) {
    // Generate 32 bytes of random data and encode as base64url (no padding)
    const randomBytes = crypto.randomBytes(32);
    const randomString = randomBytes.toString('base64url').substring(0, 40);
    
    // Format: uppal_{org_slug}_{random_string}
    return `uppal_${organizationSlug}_${randomString}`;
  }

  /**
   * Generate key prefix for display purposes
   * @param {string} apiKey - Full API key
   * @returns {string} - Truncated key for display (e.g., "uppal_org_abc123...")
   */
  static generateKeyPrefix(apiKey) {
    return apiKey.substring(0, 20) + '...';
  }

  /**
   * Hash API key for secure storage
   * @param {string} apiKey - Plain text API key
   * @returns {string} - Bcrypt hash of the API key
   */
  static async hashKey(apiKey) {
    const saltRounds = 12;
    return await bcrypt.hash(apiKey, saltRounds);
  }

  /**
   * Verify API key against stored hash
   * @param {string} apiKey - Plain text API key
   * @param {string} hash - Stored hash
   * @returns {boolean} - True if key matches hash
   */
  static async verifyKey(apiKey, hash) {
    return await bcrypt.compare(apiKey, hash);
  }

  /**
   * Create a new API key for an organization
   * @param {string} organizationId - Organization UUID
   * @param {Object} data - API key data
   * @param {string} data.name - Human-readable name for the key
   * @param {Array} data.permissions - Array of permission strings
   * @param {Array} data.allowed_sources - Array of allowed IP addresses (optional)
   * @param {number} data.rate_limit_per_hour - Requests per hour limit
   * @param {Date} data.expires_at - Expiration date (optional)
   * @param {string} createdBy - User ID who created the key
   * @returns {Object} - Created API key with plain text key (only returned once)
   */
  static async create(organizationId, data, createdBy) {
    // Get organization details for slug
    const orgResult = await query(
      'SELECT slug, name FROM organizations WHERE id = $1',
      [organizationId]
    );

    if (orgResult.rows.length === 0) {
      throw new Error('Organization not found');
    }

    const organization = orgResult.rows[0];
    const orgSlug = organization.slug || organization.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Generate the API key
    const apiKey = this.generateApiKey(orgSlug);
    const keyHash = await this.hashKey(apiKey);
    const keyPrefix = this.generateKeyPrefix(apiKey);

    // Validate permissions
    const validPermissions = [
      'contacts:read', 'contacts:write', 'contacts:delete',
      'leads:read', 'leads:write', 'leads:delete',
      'users:read', 'users:write',
      'organizations:read',
      'webhooks:read', 'webhooks:write',
      'analytics:read'
    ];

    const invalidPermissions = data.permissions.filter(p => !validPermissions.includes(p));
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
    }

    const result = await query(`
      INSERT INTO api_keys (
        organization_id, name, key_hash, key_prefix, permissions, 
        allowed_sources, rate_limit_per_hour, expires_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      organizationId,
      data.name,
      keyHash,
      keyPrefix,
      JSON.stringify(data.permissions),
      data.allowed_sources,
      data.rate_limit_per_hour || 1000,
      data.expires_at || null,
      createdBy
    ]);

    const apiKeyRecord = new ApiKey(result.rows[0]);
    
    // Return the API key record with the plain text key (only time it's exposed)
    return {
      ...apiKeyRecord,
      api_key: apiKey // Plain text key - store this securely!
    };
  }

  /**
   * Verify an API key and return organization context
   * @param {string} apiKey - Plain text API key to verify
   * @returns {Object|null} - API key record with organization info or null if invalid
   */
  static async verify(apiKey) {
    try {
      // Extract organization slug from key format
      const keyParts = apiKey.split('_');
      if (keyParts.length < 3 || keyParts[0] !== 'uppal') {
        return null;
      }

      const orgSlug = keyParts[1];

      // Find organization by slug
      const orgResult = await query(`
        SELECT o.id, o.slug, o.name, o.is_active as org_active
        FROM organizations o 
        WHERE o.slug = $1 OR LOWER(REPLACE(o.name, ' ', '')) = $1
      `, [orgSlug]);

      if (orgResult.rows.length === 0) {
        return null;
      }

      const organization = orgResult.rows[0];

      if (!organization.org_active) {
        return null; // Organization is inactive
      }

      // Find and verify API key
      const keyResult = await query(`
        SELECT ak.*, o.name as organization_name, o.slug as organization_slug
        FROM api_keys ak
        JOIN organizations o ON ak.organization_id = o.id
        WHERE ak.organization_id = $1 AND ak.is_active = true
        AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
      `, [organization.id]);

      // Check each active key for this organization
      for (const keyRecord of keyResult.rows) {
        const isValid = await this.verifyKey(apiKey, keyRecord.key_hash);
        if (isValid) {
          return {
            ...new ApiKey(keyRecord),
            organization: {
              id: organization.id,
              name: organization.name,
              slug: organization.slug
            }
          };
        }
      }

      return null;
    } catch (error) {
      console.error('API key verification error:', error);
      return null;
    }
  }

  /**
   * Find all API keys for an organization
   * @param {string} organizationId - Organization UUID
   * @param {Object} options - Query options
   * @param {boolean} options.includeInactive - Include inactive keys
   * @returns {Array} - Array of API key records (without hashes)
   */
  static async findByOrganization(organizationId, options = {}) {
    let whereClause = 'ak.organization_id = $1';
    const params = [organizationId];

    if (!options.includeInactive) {
      whereClause += ' AND ak.is_active = true';
    }

    const result = await query(`
      SELECT 
        ak.id, ak.organization_id, ak.name, ak.key_prefix, ak.permissions,
        ak.allowed_sources, ak.rate_limit_per_hour, ak.is_active,
        ak.last_used_at, ak.created_at, ak.expires_at, ak.total_requests,
        ak.last_request_ip, ak.created_by,
        u.first_name || ' ' || u.last_name as created_by_name
      FROM api_keys ak
      LEFT JOIN users u ON ak.created_by = u.id
      WHERE ${whereClause}
      ORDER BY ak.created_at DESC
    `, params);

    return result.rows.map(row => new ApiKey(row));
  }

  /**
   * Deactivate an API key
   * @param {string} keyId - API key UUID
   * @param {string} organizationId - Organization UUID (for security)
   * @returns {boolean} - True if deactivated successfully
   */
  static async deactivate(keyId, organizationId) {
    const result = await query(`
      UPDATE api_keys 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND organization_id = $2 AND is_active = true
    `, [keyId, organizationId]);

    return result.rowCount > 0;
  }

  /**
   * Log API key usage
   * @param {string} apiKeyId - API key UUID
   * @param {string} organizationId - Organization UUID
   * @param {Object} requestData - Request details
   * @param {string} requestData.endpoint - API endpoint called
   * @param {string} requestData.method - HTTP method
   * @param {number} requestData.status_code - Response status code
   * @param {string} requestData.source_ip - Client IP address
   * @param {string} requestData.user_agent - Client user agent
   * @param {number} requestData.request_size_bytes - Request size
   * @param {number} requestData.response_size_bytes - Response size
   * @param {number} requestData.response_time_ms - Response time
   * @param {string} requestData.request_id - Request ID for tracing
   * @returns {Object} - Created usage log record
   */
  static async logUsage(apiKeyId, organizationId, requestData) {
    const result = await query(`
      INSERT INTO api_key_usage_logs (
        api_key_id, organization_id, endpoint, method, status_code,
        request_size_bytes, response_size_bytes, response_time_ms,
        source_ip, user_agent, request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      apiKeyId,
      organizationId,
      requestData.endpoint,
      requestData.method,
      requestData.status_code,
      requestData.request_size_bytes || null,
      requestData.response_size_bytes || null,
      requestData.response_time_ms || null,
      requestData.source_ip,
      requestData.user_agent || null,
      requestData.request_id || null
    ]);

    return result.rows[0];
  }

  /**
   * Check if API key has exceeded rate limit
   * @param {string} apiKeyId - API key UUID
   * @param {number} rateLimit - Requests per hour limit
   * @returns {Object} - Rate limit status
   */
  static async checkRateLimit(apiKeyId, rateLimit) {
    // Count requests in the last hour
    const result = await query(`
      SELECT COUNT(*) as request_count
      FROM api_key_usage_logs
      WHERE api_key_id = $1 
      AND created_at > NOW() - INTERVAL '1 hour'
    `, [apiKeyId]);

    const currentCount = parseInt(result.rows[0].request_count);
    const isExceeded = currentCount >= rateLimit;

    return {
      current_count: currentCount,
      limit: rateLimit,
      exceeded: isExceeded,
      remaining: Math.max(0, rateLimit - currentCount),
      reset_time: new Date(Date.now() + 3600000) // 1 hour from now
    };
  }

  /**
   * Get API key usage statistics
   * @param {string} apiKeyId - API key UUID
   * @param {Object} options - Query options
   * @param {Date} options.startDate - Start date for statistics
   * @param {Date} options.endDate - End date for statistics
   * @returns {Object} - Usage statistics
   */
  static async getUsageStats(apiKeyId, options = {}) {
    const startDate = options.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const endDate = options.endDate || new Date();

    const result = await query(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
        AVG(response_time_ms) as avg_response_time,
        MAX(response_time_ms) as max_response_time,
        SUM(request_size_bytes) as total_request_bytes,
        SUM(response_size_bytes) as total_response_bytes,
        COUNT(DISTINCT source_ip) as unique_ips,
        COUNT(DISTINCT DATE(created_at)) as active_days
      FROM api_key_usage_logs
      WHERE api_key_id = $1 
      AND created_at BETWEEN $2 AND $3
    `, [apiKeyId, startDate, endDate]);

    return result.rows[0];
  }

  /**
   * Check if API key has specific permission
   * @param {Array} permissions - API key permissions
   * @param {string} requiredPermission - Required permission to check
   * @returns {boolean} - True if permission is granted
   */
  static hasPermission(permissions, requiredPermission) {
    if (!Array.isArray(permissions)) {
      return false;
    }
    
    // Check for exact permission or wildcard
    return permissions.includes(requiredPermission) || 
           permissions.includes('*') ||
           permissions.includes(requiredPermission.split(':')[0] + ':*');
  }

  /**
   * Check if request is from allowed source IP
   * @param {Array} allowedSources - Array of allowed IP addresses/CIDR blocks
   * @param {string} sourceIp - Request source IP
   * @returns {boolean} - True if source is allowed
   */
  static isSourceAllowed(allowedSources, sourceIp) {
    if (!allowedSources || allowedSources.length === 0) {
      return true; // No restrictions
    }

    // Simple IP matching (could be enhanced with CIDR matching)
    return allowedSources.includes(sourceIp) || allowedSources.includes('*');
  }

  /**
   * Update API key
   * @param {string} keyId - API key UUID
   * @param {string} organizationId - Organization UUID
   * @param {Object} updates - Fields to update
   * @returns {Object|null} - Updated API key or null if not found
   */
  static async update(keyId, organizationId, updates) {
    const allowedFields = [
      'name', 'permissions', 'allowed_sources', 'rate_limit_per_hour', 
      'is_active', 'expires_at'
    ];

    const setFields = [];
    const values = [];
    let paramIndex = 3; // Start from $3 (after keyId and organizationId)

    Object.keys(updates).forEach(field => {
      if (allowedFields.includes(field)) {
        setFields.push(`${field} = $${paramIndex}`);
        values.push(field === 'permissions' ? JSON.stringify(updates[field]) : updates[field]);
        paramIndex++;
      }
    });

    if (setFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    setFields.push('updated_at = NOW()');

    const result = await query(`
      UPDATE api_keys 
      SET ${setFields.join(', ')}
      WHERE id = $1 AND organization_id = $2
      RETURNING *
    `, [keyId, organizationId, ...values]);

    return result.rows.length > 0 ? new ApiKey(result.rows[0]) : null;
  }

  /**
   * Delete API key permanently
   * @param {string} keyId - API key UUID
   * @param {string} organizationId - Organization UUID
   * @returns {boolean} - True if deleted successfully
   */
  static async delete(keyId, organizationId) {
    const result = await query(`
      DELETE FROM api_keys 
      WHERE id = $1 AND organization_id = $2
    `, [keyId, organizationId]);

    return result.rowCount > 0;
  }
}

module.exports = ApiKey;