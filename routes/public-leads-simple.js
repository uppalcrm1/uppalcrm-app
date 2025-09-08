const express = require('express');
const router = express.Router();

/**
 * Simple test endpoint - no dependencies
 */
router.get('/test', (req, res) => {
  res.json({
    message: 'Public leads API is working',
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
});

/**
 * Placeholder POST endpoint - will implement after server starts
 */
router.post('/', (req, res) => {
  res.status(503).json({
    error: 'Lead submission temporarily unavailable',
    message: 'Feature is being deployed. Please try again in a few minutes.'
  });
});

module.exports = router;