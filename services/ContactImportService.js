const fs = require('fs');
const csv = require('csv-parser');
const { Readable } = require('stream');
const Contact = require('../models/Contact');
const ContactImport = require('../models/ContactImport');
const { query } = require('../database/connection');

class ContactImportService {
  /**
   * Parse CSV file and return rows as JSON
   */
  static async parseCSVFile(fileBuffer) {
    return new Promise((resolve, reject) => {
      const rows = [];
      const stream = Readable.from(fileBuffer.toString());

      stream
        .pipe(csv())
        .on('data', (row) => {
          const cleanedRow = {};
          Object.keys(row).forEach(key => {
            cleanedRow[key.trim()] = row[key] ? row[key].trim() : '';
          });
          rows.push(cleanedRow);
        })
        .on('end', () => {
          resolve(rows);
        })
        .on('error', (error) => {
          reject(new Error(`Error parsing CSV: ${error.message}`));
        });
    });
  }

  /**
   * Get column headers from CSV file
   */
  static async getCSVHeaders(fileBuffer) {
    const rows = await this.parseCSVFile(fileBuffer);
    if (rows.length === 0) {
      return [];
    }
    return Object.keys(rows[0]);
  }

  /**
   * Validate email address
   */
  static validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number
   */
  static validatePhone(phone) {
    const digitsOnly = phone.replace(/\D/g, '');
    return digitsOnly.length >= 7;
  }

  /**
   * Validate a single contact row
   */
  static validateContactRow(row, fieldMapping) {
    const errors = [];

    const firstName = row[fieldMapping.first_name]?.trim() || '';
    const lastName = row[fieldMapping.last_name]?.trim() || '';
    const email = row[fieldMapping.email]?.trim() || '';
    const phone = row[fieldMapping.phone]?.trim() || '';

    if (!firstName) {
      errors.push('First Name is required');
    }

    if (!lastName) {
      errors.push('Last Name is required');
    }

    if (email && !this.validateEmail(email)) {
      errors.push('Email is not in valid format');
    }

    if (phone && !this.validatePhone(phone)) {
      errors.push('Phone number must have at least 7 digits');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if contact already exists
   */
  static async checkDuplicate(organizationId, matchField, matchValue) {
    if (!matchValue) {
      return null;
    }

    try {
      let queryString;
      if (matchField === 'email') {
        queryString = `SELECT * FROM contacts
                WHERE organization_id = $1 AND email = $2`;
      } else if (matchField === 'phone') {
        queryString = `SELECT * FROM contacts
                WHERE organization_id = $1 AND phone = $2`;
      } else {
        return null;
      }

      const result = await query(queryString, [organizationId, matchValue], organizationId);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return null;
    }
  }

  /**
   * Process a single row
   */
  static async processRow(row, rowNumber, organizationId, userId, fieldMapping, duplicateHandling, matchField) {
    try {
      const validation = this.validateContactRow(row, fieldMapping);
      if (!validation.isValid) {
        return {
          action: 'failed',
          contactId: null,
          error: validation.errors.join('; ')
        };
      }

      const contactData = {
        first_name: row[fieldMapping.first_name]?.trim() || '',
        last_name: row[fieldMapping.last_name]?.trim() || '',
        email: row[fieldMapping.email]?.trim() || '',
        phone: row[fieldMapping.phone]?.trim() || '',
        company: row[fieldMapping.company]?.trim() || '',
        title: row[fieldMapping.title]?.trim() || '',
        notes: row[fieldMapping.notes]?.trim() || ''
      };

      const matchValue = row[fieldMapping[matchField]];
      const existingContact = await this.checkDuplicate(organizationId, matchField, matchValue);

      if (existingContact) {
        if (duplicateHandling === 'create_only') {
          return {
            action: 'skipped',
            contactId: existingContact.id,
            error: 'Duplicate contact (create_only mode)'
          };
        } else if (duplicateHandling === 'update_only' || duplicateHandling === 'create_or_update') {
          const updated = await Contact.update(existingContact.id, contactData, organizationId);
          return {
            action: 'updated',
            contactId: updated.id,
            error: null
          };
        }
      } else {
        if (duplicateHandling === 'update_only') {
          return {
            action: 'skipped',
            contactId: null,
            error: 'Contact does not exist (update_only mode)'
          };
        }
        const created = await Contact.create(contactData, organizationId, userId);
        return {
          action: 'created',
          contactId: created.id,
          error: null
        };
      }
    } catch (error) {
      return {
        action: 'failed',
        contactId: null,
        error: error.message
      };
    }
  }

  /**
   * Process entire import file
   */
  static async processImport(importId, organizationId, userId, fileBuffer, fieldMapping, duplicateHandling, matchField) {
    try {
      const rows = await this.parseCSVFile(fileBuffer);

      if (rows.length === 0) {
        throw new Error('CSV file is empty');
      }

      let successCount = 0;
      let failCount = 0;
      const errorDetails = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNumber = i + 2;

        const result = await this.processRow(
          row,
          rowNumber,
          organizationId,
          userId,
          fieldMapping,
          duplicateHandling,
          matchField
        );

        await ContactImport.recordImportedContact(
          importId,
          organizationId,
          result.contactId,
          rowNumber,
          result.action,
          row,
          result.error
        );

        if (result.action === 'created' || result.action === 'updated') {
          successCount++;
        } else if (result.action === 'failed') {
          failCount++;
          errorDetails.push({
            row: rowNumber,
            error: result.error
          });
        }
      }

      const importResult = await ContactImport.completeImport(
        importId,
        organizationId,
        rows.length,
        successCount,
        failCount,
        errorDetails
      );

      return importResult;
    } catch (error) {
      console.error('Error processing import:', error);
      await ContactImport.updateImportStatus(importId, organizationId, 'failed');
      throw error;
    }
  }
}

module.exports = ContactImportService;
