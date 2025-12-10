const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const ContactImportService = require('../services/ContactImportService');
const ContactImport = require('../models/ContactImport');

// IMPORT LIMITS - 10,000 contacts per file
const MAX_CONTACTS_PER_IMPORT = 10000;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Set up file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'));
    }
  }
});

/**
 * POST /api/imports/contacts/upload
 * Upload and preview CSV file
 */
router.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { file } = req;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Get CSV headers
    const headers = await ContactImportService.getCSVHeaders(file.buffer);

    // Count total rows in file
    const rows = await ContactImportService.parseCSVFile(file.buffer);
    const totalRows = rows.length;

    // Check if file exceeds limit
    if (totalRows > MAX_CONTACTS_PER_IMPORT) {
      return res.status(400).json({
        message: `File has too many rows (${totalRows}). Maximum is ${MAX_CONTACTS_PER_IMPORT} contacts per file. Please split into smaller files.`
      });
    }

    // Create import record
    const importRecord = await ContactImport.createImport(
      organizationId,
      req.user.id,
      file.originalname,
      file.size
    );

    // Store file buffer temporarily in memory (for small files)
    // For production, consider using a temporary file storage or cache
    const fileBufferBase64 = file.buffer.toString('base64');

    res.json({
      importId: importRecord.id,
      filename: file.originalname,
      headers,
      totalRows,
      fileBuffer: fileBufferBase64,
      message: `File uploaded successfully (${totalRows} contacts found)`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * POST /api/imports/contacts/:importId/process
 * Start the actual import processing
 */
router.post('/:importId/process', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { importId } = req.params;
    const { fieldMapping, duplicateHandling = 'create_or_update', matchField = 'email', fileBuffer } = req.body;

    if (!fieldMapping || !fileBuffer) {
      return res.status(400).json({ message: 'Missing fieldMapping or file data' });
    }

    // Get import record
    const importRecord = await ContactImport.getImportById(importId, organizationId);
    if (!importRecord) {
      return res.status(404).json({ message: 'Import not found' });
    }

    // Update status to processing
    await ContactImport.updateImportStatus(importId, organizationId, 'processing');

    // Convert base64 to buffer if needed
    let buffer = fileBuffer;
    if (typeof fileBuffer === 'string') {
      buffer = Buffer.from(fileBuffer, 'base64');
    }

    // Process import asynchronously
    ContactImportService.processImport(
      importId,
      organizationId,
      req.user.id,
      buffer,
      fieldMapping,
      duplicateHandling,
      matchField
    ).catch(error => {
      console.error('Async import error:', error);
      ContactImport.updateImportStatus(importId, organizationId, 'failed');
    });

    res.json({
      importId,
      message: 'Import processing started',
      status: 'processing'
    });
  } catch (error) {
    console.error('Process error:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * GET /api/imports/contacts/:importId
 * Get import status and results
 */
router.get('/:importId', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { importId } = req.params;

    const importRecord = await ContactImport.getImportById(importId, organizationId);
    if (!importRecord) {
      return res.status(404).json({ message: 'Import not found' });
    }

    res.json(importRecord);
  } catch (error) {
    console.error('Error getting import:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * GET /api/imports/contacts
 * Get all imports for organization
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { limit = 20, offset = 0 } = req.query;

    const imports = await ContactImport.getImportsByOrganization(
      organizationId,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      imports,
      total: imports.length
    });
  } catch (error) {
    console.error('Error getting imports:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * POST /api/imports/contacts/mappings/save
 * Save a field mapping for future use
 */
router.post('/mappings/save', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;
    const { mappingName, fieldMapping, duplicateHandling, matchField } = req.body;

    if (!mappingName || !fieldMapping) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const saved = await ContactImport.saveFieldMapping(
      organizationId,
      req.user.id,
      mappingName,
      fieldMapping,
      duplicateHandling || 'create_or_update',
      matchField || 'email'
    );

    res.json({
      message: 'Mapping saved successfully',
      mapping: saved
    });
  } catch (error) {
    console.error('Error saving mapping:', error);
    res.status(400).json({ message: error.message });
  }
});

/**
 * GET /api/imports/contacts/mappings/list
 * Get all saved mappings for organization
 */
router.get('/mappings/list', authenticateToken, async (req, res) => {
  try {
    const organizationId = req.organizationId;

    const mappings = await ContactImport.getMappingsByOrganization(organizationId);

    res.json({
      mappings
    });
  } catch (error) {
    console.error('Error getting mappings:', error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
