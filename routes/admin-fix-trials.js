// Quick admin endpoint to mark existing organizations as trials
// POST to this endpoint once to update all orgs
// Then delete this file

const express = require('express');
const { platformAuth } = require('../middleware/platformAuth');
const { query } = require('../database/connection');

const router = express.Router();

router.post('/fix-trial-data', platformAuth, async (req, res) => {
  try {
    console.log('🔧 Fixing trial data for existing organizations...');

    // First, check current state
    const checkResult = await query(`
      SELECT id, name, is_trial, trial_status, trial_expires_at
      FROM organizations
    `);
    console.log('📊 Current org state:', checkResult.rows);

    // Mark all current organizations as active trials expiring in 30 days
    const result = await query(`
      UPDATE organizations
      SET
        is_trial = true,
        trial_status = 'active',
        trial_expires_at = NOW() + INTERVAL '30 days'
      WHERE trial_status IS NULL
         OR trial_status != 'active'
         OR trial_expires_at IS NULL
         OR is_trial IS NULL
         OR is_trial = false
      RETURNING id, name, is_trial, trial_status, trial_expires_at
    `);

    console.log(`✅ Updated ${result.rows.length} organizations`);

    res.json({
      message: 'Trial data updated successfully',
      updated_count: result.rows.length,
      organizations: result.rows,
      before_state: checkResult.rows
    });

  } catch (error) {
    console.error('❌ Error fixing trial data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
