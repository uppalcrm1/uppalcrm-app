const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const { authenticateToken } = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/upload');

// All import routes require authentication
router.use(authenticateToken);

// POST /api/import/upload - Upload CSV file for analysis
router.post('/upload', uploadMiddleware, importController.uploadFile);

// POST /api/import/start - Start import process with field mapping
router.post('/start', importController.startImport);

// GET /api/import/status/:importJobId - Get import job status
router.get('/status/:importJobId', importController.getImportStatus);

// GET /api/import/history - Get import history
router.get('/history', importController.getImportHistory);

// GET /api/import/errors/:importJobId - Get import errors for a specific job
router.get('/errors/:importJobId', importController.getImportErrors);

// PUT /api/import/cancel/:importJobId - Cancel import job
router.put('/cancel/:importJobId', importController.cancelImport);

module.exports = router;