const express = require('express');
const router = express.Router();
const setupStagingUser = require('../scripts/setup-staging-user');

/**
 * GET /staging-setup
 * One-time setup for staging environment
 */
router.get('/', async (req, res) => {
  // Only allow in staging environment
  if (process.env.NODE_ENV !== 'staging') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    await setupStagingUser();
    res.json({
      success: true,
      message: 'Staging environment setup complete',
      credentials: {
        email: 'admin@staging.local',
        password: 'staging123',
        loginUrl: 'https://uppalcrm-frontend-staging.onrender.com'
      }
    });
  } catch (error) {
    console.error('Staging setup error:', error);
    res.status(500).json({
      error: 'Setup failed',
      message: error.message
    });
  }
});

module.exports = router;