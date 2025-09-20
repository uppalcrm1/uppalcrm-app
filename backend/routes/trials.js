const express = require('express');
const router = express.Router();
const trialController = require('../controllers/trialController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Trial Management Routes

// GET /api/trials - Get all trials with filtering and pagination
router.get('/', trialController.getTrials);

// GET /api/trials/:id - Get single trial details
router.get('/:id', trialController.getTrial);

// POST /api/trials - Start new trial
router.post('/', trialController.startTrial);

// POST /api/trials/:id/convert - Convert trial to paid license
router.post('/:id/convert', trialController.convertTrial);

// PUT /api/trials/:id/cancel - Cancel trial
router.put('/:id/cancel', trialController.cancelTrial);

// GET /api/contacts/:contactId/trials - Get all trials for a contact
router.get('/contacts/:contactId', trialController.getContactTrials);

module.exports = router;