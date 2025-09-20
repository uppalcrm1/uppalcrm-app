const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const pool = require('../database/connection');
const { uploadMiddleware } = require('../middleware/upload');

class ImportController {
  // Upload and analyze CSV file
  async uploadFile(req, res) {
    try {
      const { organizationId, userId } = req.user;
      const { importType } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file type
      if (!req.file.originalname.toLowerCase().endsWith('.csv')) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Only CSV files are allowed' });
      }

      // Analyze CSV structure
      const analysis = await this.analyzeCsvFile(req.file.path);

      // Create import job record
      const jobResult = await pool.query(`
        INSERT INTO import_jobs (
          organization_id, user_id, import_type, filename, original_filename,
          file_path, file_size, total_rows, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
        RETURNING *
      `, [
        organizationId,
        userId,
        importType,
        req.file.filename,
        req.file.originalname,
        req.file.path,
        req.file.size,
        analysis.totalRows
      ]);

      const importJob = jobResult.rows[0];

      res.json({
        success: true,
        importJob,
        analysis: {
          totalRows: analysis.totalRows,
          headers: analysis.headers,
          sampleData: analysis.sampleData,
          suggestedMappings: this.getSuggestedMappings(analysis.headers, importType)
        }
      });

    } catch (error) {
      console.error('Upload file error:', error);
      // Clean up file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  }

  // Analyze CSV file structure
  async analyzeCsvFile(filePath) {
    return new Promise((resolve, reject) => {
      const headers = [];
      const sampleData = [];
      let totalRows = 0;
      let headersParsed = false;

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers.push(...headerList);
          headersParsed = true;
        })
        .on('data', (row) => {
          totalRows++;
          if (sampleData.length < 5) {
            sampleData.push(row);
          }
        })
        .on('end', () => {
          resolve({
            headers: headersParsed ? headers : Object.keys(sampleData[0] || {}),
            sampleData,
            totalRows
          });
        })
        .on('error', reject);
    });
  }

  // Get suggested field mappings based on CSV headers
  getSuggestedMappings(headers, importType) {
    const mappings = {};

    const commonMappings = {
      leads: {
        'first_name': ['first name', 'firstname', 'fname', 'given name'],
        'last_name': ['last name', 'lastname', 'lname', 'surname', 'family name'],
        'email': ['email', 'email address', 'e-mail', 'mail'],
        'phone': ['phone', 'phone number', 'mobile', 'cell', 'telephone'],
        'company': ['company', 'organization', 'business', 'company name'],
        'title': ['title', 'job title', 'position', 'role'],
        'status': ['status', 'lead status', 'stage'],
        'source': ['source', 'lead source', 'origin'],
        'notes': ['notes', 'comments', 'description', 'remarks']
      },
      contacts: {
        'first_name': ['first name', 'firstname', 'fname', 'given name'],
        'last_name': ['last name', 'lastname', 'lname', 'surname', 'family name'],
        'email': ['email', 'email address', 'e-mail', 'mail'],
        'phone': ['phone', 'phone number', 'mobile', 'cell', 'telephone'],
        'company': ['company', 'organization', 'business', 'company name'],
        'title': ['title', 'job title', 'position', 'role'],
        'notes': ['notes', 'comments', 'description', 'remarks']
      }
    };

    const fieldMappings = commonMappings[importType] || {};

    headers.forEach(header => {
      const normalizedHeader = header.toLowerCase().trim();

      for (const [dbField, variations] of Object.entries(fieldMappings)) {
        if (variations.some(variation => normalizedHeader.includes(variation))) {
          mappings[header] = dbField;
          break;
        }
      }
    });

    return mappings;
  }

  // Start import process with field mapping
  async startImport(req, res) {
    try {
      const { organizationId, userId } = req.user;
      const { importJobId, fieldMapping, importOptions = {} } = req.body;

      // Get import job
      const jobResult = await pool.query(
        'SELECT * FROM import_jobs WHERE id = $1 AND organization_id = $2',
        [importJobId, organizationId]
      );

      if (jobResult.rows.length === 0) {
        return res.status(404).json({ error: 'Import job not found' });
      }

      const importJob = jobResult.rows[0];

      if (importJob.status !== 'pending') {
        return res.status(400).json({ error: 'Import job is not in pending status' });
      }

      // Update job with mapping and options
      await pool.query(`
        UPDATE import_jobs
        SET field_mapping = $1, import_options = $2, status = 'processing', started_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [JSON.stringify(fieldMapping), JSON.stringify(importOptions), importJobId]);

      // Start processing in background
      this.processImport(importJobId, organizationId).catch(error => {
        console.error('Background import processing error:', error);
      });

      res.json({
        success: true,
        message: 'Import started successfully',
        importJobId
      });

    } catch (error) {
      console.error('Start import error:', error);
      res.status(500).json({ error: 'Failed to start import', details: error.message });
    }
  }

  // Process import in background
  async processImport(importJobId, organizationId) {
    let client;

    try {
      client = await pool.connect();
      await client.query('SET app.current_organization_id = $1', [organizationId]);

      // Get import job details
      const jobResult = await client.query('SELECT * FROM import_jobs WHERE id = $1', [importJobId]);
      const importJob = jobResult.rows[0];

      if (!importJob) {
        throw new Error('Import job not found');
      }

      const { file_path, field_mapping, import_options, import_type } = importJob;
      const fieldMapping = JSON.parse(field_mapping);
      const options = JSON.parse(import_options);

      let processedRows = 0;
      let successfulRows = 0;
      let failedRows = 0;
      let duplicateRows = 0;

      // Process CSV file
      await new Promise((resolve, reject) => {
        const results = [];
        let batch = [];
        const batchSize = options.batch_size || 1000;

        fs.createReadStream(file_path)
          .pipe(csv())
          .on('data', (row) => {
            batch.push({ row, rowNumber: processedRows + 1 });
            processedRows++;

            if (batch.length >= batchSize) {
              // Process batch
              this.processBatch(client, batch, fieldMapping, options, import_type, importJobId)
                .then(batchResults => {
                  successfulRows += batchResults.successful;
                  failedRows += batchResults.failed;
                  duplicateRows += batchResults.duplicates;
                  batch = [];
                })
                .catch(reject);
            }
          })
          .on('end', async () => {
            try {
              // Process remaining batch
              if (batch.length > 0) {
                const batchResults = await this.processBatch(client, batch, fieldMapping, options, import_type, importJobId);
                successfulRows += batchResults.successful;
                failedRows += batchResults.failed;
                duplicateRows += batchResults.duplicates;
              }

              // Update job status
              await client.query(`
                UPDATE import_jobs
                SET status = 'completed', completed_at = CURRENT_TIMESTAMP,
                    processed_rows = $1, successful_rows = $2, failed_rows = $3, duplicate_rows = $4
                WHERE id = $5
              `, [processedRows, successfulRows, failedRows, duplicateRows, importJobId]);

              resolve();
            } catch (error) {
              reject(error);
            }
          })
          .on('error', reject);
      });

    } catch (error) {
      console.error('Import processing error:', error);

      // Update job status to failed
      if (client) {
        await client.query(`
          UPDATE import_jobs
          SET status = 'failed', completed_at = CURRENT_TIMESTAMP,
              error_message = $1, error_details = $2
          WHERE id = $3
        `, [error.message, JSON.stringify({ stack: error.stack }), importJobId]);
      }
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // Process a batch of rows
  async processBatch(client, batch, fieldMapping, options, importType, importJobId) {
    let successful = 0;
    let failed = 0;
    let duplicates = 0;

    for (const { row, rowNumber } of batch) {
      try {
        const mappedData = this.mapRowData(row, fieldMapping);
        const validationResult = await this.validateRowData(mappedData, importType, options);

        if (!validationResult.isValid) {
          // Log validation errors
          await this.logImportError(client, importJobId, rowNumber, row, 'validation', validationResult.errors);
          failed++;
          continue;
        }

        // Check for duplicates if enabled
        if (options.skip_duplicates || options.update_existing) {
          const isDuplicate = await this.checkDuplicate(client, mappedData, importType);

          if (isDuplicate) {
            if (options.update_existing) {
              await this.updateRecord(client, mappedData, importType);
              successful++;
            } else {
              duplicates++;
            }
            continue;
          }
        }

        // Insert new record
        await this.insertRecord(client, mappedData, importType);
        successful++;

      } catch (error) {
        await this.logImportError(client, importJobId, rowNumber, row, 'processing', [error.message]);
        failed++;
      }
    }

    return { successful, failed, duplicates };
  }

  // Map CSV row data to database fields
  mapRowData(row, fieldMapping) {
    const mappedData = {};

    for (const [csvField, dbField] of Object.entries(fieldMapping)) {
      if (dbField && row[csvField] !== undefined) {
        mappedData[dbField] = row[csvField]?.toString().trim() || null;
      }
    }

    return mappedData;
  }

  // Validate row data
  async validateRowData(data, importType, options) {
    const errors = [];

    // Required fields validation
    const requiredFields = importType === 'leads'
      ? ['first_name', 'last_name']
      : ['first_name', 'last_name'];

    for (const field of requiredFields) {
      if (!data[field]) {
        errors.push(`${field} is required`);
      }
    }

    // Email validation
    if (data.email && options.validate_emails) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.email)) {
        errors.push('Invalid email format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Check for duplicate records
  async checkDuplicate(client, data, importType) {
    const table = importType;

    if (data.email) {
      const result = await client.query(
        `SELECT id FROM ${table} WHERE email = $1 LIMIT 1`,
        [data.email]
      );
      return result.rows.length > 0;
    }

    return false;
  }

  // Insert new record
  async insertRecord(client, data, importType) {
    const table = importType;
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${table} (${fields.join(', ')})
      VALUES (${placeholders.join(', ')})
    `;

    await client.query(query, values);
  }

  // Update existing record
  async updateRecord(client, data, importType) {
    const table = importType;
    const fields = Object.keys(data).filter(field => field !== 'email');
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');

    const query = `
      UPDATE ${table}
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP
      WHERE email = $1
    `;

    const values = [data.email, ...fields.map(field => data[field])];
    await client.query(query, values);
  }

  // Log import error
  async logImportError(client, importJobId, rowNumber, rowData, errorType, errors) {
    await client.query(`
      INSERT INTO import_errors (
        import_job_id, row_number, row_data, error_type, error_message
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      importJobId,
      rowNumber,
      JSON.stringify(rowData),
      errorType,
      Array.isArray(errors) ? errors.join('; ') : errors
    ]);
  }

  // Get import job status
  async getImportStatus(req, res) {
    try {
      const { organizationId } = req.user;
      const { importJobId } = req.params;

      const result = await pool.query(`
        SELECT ij.*,
               COUNT(ie.id) as error_count
        FROM import_jobs ij
        LEFT JOIN import_errors ie ON ij.id = ie.import_job_id
        WHERE ij.id = $1 AND ij.organization_id = $2
        GROUP BY ij.id
      `, [importJobId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Import job not found' });
      }

      res.json({
        success: true,
        importJob: result.rows[0]
      });

    } catch (error) {
      console.error('Get import status error:', error);
      res.status(500).json({ error: 'Failed to get import status' });
    }
  }

  // Get import history
  async getImportHistory(req, res) {
    try {
      const { organizationId } = req.user;
      const { page = 1, limit = 20, importType } = req.query;

      const offset = (page - 1) * limit;
      let whereClause = 'WHERE ij.organization_id = $1';
      const queryParams = [organizationId];

      if (importType) {
        whereClause += ' AND ij.import_type = $2';
        queryParams.push(importType);
      }

      const result = await pool.query(`
        SELECT ij.*,
               u.first_name, u.last_name,
               COUNT(ie.id) as error_count
        FROM import_jobs ij
        JOIN users u ON ij.user_id = u.id
        LEFT JOIN import_errors ie ON ij.id = ie.import_job_id
        ${whereClause}
        GROUP BY ij.id, u.first_name, u.last_name
        ORDER BY ij.created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      const countResult = await pool.query(`
        SELECT COUNT(*) FROM import_jobs ij ${whereClause}
      `, queryParams);

      res.json({
        success: true,
        importJobs: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      });

    } catch (error) {
      console.error('Get import history error:', error);
      res.status(500).json({ error: 'Failed to get import history' });
    }
  }

  // Get import errors
  async getImportErrors(req, res) {
    try {
      const { organizationId } = req.user;
      const { importJobId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const offset = (page - 1) * limit;

      // Verify job belongs to organization
      const jobCheck = await pool.query(
        'SELECT id FROM import_jobs WHERE id = $1 AND organization_id = $2',
        [importJobId, organizationId]
      );

      if (jobCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Import job not found' });
      }

      const result = await pool.query(`
        SELECT * FROM import_errors
        WHERE import_job_id = $1
        ORDER BY row_number ASC
        LIMIT $2 OFFSET $3
      `, [importJobId, limit, offset]);

      const countResult = await pool.query(
        'SELECT COUNT(*) FROM import_errors WHERE import_job_id = $1',
        [importJobId]
      );

      res.json({
        success: true,
        errors: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: parseInt(countResult.rows[0].count),
          pages: Math.ceil(countResult.rows[0].count / limit)
        }
      });

    } catch (error) {
      console.error('Get import errors error:', error);
      res.status(500).json({ error: 'Failed to get import errors' });
    }
  }

  // Cancel import job
  async cancelImport(req, res) {
    try {
      const { organizationId } = req.user;
      const { importJobId } = req.params;

      const result = await pool.query(`
        UPDATE import_jobs
        SET status = 'cancelled', completed_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND organization_id = $2 AND status IN ('pending', 'processing')
        RETURNING *
      `, [importJobId, organizationId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Import job not found or cannot be cancelled' });
      }

      res.json({
        success: true,
        message: 'Import job cancelled successfully'
      });

    } catch (error) {
      console.error('Cancel import error:', error);
      res.status(500).json({ error: 'Failed to cancel import' });
    }
  }
}

module.exports = new ImportController();