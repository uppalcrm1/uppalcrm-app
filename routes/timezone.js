const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const User = require('../models/User');
const { getTimezoneList, isValidTimezone, getUserTimezone } = require('../utils/timezone');

/**
 * Get all available timezones
 * GET /api/timezones
 */
router.get('/', (req, res) => {
  try {
    const timezones = getTimezoneList();
    res.json({
      success: true,
      data: timezones,
      count: timezones.length
    });
  } catch (error) {
    console.error('Error fetching timezones:', error);
    res.status(500).json({
      error: 'Failed to fetch timezones',
      message: error.message
    });
  }
});

/**
 * Get current user's timezone
 * GET /api/timezones/user
 */
router.get('/user', authenticateToken, (req, res) => {
  try {
    const timezone = getUserTimezone(req.user);
    res.json({
      success: true,
      timezone: timezone,
      user: {
        id: req.user.id,
        email: req.user.email,
        timezone: timezone
      }
    });
  } catch (error) {
    console.error('Error fetching user timezone:', error);
    res.status(500).json({
      error: 'Failed to fetch user timezone',
      message: error.message
    });
  }
});

/**
 * Update user's timezone
 * PUT /api/timezones/user
 */
router.put('/user', authenticateToken, async (req, res) => {
  try {
    const { timezone } = req.body;

    // Validate timezone
    if (!timezone) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Timezone is required'
      });
    }

    if (!isValidTimezone(timezone)) {
      return res.status(400).json({
        error: 'Validation error',
        message: `Invalid timezone: ${timezone}`
      });
    }

    // Update user timezone
    const updatedUser = await User.update(
      req.user.id,
      { timezone },
      req.user.organization_id
    );

    if (!updatedUser) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Timezone updated successfully',
      user: updatedUser.toJSON()
    });
  } catch (error) {
    console.error('Error updating user timezone:', error);
    res.status(500).json({
      error: 'Failed to update timezone',
      message: error.message
    });
  }
});

module.exports = router;
