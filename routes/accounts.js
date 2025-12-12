const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Account Management Routes

// GET /api/accounts - Get all account subscriptions with filtering and pagination
router.get('/', accountController.getAccountSubscriptions);

// GET /api/accounts/:id/detail - Get account detail for detail page
router.get('/:id/detail', accountController.getAccountDetail);

// GET /api/accounts/:id - Get single account subscription details
router.get('/:id', accountController.getAccountSubscription);

// POST /api/accounts - Create new account subscription
router.post('/', accountController.createAccountSubscription);

// PUT /api/accounts/:id - Update account subscription
router.put('/:id', accountController.updateAccountSubscription);

// DELETE /api/accounts/:id - Deactivate account subscription
router.delete('/:id', accountController.deactivateAccountSubscription);

// POST /api/accounts/:id/transfer - Transfer account subscription to different device
router.post('/:id/transfer', accountController.transferAccountSubscription);

// POST /api/accounts/:id/generate-download - Generate download link
router.post('/:id/generate-download', accountController.generateDownload);

// GET /api/contacts/:contactId/accounts - Get all account subscriptions for a contact
router.get('/contacts/:contactId', accountController.getContactAccountSubscriptions);

module.exports = router;