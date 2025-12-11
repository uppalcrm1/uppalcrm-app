const { query } = require('../database/connection');

class ContactImport {
  /**
   * Create a new import record
   */
  static async createImport(organizationId, userId, filename, fileSize) {
    try {
      const result = await query(
        `INSERT INTO contact_imports
        (organization_id, filename, file_size_bytes, status, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [organizationId, filename, fileSize, 'pending', userId],
        organizationId
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating import:', error);
      throw error;
    }
  }

  /**
   * Update import status and progress
   */
  static async updateImportStatus(importId, organizationId, status, progress = null) {
    try {
      const result = await query(
        `UPDATE contact_imports
        SET status = $3, updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *`,
        [importId, organizationId, status],
        organizationId
      );

      return result.rows[0];
    } catch (error) {
      console.error('Error updating import status:', error);
      throw error;
    }
  }

  /**
   * Get import by ID
   */
  static async getImportById(importId, organizationId) {
    try {
      const result = await query(
        `SELECT * FROM contact_imports
        WHERE id = $1 AND organization_id = $2`,
        [importId, organizationId],
        organizationId
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting import:', error);
      throw error;
    }
  }

  /**
   * Get all imports for an organization
   */
  static async getImportsByOrganization(organizationId, limit = 20, offset = 0) {
    try {
      const result = await query(
        `SELECT * FROM contact_imports
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3`,
        [organizationId, limit, offset],
        organizationId
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting imports:', error);
      throw error;
    }
  }

  /**
   * Save field mapping for reuse
   */
  static async saveFieldMapping(organizationId, userId, mappingName, fieldMapping, duplicateHandling, matchField) {
    try {
      const result = await query(
        `INSERT INTO contact_import_mappings
        (organization_id, mapping_name, field_mapping, duplicate_handling, match_field, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *`,
        [organizationId, mappingName, JSON.stringify(fieldMapping), duplicateHandling, matchField, userId],
        organizationId
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error saving field mapping:', error);
      throw error;
    }
  }

  /**
   * Get saved mappings for organization
   */
  static async getMappingsByOrganization(organizationId) {
    try {
      const result = await query(
        `SELECT id, mapping_name, field_mapping, duplicate_handling, match_field, is_default
        FROM contact_import_mappings
        WHERE organization_id = $1 AND is_active = true
        ORDER BY is_default DESC, created_at DESC`,
        [organizationId],
        organizationId
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting mappings:', error);
      throw error;
    }
  }

  /**
   * Record individual contact import
   */
  static async recordImportedContact(importId, organizationId, contactId, rowNumber, action, importedData, errorMessage = null) {
    try {
      const result = await query(
        `INSERT INTO contact_import_records
        (import_id, organization_id, contact_id, row_number, action, imported_data, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [importId, organizationId, contactId, rowNumber, action, JSON.stringify(importedData), errorMessage],
        organizationId
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error recording imported contact:', error);
      throw error;
    }
  }

  /**
   * Update import with final stats
   */
  static async completeImport(importId, organizationId, totalRows, successfulRows, failedRows, errorDetails = []) {
    try {
      const result = await query(
        `UPDATE contact_imports
        SET status = $3, total_rows = $4, successful_rows = $5, failed_rows = $6,
            error_details = $7, completed_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND organization_id = $2
        RETURNING *`,
        [importId, organizationId, 'completed', totalRows, successfulRows, failedRows, JSON.stringify(errorDetails)],
        organizationId
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error completing import:', error);
      throw error;
    }
  }
}

module.exports = ContactImport;
