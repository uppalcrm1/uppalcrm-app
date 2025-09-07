const express = require('express');
const router = express.Router();
const Trial = require('../models/Trial');
const { authenticateToken, requireOrganization } = require('../middleware/auth');
const { body, validationResult, param } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limiting for trial actions
const trialActionLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each org to 10 trial actions per windowMs
  message: { error: 'Too many trial actions, please try again later' },
  keyGenerator: (req) => req.user.organization_id
});

/**
 * GET /api/trials/status
 * Get current trial status for organization
 */
router.get('/status', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const trialStatus = await Trial.getTrialStatus(req.user.organization_id);
    
    if (!trialStatus) {
      return res.status(404).json({
        error: 'Organization not found'
      });
    }

    res.json({
      message: 'Trial status retrieved successfully',
      trial: trialStatus
    });
  } catch (error) {
    console.error('Error getting trial status:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get trial status'
    });
  }
});

/**
 * POST /api/trials/start
 * Start a new trial for organization
 */
router.post('/start', 
  authenticateToken, 
  requireOrganization,
  trialActionLimit,
  [
    body('trial_days')
      .optional()
      .isInt({ min: 1, max: 90 })
      .withMessage('Trial days must be between 1 and 90'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Request data is invalid',
          details: { body: errors.array() }
        });
      }

      const { trial_days = 30 } = req.body;

      // Check if can start trial
      const canStart = await Trial.canStartTrial(req.user.organization_id);
      if (!canStart) {
        return res.status(400).json({
          error: 'Trial not available',
          message: 'Organization already has an active trial'
        });
      }

      const trialStatus = await Trial.startTrial(req.user.organization_id, trial_days);

      res.status(201).json({
        message: 'Trial started successfully',
        trial: trialStatus
      });
    } catch (error) {
      console.error('Error starting trial:', error);
      
      if (error.message.includes('not eligible')) {
        return res.status(400).json({
          error: 'Trial not available',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to start trial'
      });
    }
  }
);

/**
 * POST /api/trials/extend
 * Extend current trial
 */
router.post('/extend',
  authenticateToken,
  requireOrganization,
  trialActionLimit,
  [
    body('additional_days')
      .isInt({ min: 1, max: 30 })
      .withMessage('Additional days must be between 1 and 30'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Request data is invalid',
          details: { body: errors.array() }
        });
      }

      const { additional_days } = req.body;

      const trialStatus = await Trial.extendTrial(req.user.organization_id, additional_days);

      res.json({
        message: `Trial extended by ${additional_days} days`,
        trial: trialStatus
      });
    } catch (error) {
      console.error('Error extending trial:', error);
      
      if (error.message.includes('No active trial')) {
        return res.status(400).json({
          error: 'No active trial',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to extend trial'
      });
    }
  }
);

/**
 * POST /api/trials/convert
 * Convert trial to paid subscription
 */
router.post('/convert',
  authenticateToken,
  requireOrganization,
  trialActionLimit,
  [
    body('payment_method_id')
      .notEmpty()
      .withMessage('Payment method ID is required'),
    body('payment_processor')
      .optional()
      .isIn(['stripe', 'paypal', 'square'])
      .withMessage('Payment processor must be stripe, paypal, or square'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Request data is invalid',
          details: { body: errors.array() }
        });
      }

      const { payment_method_id, payment_processor = 'stripe' } = req.body;

      const paymentData = {
        payment_method_id,
        payment_processor
      };

      const trialStatus = await Trial.convertTrial(req.user.organization_id, paymentData);

      res.json({
        message: 'Trial converted to paid subscription successfully',
        trial: trialStatus
      });
    } catch (error) {
      console.error('Error converting trial:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to convert trial'
      });
    }
  }
);

/**
 * POST /api/trials/cancel
 * Cancel current trial
 */
router.post('/cancel',
  authenticateToken,
  requireOrganization,
  trialActionLimit,
  [
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Cancellation reason must be less than 500 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Request data is invalid',
          details: { body: errors.array() }
        });
      }

      const { reason } = req.body;

      const trialStatus = await Trial.cancelTrial(req.user.organization_id, reason);

      res.json({
        message: 'Trial cancelled successfully',
        trial: trialStatus
      });
    } catch (error) {
      console.error('Error cancelling trial:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to cancel trial'
      });
    }
  }
);

/**
 * GET /api/trials/history
 * Get trial history for organization
 */
router.get('/history', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const history = await Trial.getTrialHistory(req.user.organization_id);

    res.json({
      message: 'Trial history retrieved successfully',
      history: history,
      count: history.length
    });
  } catch (error) {
    console.error('Error getting trial history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get trial history'
    });
  }
});

/**
 * GET /api/trials/subscription
 * Get current subscription details
 */
router.get('/subscription', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const subscription = await Trial.getSubscription(req.user.organization_id);

    if (!subscription) {
      return res.status(404).json({
        error: 'Subscription not found',
        message: 'No subscription found for this organization'
      });
    }

    res.json({
      message: 'Subscription details retrieved successfully',
      subscription: subscription
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get subscription details'
    });
  }
});

/**
 * GET /api/trials/check-eligibility
 * Check if organization can start a new trial
 */
router.get('/check-eligibility', authenticateToken, requireOrganization, async (req, res) => {
  try {
    const canStart = await Trial.canStartTrial(req.user.organization_id);

    res.json({
      message: 'Trial eligibility checked',
      eligible: canStart,
      can_start_trial: canStart
    });
  } catch (error) {
    console.error('Error checking trial eligibility:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to check trial eligibility'
    });
  }
});

// Admin routes (require admin role)
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied',
      message: 'Admin role required'
    });
  }
  next();
};

/**
 * POST /api/trials/admin/expire
 * Manually expire trials (admin only)
 */
router.post('/admin/expire',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const expiredCount = await Trial.expireTrials();

      res.json({
        message: 'Trials expired successfully',
        expired_count: expiredCount
      });
    } catch (error) {
      console.error('Error expiring trials:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to expire trials'
      });
    }
  }
);

/**
 * GET /api/trials/admin/statistics
 * Get trial statistics (admin only)
 */
router.get('/admin/statistics',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const statistics = await Trial.getTrialStatistics();

      res.json({
        message: 'Trial statistics retrieved successfully',
        statistics: statistics
      });
    } catch (error) {
      console.error('Error getting trial statistics:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to get trial statistics'
      });
    }
  }
);

module.exports = router;