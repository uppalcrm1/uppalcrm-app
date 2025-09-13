const { query } = require('../database/connection');

class AuditLog {
  constructor(data) {
    this.id = data.id;
    this.user_id = data.user_id;
    this.organization_id = data.organization_id;
    this.action = data.action;
    this.resource_type = data.resource_type;
    this.resource_id = data.resource_id;
    this.details = data.details;
    this.ip_address = data.ip_address;
    this.user_agent = data.user_agent;
    this.created_at = data.created_at;
  }

  /**
   * Create a new audit log entry
   * @param {Object} logData - Audit log data
   * @returns {AuditLog} New audit log instance
   */
  static async create(logData) {
    try {
      console.log('Creating audit log:', logData.action);

      // Ensure audit_logs table exists
      await query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES users(id),
          organization_id UUID REFERENCES organizations(id),
          action VARCHAR(100) NOT NULL,
          resource_type VARCHAR(50),
          resource_id UUID,
          details JSONB,
          ip_address INET,
          user_agent TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create indexes
      await query(`
        CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
      `);

      const result = await query(`
        INSERT INTO audit_logs (
          user_id,
          organization_id,
          action,
          resource_type,
          resource_id,
          details,
          ip_address,
          user_agent
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        logData.user_id,
        logData.organization_id,
        logData.action,
        logData.resource_type || null,
        logData.resource_id || null,
        JSON.stringify(logData.details || {}),
        logData.ip_address || null,
        logData.user_agent || null
      ], logData.organization_id);

      return new AuditLog(result.rows[0]);
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for an organization
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Array of audit log entries
   */
  static async findByOrganization(organizationId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        action = null,
        resource_type = null,
        user_id = null,
        days = null
      } = options;

      let whereClause = 'WHERE organization_id = $1';
      const queryParams = [organizationId];
      let paramIndex = 2;

      if (action) {
        whereClause += ` AND action = $${paramIndex}`;
        queryParams.push(action);
        paramIndex++;
      }

      if (resource_type) {
        whereClause += ` AND resource_type = $${paramIndex}`;
        queryParams.push(resource_type);
        paramIndex++;
      }

      if (user_id) {
        whereClause += ` AND user_id = $${paramIndex}`;
        queryParams.push(user_id);
        paramIndex++;
      }

      if (days) {
        whereClause += ` AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'`;
      }

      const result = await query(`
        SELECT 
          al.*,
          u.name as user_name,
          u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        ${whereClause}
        ORDER BY al.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...queryParams, limit, offset], organizationId);

      return result.rows.map(row => ({
        ...new AuditLog(row),
        user_name: row.user_name,
        user_email: row.user_email
      }));
    } catch (error) {
      console.error('Error finding audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   * @param {string} userId - User ID
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Array} Array of audit log entries
   */
  static async findByUser(userId, organizationId, options = {}) {
    try {
      const { limit = 50, offset = 0, days = 30 } = options;

      const result = await query(`
        SELECT 
          al.*,
          u.name as performed_by_name,
          u.email as performed_by_email
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.organization_id = $1 
          AND (al.user_id = $2 OR al.resource_id = $2)
          AND al.created_at >= NOW() - INTERVAL '${parseInt(days)} days'
        ORDER BY al.created_at DESC
        LIMIT $3 OFFSET $4
      `, [organizationId, userId, limit, offset], organizationId);

      return result.rows.map(row => ({
        ...new AuditLog(row),
        performed_by_name: row.performed_by_name,
        performed_by_email: row.performed_by_email
      }));
    } catch (error) {
      console.error('Error finding user audit logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   * @param {string} organizationId - Organization ID
   * @param {Object} options - Query options
   * @returns {Object} Audit log statistics
   */
  static async getStats(organizationId, options = {}) {
    try {
      const { days = 30 } = options;

      const result = await query(`
        SELECT 
          COUNT(*) as total_actions,
          COUNT(CASE WHEN action LIKE '%_CREATED' THEN 1 END) as creates,
          COUNT(CASE WHEN action LIKE '%_UPDATED' THEN 1 END) as updates,
          COUNT(CASE WHEN action LIKE '%_DELETED' THEN 1 END) as deletes,
          COUNT(CASE WHEN action = 'PASSWORD_RESET' THEN 1 END) as password_resets,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as last_24h,
          COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as last_7d
        FROM audit_logs
        WHERE organization_id = $1
          AND created_at >= NOW() - INTERVAL '${parseInt(days)} days'
      `, [organizationId], organizationId);

      return result.rows[0];
    } catch (error) {
      console.error('Error getting audit log stats:', error);
      throw error;
    }
  }

  /**
   * Get recent actions for dashboard
   * @param {string} organizationId - Organization ID
   * @param {number} limit - Number of recent actions to get
   * @returns {Array} Recent audit log entries
   */
  static async getRecentActions(organizationId, limit = 10) {
    try {
      const result = await query(`
        SELECT 
          al.*,
          u.name as user_name,
          u.email as user_email
        FROM audit_logs al
        LEFT JOIN users u ON u.id = al.user_id
        WHERE al.organization_id = $1
        ORDER BY al.created_at DESC
        LIMIT $2
      `, [organizationId, limit], organizationId);

      return result.rows.map(row => ({
        ...new AuditLog(row),
        user_name: row.user_name,
        user_email: row.user_email
      }));
    } catch (error) {
      console.error('Error getting recent actions:', error);
      throw error;
    }
  }

  /**
   * Clean up old audit logs (optional - for data retention)
   * @param {string} organizationId - Organization ID
   * @param {number} retentionDays - Number of days to retain logs
   * @returns {number} Number of deleted logs
   */
  static async cleanup(organizationId, retentionDays = 365) {
    try {
      const result = await query(`
        DELETE FROM audit_logs
        WHERE organization_id = $1
          AND created_at < NOW() - INTERVAL '${parseInt(retentionDays)} days'
      `, [organizationId], organizationId);

      console.log(`Cleaned up ${result.rowCount} audit logs older than ${retentionDays} days`);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up audit logs:', error);
      throw error;
    }
  }
}

module.exports = AuditLog;