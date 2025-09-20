const express = require('express');
const router = express.Router();
const downloadController = require('../controllers/downloadController');
const { authenticateToken } = require('../middleware/auth');

// Download Management Routes

// GET /api/downloads/:token - Serve download file (public route with token auth)
router.get('/:token', downloadController.serveDownload);

// POST /api/downloads/:token/activate - Track activation (public route with token auth)
router.post('/:token/activate', downloadController.trackActivation);

// Protected routes (require authentication)
router.use(authenticateToken);

// GET /api/downloads/stats - Get download statistics
router.get('/stats', downloadController.getDownloadStats);

// GET /api/downloads/history - Get download history
router.get('/history', downloadController.getDownloadHistory);

module.exports = router;